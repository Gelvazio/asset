// Bloqueio de atividades no ATIVIDADES/index.html, POR TURMA: atividade.bloqueio guarda os
// códigos das turmas bloqueadas (fora da lista = liberada) e atividade.ativo = false bloqueia
// para todas. O RLS só mostra ao aluno as atividades liberadas para alguma turma dele; aqui, a
// atividade que o aluno não consegue ler aparece marcada com 🔒 e apagada, mas NÃO abre (o link
// fica sem href, guardado em data-href-bloqueado) e o card nunca some por causa do bloqueio
// (2026-10-18, #281). Só age em pastas gerenciadas pelo banco (pelo menos uma atividade ativa).
// Para o professor, CADA atividade do card ganha, logo depois do link, o botão ON/OFF
// (ON = liberada, OFF = bloqueada) que vale SÓ para a turma escolhida no combo
// "Turma:" do índice (sem combo, a favorita) (função definir_bloqueio_turma; as outras turmas
// não mudam). Regra global de todas as matérias (CLAUDE.md, 2026-10-09). Trocar a turma no combo
// (evento turma-indice-alterada, #190) ou a favorita (turma-favorita-alterada) remonta os botões.
// Nas matérias com o bloqueio da AULA ligado (assets/js/indice-bloqueio-aula-config.js), o ON/OFF
// das atividades NUNCA bloqueia o card inteiro: só o botão da aula faz isso
// (assets/js/indice-aula-bloqueio.js).
// Carregado por assets/js/atividades-crud-modal.js. Depende de supabase-js, js/supabase.js e de
// assets/js/atividades-crud-modal.js (obterCaminhoHtml: o caminho começa em /MATERIAIS/ como
// atividade.pagina, mesmo com o servidor local numa pasta; #290).
// Tempo real (REALTIME-STATUS-ATIVIDADES .10, .14 e .15; docs/realtime-atividades.md): para o
// aluno, o evento 'atividades-status-alterado' (assets/js/realtime-atividades.js, iniciado pelo
// loader comum) e os eventos de página (turma favorita, turma do combo, bloqueio da aula, cards
// montados) entram numa fila só, com espera curta: uma releitura pelo REST (com RLS) que trava
// ou destrava os botões sem recarregar. reaplicarBloqueioAtividadesAluno() fica em window para
// outros módulos. Quando a mudança veio do Realtime, mostra um aviso discreto
// (assets/js/aviso-discreto.js). Este módulo só escuta: não dispara evento (sem laço).

// Cards informativos (sem atividade no banco) usam data-sem-bloqueio e nunca são bloqueados.
const SELETOR_CARD_BLOQUEIO = 'article.aula:not([data-sem-bloqueio])';
const SELETOR_CARD_SOMENTE_PROFESSOR = 'article[data-somente-professor]';
const SELETOR_LINK_BLOQUEIO = 'a.btn.principal';
const SELETOR_LINK_ATIVIDADE_BLOQUEIO = 'a.btn';
// Classes próprias (não as do bloqueio da aula): o indice-aula-bloqueio.js liga e desliga a dele.
const CLASSE_LINK_BLOQUEADO_ALUNO = 'atividade--bloqueada-para-aluno';
const CLASSE_TEMA_BLOQUEADO_PROFESSOR = 'bloqueada-professor';
const CLASSE_LINK_BLOQUEADO_PROFESSOR = 'link-bloqueado-professor';
const TEXTO_INTERRUPTOR_LIGADO = 'Liberada para a turma ';
const TEXTO_INTERRUPTOR_DESLIGADO = 'Bloqueada para a turma ';
const TEXTO_ATIVIDADE_BLOQUEADA_ALUNO = 'Atividade bloqueada pelo professor';
const TEXTO_SEM_FAVORITA = '(marque a turma favorita)';
const PERFIL_PROFESSOR_BLOQUEIO = 'PROFESSOR';
const ROTA_DEFINIR_BLOQUEIO_TURMA = '/rest/v1/rpc/definir_bloqueio_turma';
const EVENTO_FAVORITA_ALTERADA = 'turma-favorita-alterada';
// Disparado pelo combo "Turma:" da barra do índice (indice-turma-favorita.js).
const EVENTO_TURMA_INDICE_BLOQUEIO = 'turma-indice-alterada';
const SELETOR_COMBO_TURMA_BLOQUEIO = '.barra-turma-favorita__lista';
// Disparado pelo botão da aula (indice-aula-bloqueio.js): o trigger do banco bloqueia as
// atividades da aula bloqueada.
const EVENTO_AULA_ALTERADA_BLOQUEIO = 'aula-bloqueio-alterado';
// Disparado pelo indice-aula-data.js quando a grade só do banco fica pronta (#272): os cards são
// novos, então o aluno tem as atividades bloqueadas marcadas de novo (#281).
const EVENTO_CARDS_MONTADOS_BLOQUEIO = 'cards-aula-montados';
const SELETOR_INTERRUPTOR_ATIVIDADE = '.interruptor-atividade';
// Card de aula bloqueada (indice-aula-bloqueio.js): os botões das atividades nascem travados.
const CLASSE_AULA_TRAVADA_BLOQUEIO = 'aula--bloqueada-professor';
const ATRIBUTO_HREF_GUARDADO = 'data-href-bloqueado';
const MSG_SEM_FAVORITA_BLOQUEIO = 'Escolha a turma na barra "Turma" do índice: o ' +
    'bloqueio vale só para a turma escolhida.';
