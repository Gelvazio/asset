// Coluna "Fez Atividade? (Sim/Não)" em cada card do ATIVIDADES/index.html, com filtro, e as cores
// de cada botão de atividade pelo andamento do aluno (#283): entregue = verde claro; começou e não
// entregou = amarelo (o de hoje); não fez nada = vermelho fraco piscando (CSS).
// Para o aluno logado: "Sim" se ele já respondeu pelo menos 1 vez (qualquer alternativa gravada
// no banco); "Não" caso contrário. Só JavaScript: lê as tabelas atividade, resposta_atividade e
// entrega_atividade (o RLS devolve ao aluno apenas as próprias respostas/entregas). Professor e
// visitante não veem a coluna nem as cores. O card inteiro também é pintado (#325): verde se o
// aluno entregou todas as atividades cadastradas dele, vermelho piscando se falta alguma.
// Cards informativos (data-sem-bloqueio, ex.: composição
// da nota) não recebem a marca nem somem no filtro.
// Carregado por assets/js/atividades-crud-modal.js, que já está em todo índice de atividades.
// Depende de: supabase-js e js/supabase.js (obterClienteSupabase, sbGet).
// Tempo real (REALTIME-STATUS-ATIVIDADES.11): quando o indice-atividades-bloqueio.js trava ou
// destrava um botão (aria-disabled), a marcação é refeita com os estados já lidos; só a atividade
// destravada que ainda não foi lida (estava bloqueada na abertura, o RLS a escondia) é buscada,
// uma vez só por aviso. A repintura mexe só no que mudou (sem trocar elementos: não pisca).

const SELETOR_CARD_FEITAS = 'article.aula:not([data-sem-bloqueio])';
const SELETOR_LINK_FEITAS = 'a.btn.principal';
const CLASSE_MARCA_FEITAS = 'marca-feita';
const CLASSE_ATIVIDADE_FEITA = 'atividade--feita';
const CLASSE_ATIVIDADE_PENDENTE = 'atividade--pendente';
// Entregue pelo professor porque o aluno faltou (Faltou?): amarelo claro com a observação.
const CLASSE_ATIVIDADE_POR_FALTA = 'atividade--entregue-por-falta';
const CLASSE_ATIVIDADE_NAO_FEITA = 'atividade--nao-feita';
// Guardado pelo indice-atividades-bloqueio.js quando o aluno não pode abrir a atividade (#281).
const ATRIBUTO_HREF_GUARDADO_FEITAS = 'data-href-bloqueado';
// Cor do card inteiro (#325): mesmas classes do professor (css/indice-atividades-pendentes.css).
const CLASSE_CARD_CONCLUIDO_FEITAS = 'card-atividade-concluida';
const CLASSE_CARD_PENDENTE_FEITAS = 'card-atividade-pendente';
const CLASSE_AVISO_OCULTO_FEITAS = 'aviso-pendente-oculto';
const CLASSE_AVISO_SITUACAO_FEITAS = 'aviso-situacao-feitas';
const TEXTO_AVISO_PENDENTE_FEITAS = 'Você tem atividade pendente nesta aula.';
const TEXTO_AVISO_CONCLUIDO_FEITAS = 'Você entregou todas as atividades desta aula.';
// Classe do <body> do aluno: tira a cor do card inteiro e deixa só a dos botões.
const CLASSE_CORPO_SO_BOTOES_FEITAS = 'indice-aluno-so-botoes';
// Classe que o indice-atividades-bloqueio.js põe no botão bloqueado para o aluno.
const CLASSE_LINK_BLOQUEADO_FEITAS = 'atividade--bloqueada-para-aluno';
// Último resultado lido do banco e o observador do bloqueio (para refazer a marcação sem rede).
let estadoMarcacaoFeitas = null;
let observadorBloqueioFeitas = null;
// Páginas já buscadas de novo depois de destravar (evita repetir a leitura); zera a cada aviso.
const paginasRelidasFeitas = new Set();
const EVENTO_STATUS_ATIVIDADES_FEITAS = 'atividades-status-alterado';
const CLASSES_COR_LINK_FEITAS = ['atividade--feita', 'atividade--pendente',
    'atividade--nao-feita', 'atividade--entregue-por-falta'];
const FILTRO_TODAS_FEITAS = 'todas';
const FILTRO_SIM_FEITAS = 'sim';
const FILTRO_NAO_FEITAS = 'nao';
const LIMITE_RESPOSTAS_FEITAS = 5000;
const CLASSE_BARRA_FEITAS = 'filtro-feitas';
// A sessão do Supabase pode demorar a ficar pronta na abertura da página: o perfil é tentado de
// novo algumas vezes antes de desistir (senão a cor não seria aplicada).
const TENTATIVAS_PERFIL_FEITAS = 10;
const ESPERA_PERFIL_FEITAS = 300;
// Disparado pelo indice-aula-data.js quando a grade só do banco fica pronta (#272): os cards são
// novos, então a marca e as cores são refeitas neles.
const EVENTO_CARDS_MONTADOS_FEITAS = 'cards-aula-montados';

/**
 * Descobre o perfil do usuário logado.
 * @returns {Promise<string|null>} Perfil (ALUNO/PROFESSOR) ou null se não há login.
 */
async function obterPerfilFeitas() {
    const cliente = obterClienteSupabase();
    if (!cliente) return null;

    const { data } = await cliente.auth.getSession();
    const usuario = data?.session?.user;
    return usuario ? (usuario.app_metadata?.perfil || 'ALUNO') : null;
}

/**
 * Descobre o perfil do usuário logado, esperando a sessão ficar pronta na abertura da página.
 * @returns {Promise<string|null>} Perfil (ALUNO/PROFESSOR) ou null se não há login.
 */
async function aguardarPerfilFeitas() {
    for (let tentativa = 0; tentativa < TENTATIVAS_PERFIL_FEITAS; tentativa += 1) {
        const perfil = await obterPerfilFeitas();
        if (perfil) return perfil;
        await new Promise((resolver) => setTimeout(resolver, ESPERA_PERFIL_FEITAS));
    }
    return null;
}

/**
 * Converte o href de um link em caminho (pathname) decodificado, se for página HTML.
 * @param {string} href - Valor do atributo href.
 * @returns {string|null} Caminho da página ou null.
 */
function obterCaminhoFeitas(href) {
    if (!href) return null;

    const caminho = decodeURIComponent(new URL(href, location.href).pathname);
    return caminho.toLowerCase().endsWith('.html') ? caminho : null;
}

/**
 * Caminho da página de um link de atividade, mesmo quando o bloqueio já tirou o href (#281).
 * @param {HTMLAnchorElement} link - Link da atividade.
 * @returns {string|null} Caminho da página ou null.
 */
function obterPaginaDoLinkFeitas(link) {
    // Card sem botão de atividade não pode derrubar a marcação dos demais cards.
    if (!link) return null;

    return obterCaminhoFeitas(link.getAttribute('href') ||
        link.getAttribute(ATRIBUTO_HREF_GUARDADO_FEITAS));
}

/**
 * Descobre, por página de atividade, se o aluno já entregou e se já respondeu algo.
 * @param {string[]} paginas - Caminhos das atividades do índice.
 * @returns {Promise<{paginas: Set<string>, entregues: Set<string>, respondidas: Set<string>,
 *     porFalta: Map<string, string>}>} Páginas cadastradas no banco, entregues, com resposta e
 *     entregues por falta (página -> observação).
 */