const URL_POPUP_BLOQUEIO = document.currentScript?.src.replace(/[^/]*$/, 'popup.js') || '';
// Tempo real (.10, .14, .15): evento do módulo assets/js/realtime-atividades.js (já com espera).
const EVENTO_STATUS_ATIVIDADES_BLOQUEIO = 'atividades-status-alterado';
const ORIGEM_REALTIME_BLOQUEIO = 'realtime';
// Espera para juntar eventos seguidos numa releitura só (cards montados = sem espera).
const ESPERA_JUNTAR_RELEITURA_BLOQUEIO_MS = 300;
// Aviso do Realtime espera um pouco mais: o indice-aula-data.js (.12) refaz a grade do aluno ao
// mesmo aviso e dispara 'cards-aula-montados' no fim; esse evento adianta esta releitura (sem
// espera), e o aviso e a grade viram UMA leitura só do bloqueio das atividades.
const ESPERA_RELEITURA_REALTIME_BLOQUEIO_MS = 1200;
// Estado já aplicado em cada botão do aluno ('sim' = bloqueado): compara antes e depois (aviso).
const ATRIBUTO_CONFERIDO_BLOQUEIO = 'data-bloqueio-aluno';
const ATRIBUTO_TITULO_ANTES_BLOQUEIO = 'data-titulo-antes-bloqueio';
// Bloqueio da aula do aluno (indice-aula-bloqueio.js): classe do card e onde guarda o href.
const CLASSE_CARD_AULA_BLOQUEADA_ALUNO = 'bloqueada';
const ATRIBUTO_HREF_AULA_GUARDADO = 'data-href-aula-bloqueada';
const TEXTO_AVISO_VARIAS_ATIVIDADES = 'As atividades foram atualizadas.';
const TAMANHO_MAX_NOME_AVISO = 60;
const URL_AVISO_DISCRETO_BLOQUEIO =
    document.currentScript?.src.replace(/[^/]*$/, 'aviso-discreto.js') || '';
// Recuperação (assets/js/recuperacao-visibilidade.js): o aluno que não está em recuperação não vê
// o botão dela.
const URL_RECUPERACAO_BLOQUEIO =
    document.currentScript?.src.replace(/[^/]*$/, 'recuperacao-visibilidade.js') || '';
// A pasta é do banco quando alguma atividade já voltou ativa (depois disso, zero = tudo travado).
let pastaGerenciadaBloqueio = false;
const filaReleituraBloqueio = { timer: null, comAviso: false, emCurso: false, pendente: false };

/**
 * Caminho da página de um link, mesmo quando o href está guardado (link desativado).
 * Usa obterCaminhoHtml (atividades-crud-modal.js): atividade.pagina começa em /MATERIAIS/ e o
 * servidor local põe uma pasta antes (#290).
 * @param {HTMLAnchorElement} link - Link do card.
 * @returns {string|null} Caminho da página (a partir de /MATERIAIS/) ou null.
 */