async function buscarEstadosFeitas(paginas) {
    const vazio = { paginas: new Set(), entregues: new Set(), respondidas: new Set(),
        porFalta: new Map() };
    if (!paginas.length) return vazio;

    const valores = paginas.map((pagina) => '"' + pagina.replace(/"/g, '') + '"').join(',');
    const atividades = await sbGet('atividade',
        'select=id,pagina&pagina=in.(' + encodeURIComponent(valores) + ')');
    const ids = atividades.map((atividade) => atividade.id);
    if (!ids.length) return vazio;

    const filtro = 'atividade_id=in.(' + ids.join(',') + ')';
    const [respostas, entregas, dinamicas, discursivas, faltas] = await Promise.all([
        sbGet('resposta_atividade', 'select=atividade_id&' + filtro +
            '&limit=' + LIMITE_RESPOSTAS_FEITAS),
        // Se a leitura das entregas falhar, a cor ainda sai pelo que foi respondido.
        sbGet('entrega_atividade', 'select=atividade_id&' + filtro).catch(() => []),
        // Atividade Dinâmica não grava em resposta_atividade nem em entrega_atividade: a entrega
        // dela fica em entrega_dinamica (entregue = true quando o aluno entregou).
        sbGet('entrega_dinamica', 'select=atividade_id,entregue&' + filtro).catch(() => []),
        // A atividade prática (discursiva) grava as respostas em resposta_discursiva.
        sbGet('resposta_discursiva', 'select=atividade_id&' + filtro +
            '&limit=' + LIMITE_RESPOSTAS_FEITAS).catch(() => []),
        // Entregue por falta: a observação do professor (RLS: o aluno lê só a dele).
        sbGet('falta_entrega_atividade', 'select=atividade_id,observacao&' + filtro)
            .catch(() => []),
    ]);
    const paginaPorId = new Map(atividades.map((atividade) => [atividade.id, atividade.pagina]));
    const paginasDe = (linhas) => new Set(
        linhas.map((linha) => paginaPorId.get(linha.atividade_id)).filter(Boolean));
    const dinamicasEntregues = dinamicas.filter((linha) => linha.entregue);
    return {
        paginas: new Set(atividades.map((atividade) => atividade.pagina)),
        entregues: paginasDe([...entregas, ...dinamicasEntregues]),
        respondidas: paginasDe([...respostas, ...discursivas, ...dinamicas]),
        porFalta: new Map(faltas.map((linha) =>
            [paginaPorId.get(linha.atividade_id), linha.observacao])),
    };
}

/**
 * Escolhe a classe de cor do botão pelo andamento do aluno na página.
 * @param {string} pagina - Caminho da página da atividade.
 * @param {Object} estados - Estados do aluno (buscarEstadosFeitas).
 * @returns {string} Classe CSS do botão.
 */
function classeDoLinkFeitas(pagina, estados) {
    if (estados.porFalta?.has(pagina) && estados.entregues.has(pagina)) {
        return CLASSE_ATIVIDADE_POR_FALTA;
    }
    if (estados.entregues.has(pagina)) return CLASSE_ATIVIDADE_FEITA;
    if (estados.respondidas.has(pagina)) return CLASSE_ATIVIDADE_PENDENTE;
    return CLASSE_ATIVIDADE_NAO_FEITA;
}

/**
 * Deixa no botão só a classe de cor pedida, mexendo apenas no que muda (a animação do vermelho
 * piscando não reinicia quando a cor continua a mesma).
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @param {string|null} classe - Classe de cor (null = sem cor).
 */
function definirCorDoLinkFeitas(link, classe) {
    CLASSES_COR_LINK_FEITAS.forEach((item) => {
        if (item !== classe && link.classList.contains(item)) link.classList.remove(item);
    });
    if (classe && !link.classList.contains(classe)) link.classList.add(classe);
}

/**
 * Pinta cada botão de atividade do card pelo andamento do aluno (#283): entregue (verde claro),
 * começou e não entregou (amarelo de hoje) ou não fez nada (vermelho fraco piscando). Só pinta
 * páginas cadastradas no banco; os demais links do card ficam como estão.
 * @param {HTMLElement} card - Card do índice.
 * @param {{paginas: Set<string>, entregues: Set<string>, respondidas: Set<string>}} estados
 */
function marcarLinksDoCard(card, estados) {
    card.querySelectorAll(SELETOR_LINK_FEITAS).forEach((link) => {
        if (!estaLiberadoFeitas(link)) {
            // Atividade bloqueada para o aluno não entra na cor nem na conta.
            definirCorDoLinkFeitas(link, null);
            return;
        }
        const pagina = obterPaginaDoLinkFeitas(link);
        if (!pagina || !estados.paginas.has(pagina)) return;
        const classe = classeDoLinkFeitas(pagina, estados);
        definirCorDoLinkFeitas(link, classe);
        if (classe === CLASSE_ATIVIDADE_POR_FALTA) link.title = estados.porFalta.get(pagina);
    });
}

/**
 * Pinta o card inteiro pela situação do aluno (#325): verde se entregou todas as atividades
 * cadastradas do card (a nota não importa), vermelho piscando se falta alguma, sem cor se o card
 * não tem atividade cadastrada. As classes e o CSS são os mesmos do professor.
 * @param {HTMLElement} card - Card do índice.
 * @param {{paginas: Set<string>, entregues: Set<string>, respondidas: Set<string>}} estados
 */
function pintarCardSituacaoFeitas(card, estados) {
    const paginasDoCard = listarPaginasLiberadasDoCardFeitas(card)
        .filter((pagina) => estados.paginas.has(pagina));
    const entregouTudo = paginasDoCard.every((pagina) => estados.entregues.has(pagina));
    const classe = !paginasDoCard.length ? null
        : (entregouTudo ? CLASSE_CARD_CONCLUIDO_FEITAS : CLASSE_CARD_PENDENTE_FEITAS);
    const texto = entregouTudo ? TEXTO_AVISO_CONCLUIDO_FEITAS : TEXTO_AVISO_PENDENTE_FEITAS;
    const atual = card.querySelector('.' + CLASSE_AVISO_SITUACAO_FEITAS);
    // Nada mudou: não troca o aviso nem a classe (sem piscar na repintura do tempo real).
    if (classe && card.classList.contains(classe) && atual?.textContent === texto) return;

    card.classList.remove(CLASSE_CARD_CONCLUIDO_FEITAS, CLASSE_CARD_PENDENTE_FEITAS);
    atual?.remove();
    if (!classe) return;

    card.classList.add(classe);
    const aviso = document.createElement('span');
    aviso.className = CLASSE_AVISO_SITUACAO_FEITAS + ' ' + CLASSE_AVISO_OCULTO_FEITAS;
    aviso.textContent = entregouTudo ? TEXTO_AVISO_CONCLUIDO_FEITAS : TEXTO_AVISO_PENDENTE_FEITAS;
    card.prepend(aviso);
}

/**
 * Acrescenta ao card a marca "Fez Atividade? Sim/Não".
 * @param {HTMLElement} card - Card do índice.
 * @param {boolean} fez - Se o aluno já respondeu ao menos 1 vez.
 */
function marcarCardFeitas(card, fez) {
    const valor = fez ? FILTRO_SIM_FEITAS : FILTRO_NAO_FEITAS;
    const atual = card.querySelector('.' + CLASSE_MARCA_FEITAS);
    // Mesma marca já na tela: não troca o elemento (sem piscar).
    if (atual && card.dataset.fez === valor) return;

    atual?.remove();
    card.dataset.fez = fez ? FILTRO_SIM_FEITAS : FILTRO_NAO_FEITAS;
    const marca = document.createElement('p');
    marca.className = CLASSE_MARCA_FEITAS + ' ' + CLASSE_MARCA_FEITAS + (fez ? '--sim' : '--nao');
    marca.textContent = 'Fez Atividade? ' + (fez ? '✅ Sim' : '❌ Não');
    const meta = card.querySelector('.meta') || card.querySelector('.topo');
    if (meta) meta.after(marca);
    else card.prepend(marca);
}

/**
 * Mostra só os cards do filtro escolhido (Todas, Sim ou Não).
 * @param {string} valor - Filtro escolhido.
 */
function aplicarFiltroFeitas(valor) {
    document.querySelectorAll(SELETOR_CARD_FEITAS).forEach((card) => {
        card.hidden = valor !== FILTRO_TODAS_FEITAS && card.dataset.fez !== valor;
    });
}

/**
 * Cria a barra de filtro "Fez Atividade?" antes da grade de cards.
 */
function montarFiltroFeitas() {
    const grade = document.querySelector('.grade');
    const jaTemBarra = Boolean(document.querySelector('.' + CLASSE_BARRA_FEITAS));
    if (!grade || jaTemBarra) return;

    const barra = document.createElement('div');
    barra.className = CLASSE_BARRA_FEITAS;
    const rotulo = document.createElement('label');
    rotulo.textContent = 'Fez Atividade? ';
    const lista = document.createElement('select');
    [[FILTRO_TODAS_FEITAS, 'Todas'], [FILTRO_SIM_FEITAS, 'Sim'], [FILTRO_NAO_FEITAS, 'Não']]
        .forEach(([valor, texto]) => lista.add(new Option(texto, valor)));
    lista.addEventListener('change', () => aplicarFiltroFeitas(lista.value));
    rotulo.append(lista);
    barra.append(rotulo);
    grade.before(barra);
}

/**
 * Lista as páginas de TODOS os botões de atividade dos cards (prática, objetiva, dinâmica...),
 * sem repetir, para o banco dizer o que o aluno respondeu e entregou em cada uma.
 * @param {HTMLElement[]} cards - Cards do índice.
 * @returns {string[]} Caminhos das páginas.
 */
function listarPaginasDosBotoesFeitas(cards) {
    const paginas = cards.flatMap((card) =>
        [...card.querySelectorAll(SELETOR_LINK_FEITAS)].map(obterPaginaDoLinkFeitas));
    return [...new Set(paginas.filter(Boolean))];
}

/**
 * Diz se a atividade está liberada para o aluno (o bloqueio marca o link bloqueado).
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @returns {boolean} true se não está bloqueada.
 */
function estaLiberadoFeitas(link) {
    return !link.classList.contains(CLASSE_LINK_BLOQUEADO_FEITAS);
}

/**
 * Páginas das atividades LIBERADAS do card (as bloqueadas não contam).
 * @param {HTMLElement} card - Card do índice.
 * @returns {string[]} Caminhos das páginas liberadas.
 */
function listarPaginasLiberadasDoCardFeitas(card) {
    return [...card.querySelectorAll(SELETOR_LINK_FEITAS)].filter(estaLiberadoFeitas)
        .map(obterPaginaDoLinkFeitas).filter(Boolean);
}

/**
 * Marca "Fez Atividade?" do card pelas atividades liberadas: Sim se todas as liberadas já foram
 * entregues ou respondidas; sem atividade liberada, o card fica sem a marca.
 * @param {HTMLElement} card - Card do índice.
 * @param {{entregues: Set<string>, respondidas: Set<string>}} estados - Estados do aluno.
 */
function marcarFezPelasLiberadasFeitas(card, estados) {
    const liberadas = listarPaginasLiberadasDoCardFeitas(card);
    if (!liberadas.length) {
        card.querySelector('.' + CLASSE_MARCA_FEITAS)?.remove();
        delete card.dataset.fez;
        return;
    }
    const fez = liberadas.every((pagina) =>
        estados.entregues.has(pagina) || estados.respondidas.has(pagina));
    marcarCardFeitas(card, fez);
}

/**
 * Aplica marca, cores dos botões e cor do card em todos os cards, só pelas atividades liberadas.
 * @param {HTMLElement[]} cards - Cards do índice.
 * @param {Object} estados - Estados do aluno (buscarEstadosFeitas).
 */
function aplicarMarcacaoFeitas(cards, estados) {
    cards.forEach((card) => {
        marcarFezPelasLiberadasFeitas(card, estados);
        marcarLinksDoCard(card, estados);
        pintarCardSituacaoFeitas(card, estados);
    });
}

/**
 * Páginas liberadas na tela que não estão nos estados lidos (estavam bloqueadas na leitura) e
 * que ainda não foram buscadas de novo desde o último aviso.
 * @returns {string[]} Caminhos que precisam de leitura.
 */
function listarPaginasSemEstadoFeitas() {
    const { cards, estados } = estadoMarcacaoFeitas;
    const liberadas = cards.flatMap(listarPaginasLiberadasDoCardFeitas);
    return [...new Set(liberadas)].filter((pagina) =>
        !estados.paginas.has(pagina) && !paginasRelidasFeitas.has(pagina));
}

/**
 * Junta nos estados já lidos os de páginas lidas agora (só as que faltavam).
 * @param {Object} estados - Estados em memória (alterados aqui).
 * @param {Object} novos - Estados das páginas lidas agora (buscarEstadosFeitas).
 */
function juntarEstadosFeitas(estados, novos) {
    ['paginas', 'entregues', 'respondidas'].forEach((chave) =>
        novos[chave].forEach((pagina) => estados[chave].add(pagina)));
    novos.porFalta.forEach((observacao, pagina) => estados.porFalta.set(pagina, observacao));
}

/**
 * Busca só as atividades destravadas que ainda não foram lidas e junta aos estados.
 * @returns {Promise<void>} Resolve depois da leitura (ou na hora, se não falta nada).
 */
async function completarEstadosFeitas() {
    const faltando = listarPaginasSemEstadoFeitas();
    if (!faltando.length) return;

    faltando.forEach((pagina) => paginasRelidasFeitas.add(pagina));
    const novos = await buscarEstadosFeitas(faltando);
    juntarEstadosFeitas(estadoMarcacaoFeitas.estados, novos);
}

/**
 * Refaz marca, cores e filtro com os estados em memória (lendo antes só o que falta).
 */
async function repintarMarcacaoFeitas() {
    try {
        await completarEstadosFeitas();
    } catch (erro) {
        console.warn('Marcação "Fez Atividade?" incompleta:', erro.message);
    }
    aplicarMarcacaoFeitas(estadoMarcacaoFeitas.cards, estadoMarcacaoFeitas.estados);
    const filtro = document.querySelector('.' + CLASSE_BARRA_FEITAS + ' select');
    if (filtro) aplicarFiltroFeitas(filtro.value);
}

/**
 * O bloqueio das atividades chega depois da leitura do banco: quando um link ganha ou perde o
 * aria-disabled (bloqueio do aluno, também ao vivo), a marcação é refeita num quadro só.
 */
function ligarObservadorBloqueioFeitas() {
    if (observadorBloqueioFeitas) return;

    let agendado = false;
    observadorBloqueioFeitas = new MutationObserver(() => {
        if (agendado || !estadoMarcacaoFeitas) return;
        agendado = true;
        requestAnimationFrame(() => {
            agendado = false;
            repintarMarcacaoFeitas();
        });
    });
    observadorBloqueioFeitas.observe(document.body,
        { attributes: true, subtree: true, attributeFilter: ['aria-disabled'] });
    // Novo aviso do tempo real: a atividade destravada pode ser lida de novo uma vez.
    document.addEventListener(EVENTO_STATUS_ATIVIDADES_FEITAS, () => paginasRelidasFeitas.clear());
}

/**
 * Inicia a marcação: só para aluno logado; falhas de rede não quebram o índice.
 */
async function iniciarMarcacaoFeitas() {
    try {
        if (await aguardarPerfilFeitas() !== 'ALUNO') return;

        // Só os botões ficam coloridos; o card inteiro mantém o fundo normal (CSS por esta classe).
        document.body.classList.add(CLASSE_CORPO_SO_BOTOES_FEITAS);
        const cards = [...document.querySelectorAll(SELETOR_CARD_FEITAS)];
        const estados = await buscarEstadosFeitas(listarPaginasDosBotoesFeitas(cards));
        estadoMarcacaoFeitas = { cards, estados };
        aplicarMarcacaoFeitas(cards, estados);
        montarFiltroFeitas();
        ligarObservadorBloqueioFeitas();
    } catch (erro) {
        console.warn('Marcação "Fez Atividade?" indisponível:', erro.message);
    }
}

document.addEventListener(EVENTO_CARDS_MONTADOS_FEITAS, iniciarMarcacaoFeitas);
// Rede de segurança: se o evento da grade chegar antes deste módulo, o fim do carregamento pinta.
window.addEventListener('load', () => iniciarMarcacaoFeitas());
iniciarMarcacaoFeitas();