function caminhoDoLink(link) {
    return obterCaminhoHtml(link.getAttribute('href') ||
        link.getAttribute(ATRIBUTO_HREF_GUARDADO));
}

/**
 * Indica se há professor logado (ele vê e abre tudo).
 * @returns {Promise<boolean>} true se o usuário logado é professor.
 */
async function usuarioEhProfessorBloqueio() {
    const cliente = obterClienteSupabase();
    if (!cliente) return false;

    const { data } = await cliente.auth.getSession();
    return data?.session?.user?.app_metadata?.perfil === PERFIL_PROFESSOR_BLOQUEIO;
}

/**
 * Carrega o popup reutilizável (assets/js/popup.js), se ainda não estiver na página.
 * @returns {Promise<void>} Resolve quando o popup está disponível.
 */
function garantirPopupBloqueio() {
    if (typeof window.mostrarPopup === 'function' || !URL_POPUP_BLOQUEIO) return Promise.resolve();

    return new Promise((resolver) => {
        const script = document.createElement('script');
        script.src = URL_POPUP_BLOQUEIO;
        script.addEventListener('load', resolver);
        script.addEventListener('error', resolver);
        document.head.appendChild(script);
    });
}

/**
 * Busca os caminhos das atividades ativas que o usuário consegue ler no banco.
 * @param {string[]} paginas - Caminhos das atividades do índice.
 * @returns {Promise<Set<string>>} Caminhos cadastrados e ativos.
 */
async function buscarPaginasAtivasBloqueio(paginas) {
    const valores = paginas.map((pagina) => '"' + pagina.replace(/"/g, '') + '"').join(',');
    const linhas = await sbGet('atividade',
        'select=pagina&pagina=in.(' + encodeURIComponent(valores) + ')');
    return new Set(linhas.map((linha) => linha.pagina));
}

/**
 * Caminho da página de um botão do aluno, também quando o bloqueio da aula guardou o href.
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @returns {string|null} Caminho da página (a partir de /MATERIAIS/) ou null.
 */
function caminhoDoLinkAluno(link) {
    return caminhoDoLink(link) || obterCaminhoHtml(link.getAttribute(ATRIBUTO_HREF_AULA_GUARDADO));
}

/**
 * Aluno: marca o link de uma atividade bloqueada. Ele continua na lista, com 🔒 e apagado (CSS),
 * mas não abre: sem href, fora da ordem do teclado e sem clique. O RLS continua barrando o acesso.
 * O endereço vai para data-href-bloqueado (também o guardado pelo bloqueio da aula: assim o
 * desbloqueio da aula não devolve o href de uma atividade ainda bloqueada).
 * @param {HTMLAnchorElement} link - Link da atividade bloqueada.
 */
function marcarLinkBloqueadoAluno(link) {
    if (link.classList.contains(CLASSE_LINK_BLOQUEADO_ALUNO)) return;

    // Guarda o endereço: o indice-aula-data.js ainda precisa dele para achar a aula do card.
    const endereco = link.getAttribute('href') || link.getAttribute(ATRIBUTO_HREF_AULA_GUARDADO);
    if (endereco) link.setAttribute(ATRIBUTO_HREF_GUARDADO, endereco);
    link.removeAttribute('href');
    link.removeAttribute(ATRIBUTO_HREF_AULA_GUARDADO);
    link.setAttribute('tabindex', '-1');
    if (link.title) link.setAttribute(ATRIBUTO_TITULO_ANTES_BLOQUEIO, link.title);
    link.title = TEXTO_ATIVIDADE_BLOQUEADA_ALUNO;
    link.classList.add(CLASSE_LINK_BLOQUEADO_ALUNO);
    link.setAttribute('aria-disabled', 'true');
}

/**
 * Aluno: destrava o link de uma atividade liberada de novo (o contrário de
 * marcarLinkBloqueadoAluno). Se a aula do card está bloqueada, o endereço volta para o lugar do
 * bloqueio da aula e o link continua sem abrir.
 * @param {HTMLAnchorElement} link - Link da atividade liberada.
 */
function desmarcarLinkBloqueadoAluno(link) {
    if (!link.classList.contains(CLASSE_LINK_BLOQUEADO_ALUNO)) return;

    const endereco = link.getAttribute(ATRIBUTO_HREF_GUARDADO);
    const aulaTravada = Boolean(link.closest('.' + CLASSE_CARD_AULA_BLOQUEADA_ALUNO));
    link.removeAttribute(ATRIBUTO_HREF_GUARDADO);
    if (endereco && aulaTravada) link.setAttribute(ATRIBUTO_HREF_AULA_GUARDADO, endereco);
    if (endereco && !aulaTravada) link.setAttribute('href', endereco);
    if (!aulaTravada) link.removeAttribute('tabindex');
    link.title = link.getAttribute(ATRIBUTO_TITULO_ANTES_BLOQUEIO) || '';
    link.removeAttribute(ATRIBUTO_TITULO_ANTES_BLOQUEIO);
    link.classList.remove(CLASSE_LINK_BLOQUEADO_ALUNO);
    // Por último: o indice-atividades-feitas.js observa o aria-disabled para repintar.
    link.removeAttribute('aria-disabled');
}

/**
 * Aluno: aplica o estado (bloqueado ou liberado) a um botão e diz se ele mudou desde a última
 * aplicação (botão novo, de card recém-montado, não conta como mudança).
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @param {boolean} bloquear - true se a atividade não voltou na leitura (RLS).
 * @returns {boolean} true se o estado mudou em relação ao já aplicado.
 */
function aplicarEstadoLinkAluno(link, bloquear) {
    const antes = link.getAttribute(ATRIBUTO_CONFERIDO_BLOQUEIO);
    const agora = bloquear ? 'sim' : 'nao';
    if (bloquear) marcarLinkBloqueadoAluno(link);
    else desmarcarLinkBloqueadoAluno(link);
    link.setAttribute(ATRIBUTO_CONFERIDO_BLOQUEIO, agora);
    return antes !== null && antes !== agora;
}

/**
 * Diz se o card inteiro pode ser bloqueado pelas atividades (não pode nas matérias com o
 * bloqueio da aula ligado: lá, só o botão da aula bloqueia o card).
 * @returns {boolean} true se as atividades podem bloquear o card.
 */
function atividadesBloqueiamCard() {
    return !(typeof bloqueioDeAulaLigado === 'function' && bloqueioDeAulaLigado());
}

/**
 * Lista os caminhos das páginas de atividade (links .html) de um card.
 * @param {HTMLElement} card - Card do índice.
 * @returns {string[]} Caminhos sem repetição.
 */
function listarPaginasDoCard(card) {
    const caminhos = [...card.querySelectorAll(SELETOR_LINK_ATIVIDADE_BLOQUEIO)].map(caminhoDoLink);
    return [...new Set(caminhos.filter(Boolean))];
}

/**
 * Busca o código da turma do bloqueio: a escolhida no combo "Turma:" do índice; sem combo, a
 * favorita (turma.favorito).
 * @returns {Promise<string>} Código da turma ou vazio.
 */
async function buscarFavoritaBloqueio() {
    const turmaDoCombo = document.querySelector(SELETOR_COMBO_TURMA_BLOQUEIO)?.value;
    if (turmaDoCombo) return turmaDoCombo;

    const linhas = await sbGet('turma', 'select=codigo&favorito=eq.true');
    return linhas[0]?.codigo || '';
}

/**
 * Diz se a atividade está bloqueada para a turma (ativo = false bloqueia para todas).
 * @param {{ativo: boolean, bloqueio: string[]}} atividade - Linha da atividade.
 * @param {string} turma - Código da turma (vazio = olha só o ativo).
 * @returns {boolean} true se bloqueada para a turma.
 */
function estaBloqueadaParaTurma(atividade, turma) {
    if (!atividade.ativo) return true;
    if (!turma) return false;
    return (atividade.bloqueio || []).includes(turma);
}

/**
 * Bloqueia ou libera uma atividade para uma turma (função definir_bloqueio_turma do banco).
 * @param {number} idAtividade - Id da atividade.
 * @param {string} turma - Código da turma.
 * @param {boolean} bloquear - true para bloquear.
 * @throws {Error} Se o banco recusar.
 */
async function gravarBloqueioTurma(idAtividade, turma, bloquear) {
    const resposta = await fetch(SUPABASE.URL + ROTA_DEFINIR_BLOQUEIO_TURMA, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify({ p_atividade: idAtividade, p_turma: turma, p_bloquear: bloquear }),
    });
    if (resposta.ok) return;

    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.message || 'erro ' + resposta.status);
}

/**
 * Grava o bloqueio de UMA atividade só para a turma favorita e atualiza a linha em memória.
 * @param {Object} atividade - Linha da atividade (id, ativo, bloqueio).
 * @param {string} turma - Turma favorita.
 * @param {boolean} bloquear - true para bloquear.
 * @throws {Error} Sem turma favorita ou se o banco recusar.
 */
async function gravarBloqueioAtividade(atividade, turma, bloquear) {
    if (!turma) throw new Error(MSG_SEM_FAVORITA_BLOQUEIO);

    await gravarBloqueioTurma(atividade.id, turma, bloquear);
    const outras = (atividade.bloqueio || []).filter((codigo) => codigo !== turma);
    atividade.bloqueio = bloquear ? outras.concat(turma) : outras;
    if (!bloquear) atividade.ativo = true;
}

/**
 * Professor: desativa (guardando o href) ou reativa um link.
 * @param {HTMLAnchorElement} link - Link do card.
 * @param {boolean} bloquear - true para desativar.
 */
function definirLinkProfessor(link, bloquear) {
    if (bloquear && link.hasAttribute('href')) {
        link.setAttribute(ATRIBUTO_HREF_GUARDADO, link.getAttribute('href'));
        link.removeAttribute('href');
    }
    if (!bloquear && link.hasAttribute(ATRIBUTO_HREF_GUARDADO)) {
        link.setAttribute('href', link.getAttribute(ATRIBUTO_HREF_GUARDADO));
        link.removeAttribute(ATRIBUTO_HREF_GUARDADO);
    }
    link.toggleAttribute('aria-disabled', bloquear);
    link.classList.toggle(CLASSE_LINK_BLOQUEADO_PROFESSOR, bloquear);
    if (bloquear) link.setAttribute('tabindex', '-1');
    else link.removeAttribute('tabindex');
}

/**
 * Professor: aplica ao card o estado das atividades. Todas bloqueadas = card escurecido com
 * todos os links desativados; senão, só os links das atividades bloqueadas.
 * @param {HTMLElement} card - Card do índice.
 * @param {{link: HTMLAnchorElement, bloqueado: boolean}[]} itens - Atividades do card.
 */
function aplicarEstadoCardProfessor(card, itens) {
    const cardBloqueado = atividadesBloqueiamCard() && itens.every((item) => item.bloqueado);
    card.classList.toggle(CLASSE_TEMA_BLOQUEADO_PROFESSOR, cardBloqueado);
    const links = card.querySelectorAll('a[href], a[' + ATRIBUTO_HREF_GUARDADO + ']');
    links.forEach((link) => definirLinkProfessor(link, cardBloqueado));
    if (cardBloqueado) return;

    itens.forEach((item) => definirLinkProfessor(item.link, item.bloqueado));
}

/**
 * Atualiza o visual e a dica do botão ON/OFF.
 * @param {HTMLLabelElement} etiqueta - Botão da atividade.
 * @param {boolean} liberada - true se a atividade está liberada (ON).
 * @param {string} turma - Turma favorita (vazio = sem favorita).
 */
function atualizarInterruptorAtividade(etiqueta, liberada, turma) {
    const prefixo = liberada ? TEXTO_INTERRUPTOR_LIGADO : TEXTO_INTERRUPTOR_DESLIGADO;
    etiqueta.title = turma ? prefixo + turma : TEXTO_SEM_FAVORITA;
    etiqueta.setAttribute('aria-label', etiqueta.title);
}

/**
 * Cria o botão ON/OFF de uma atividade (ON = liberada; OFF = bloqueada para a turma).
 * @param {boolean} liberada - Estado inicial.
 * @param {string} turma - Turma favorita.
 * @param {Function} aoMudar - Chamada async com "bloquear"; se falhar, o botão volta.
 * @returns {HTMLLabelElement} Botão pronto.
 */
function criarInterruptorAtividade(liberada, turma, aoMudar) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'interruptor-atividade';
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = liberada;
    const chave = document.createElement('span');
    chave.className = 'interruptor-atividade__chave';
    atualizarInterruptorAtividade(etiqueta, liberada, turma);
    caixa.addEventListener('change', async () => {
        caixa.disabled = true;
        try {
            await aoMudar(!caixa.checked);
        } catch (erro) {
            caixa.checked = !caixa.checked;
            await garantirPopupBloqueio();
            await mostrarPopup('Não foi possível alterar o bloqueio: ' + erro.message,
                { tipo: 'erro' });
        }
        atualizarInterruptorAtividade(etiqueta, caixa.checked, turma);
        caixa.disabled = false;
    });
    etiqueta.append(caixa, chave);
    return etiqueta;
}

/**
 * Põe o botão ON/OFF logo depois de cada atividade cadastrada do card.
 * @param {HTMLElement} card - Card do índice.
 * @param {Object[]} linhas - Atividades do índice (id, pagina, ativo, bloqueio).
 * @param {string} turma - Turma favorita (vazio = sem favorita).
 */
function montarInterruptoresCard(card, linhas, turma) {
    const itens = [...card.querySelectorAll(SELETOR_LINK_ATIVIDADE_BLOQUEIO)]
        .map((link) => {
            const pagina = caminhoDoLink(link);
            return { link, atividade: linhas.find((linha) => linha.pagina === pagina) };
        })
        .filter((item) => item.atividade);
    if (!itens.length) return;

    itens.forEach((item) => {
        item.bloqueado = estaBloqueadaParaTurma(item.atividade, turma);
        const botao = criarInterruptorAtividade(!item.bloqueado, turma, async (bloquear) => {
            await gravarBloqueioAtividade(item.atividade, turma, bloquear);
            item.bloqueado = bloquear;
            aplicarEstadoCardProfessor(card, itens);
        });
        botao.querySelector('input').disabled =
            card.classList.contains(CLASSE_AULA_TRAVADA_BLOQUEIO);
        item.link.after(botao);
    });
    aplicarEstadoCardProfessor(card, itens);
}

/**
 * Acrescenta (ou refaz) os botões ON/OFF das atividades nos cards do índice (perfil professor).
 */
async function montarInterruptoresBloquear() {
    const cards = [...document.querySelectorAll(SELETOR_CARD_BLOQUEIO)];
    const todas = [...new Set(cards.flatMap(listarPaginasDoCard))];
    if (!todas.length) return;

    const valores = todas.map((pagina) => '"' + pagina.replace(/"/g, '') + '"').join(',');
    const [linhas, turma] = await Promise.all([
        sbGet('atividade',
            'select=id,pagina,ativo,bloqueio&pagina=in.(' + encodeURIComponent(valores) + ')'),
        buscarFavoritaBloqueio(),
    ]);
    // Remove só aqui (depois de ler): remontagens seguidas não duplicam os botões.
    document.querySelectorAll(SELETOR_INTERRUPTOR_ATIVIDADE).forEach((item) => item.remove());
    cards.forEach((card) => montarInterruptoresCard(card, linhas, turma));
}

/**
 * Remonta os botões quando a turma favorita muda ou quando a aula é bloqueada/desbloqueada.
 */
function ouvirTrocaFavoritaBloqueio() {
    const remontar = () => montarInterruptoresBloquear().catch((erro) =>
        console.warn('Bloqueio de atividades indisponível:', erro.message));
    document.addEventListener(EVENTO_FAVORITA_ALTERADA, remontar);
    document.addEventListener(EVENTO_TURMA_INDICE_BLOQUEIO, remontar);
    document.addEventListener(EVENTO_AULA_ALTERADA_BLOQUEIO, remontar);
}

/**
 * Aluno: esconde os botões de atividade de recuperação em que ele não está (o módulo carrega
 * sozinho; sem ele, os botões continuam como estavam e o RLS segue barrando).
 * @param {HTMLAnchorElement[]} links - Botões das atividades dos cards.
 * @returns {Promise<HTMLAnchorElement[]>} Botões que continuam visíveis.
 */
async function ocultarRecuperacaoDeOutroAluno(links) {
    if (!window.RecuperacaoVisibilidade && URL_RECUPERACAO_BLOQUEIO) {
        await new Promise((resolver) => {
            const script = document.createElement('script');
            script.src = URL_RECUPERACAO_BLOQUEIO;
            script.addEventListener('load', resolver);
            script.addEventListener('error', resolver);
            document.head.appendChild(script);
        });
    }
    if (!window.RecuperacaoVisibilidade) return links;

    return window.RecuperacaoVisibilidade.esconderLinksDoAluno(links);
}

/**
 * Aluno e visitante: relê pelo REST (com RLS) as atividades liberadas e trava ou destrava cada
 * botão, sem recarregar. O card nunca some (#281). Reutilizável: é a releitura do tempo real.
 * @returns {Promise<HTMLAnchorElement[]>} Botões que mudaram de estado nesta aplicação.
 */
async function reaplicarBloqueioAluno() {
    const linksDosCards = [...document.querySelectorAll(SELETOR_CARD_BLOQUEIO)]
        .flatMap((card) => [...card.querySelectorAll(SELETOR_LINK_BLOQUEIO)])
        .filter((link) => caminhoDoLinkAluno(link));
    const links = await ocultarRecuperacaoDeOutroAluno(linksDosCards);
    const unicos = [...new Set(links.map(caminhoDoLinkAluno))];
    if (!unicos.length) return [];

    const ativas = await buscarPaginasAtivasBloqueio(unicos);
    if (ativas.size) pastaGerenciadaBloqueio = true;
    // Pasta fora do banco (nenhuma atividade ativa até agora): não trava nada.
    if (!pastaGerenciadaBloqueio) return [];

    // Os cards podem ter sido refeitos durante a leitura: só os botões ainda na página.
    return links.filter((link) => link.isConnected &&
        aplicarEstadoLinkAluno(link, !ativas.has(caminhoDoLinkAluno(link))));
}

/**
 * Nome curto da atividade de um botão, para o aviso.
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @returns {string} Nome (vazio se o botão não tem texto).
 */
function nomeDaAtividadeDoLink(link) {
    const nome = (link.textContent || '').replace(/\s+/g, ' ').trim();
    return nome.length > TAMANHO_MAX_NOME_AVISO
        ? nome.slice(0, TAMANHO_MAX_NOME_AVISO - 1) + '…' : nome;
}

/**
 * Texto do aviso: "Atividade X foi atualizada." para uma atividade, senão o texto geral.
 * @param {HTMLAnchorElement[]} mudados - Botões que mudaram.
 * @returns {string} Texto em português.
 */
function textoAvisoMudancaAluno(mudados) {
    const nomes = [...new Set(mudados.map(nomeDaAtividadeDoLink).filter(Boolean))];
    if (nomes.length !== 1) return TEXTO_AVISO_VARIAS_ATIVIDADES;

    const nome = nomes[0];
    return (/^atividade\b/i.test(nome) ? nome : 'Atividade “' + nome + '”') + ' foi atualizada.';
}

/**
 * Carrega o aviso discreto reutilizável (assets/js/aviso-discreto.js), se ainda não estiver.
 * @returns {Promise<void>} Resolve quando o aviso está disponível (ou se não deu para carregar).
 */
function garantirAvisoDiscretoBloqueio() {
    if (typeof window.mostrarAvisoDiscreto === 'function' || !URL_AVISO_DISCRETO_BLOQUEIO) {
        return Promise.resolve();
    }
    return new Promise((resolver) => {
        const script = document.createElement('script');
        script.src = URL_AVISO_DISCRETO_BLOQUEIO;
        script.addEventListener('load', resolver);
        script.addEventListener('error', resolver);
        document.head.appendChild(script);
    });
}

/**
 * Mostra o aviso discreto quando algum botão mudou (só para mudança vinda do tempo real).
 * @param {HTMLAnchorElement[]} mudados - Botões que mudaram.
 */
async function avisarMudancaAluno(mudados) {
    if (!mudados.length) return;

    await garantirAvisoDiscretoBloqueio();
    if (typeof window.mostrarAvisoDiscreto !== 'function') return;
    window.mostrarAvisoDiscreto(textoAvisoMudancaAluno(mudados));
}

/**
 * Faz a releitura agendada; se outra já estiver em curso, roda mais uma vez no fim (nunca duas
 * leituras ao mesmo tempo).
 */
async function executarReleituraBloqueioAluno() {
    const fila = filaReleituraBloqueio;
    fila.timer = null;
    if (fila.emCurso) {
        fila.pendente = true;
        return;
    }
    const comAviso = fila.comAviso;
    fila.comAviso = false;
    fila.emCurso = true;
    try {
        const mudados = await reaplicarBloqueioAluno();
        if (comAviso) await avisarMudancaAluno(mudados);
    } catch (erro) {
        console.warn('Bloqueio de atividades indisponível:', erro.message);
    }
    fila.emCurso = false;
    if (!fila.pendente) return;
    fila.pendente = false;
    executarReleituraBloqueioAluno();
}

/**
 * Agenda uma releitura do bloqueio do aluno, juntando eventos seguidos numa leitura só (.15).
 * @param {string} origem - ORIGEM_REALTIME_BLOQUEIO (mostra o aviso), o evento de cards montados
 *     (sem espera) ou outro evento da página.
 */
function agendarReleituraBloqueioAluno(origem) {
    const fila = filaReleituraBloqueio;
    if (origem === ORIGEM_REALTIME_BLOQUEIO) fila.comAviso = true;
    const esperas = { [EVENTO_CARDS_MONTADOS_BLOQUEIO]: 0,
        [ORIGEM_REALTIME_BLOQUEIO]: ESPERA_RELEITURA_REALTIME_BLOQUEIO_MS };
    const espera = esperas[origem] ?? ESPERA_JUNTAR_RELEITURA_BLOQUEIO_MS;
    clearTimeout(fila.timer);
    fila.timer = setTimeout(executarReleituraBloqueioAluno, espera);
}

/**
 * Aluno: liga o evento do tempo real e os eventos da página à mesma fila de releitura.
 */
function ouvirReleiturasAluno() {
    document.addEventListener(EVENTO_STATUS_ATIVIDADES_BLOQUEIO,
        () => agendarReleituraBloqueioAluno(ORIGEM_REALTIME_BLOQUEIO));
    [EVENTO_CARDS_MONTADOS_BLOQUEIO, EVENTO_FAVORITA_ALTERADA, EVENTO_TURMA_INDICE_BLOQUEIO,
        EVENTO_AULA_ALTERADA_BLOQUEIO].forEach((nome) => {
        document.addEventListener(nome, () => agendarReleituraBloqueioAluno(nome));
    });
}

/**
 * Inicia o bloqueio. Falhas de rede não quebram o índice.
 */
async function iniciarBloqueioAtividades() {
    try {
        if (await usuarioEhProfessorBloqueio()) {
            document.querySelectorAll(SELETOR_CARD_SOMENTE_PROFESSOR).forEach((card) => {
                card.hidden = false;
            });
            ouvirTrocaFavoritaBloqueio();
            await montarInterruptoresBloquear();
            return;
        }
        ouvirReleiturasAluno();
        filaReleituraBloqueio.emCurso = true;
        await reaplicarBloqueioAluno();
    } catch (erro) {
        console.warn('Bloqueio de atividades indisponível:', erro.message);
    }
    finalizarPrimeiraLeituraAluno();
}

/**
 * Libera a fila depois da primeira leitura do aluno (e roda a releitura que chegou no meio).
 */
function finalizarPrimeiraLeituraAluno() {
    const fila = filaReleituraBloqueio;
    if (!fila.emCurso) return;
    fila.emCurso = false;
    if (!fila.pendente) return;
    fila.pendente = false;
    executarReleituraBloqueioAluno();
}

// Reutilizável por outros módulos (ex.: releitura pedida pelo tempo real ou pela página).
window.reaplicarBloqueioAtividadesAluno = reaplicarBloqueioAluno;

iniciarBloqueioAtividades();
