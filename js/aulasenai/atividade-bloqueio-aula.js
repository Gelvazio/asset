// Bloqueio da página de atividade (objetiva e prática) quando a aula ou a atividade está
// bloqueada. Vale só nas matérias com o bloqueio da aula ligado
// (assets/js/indice-bloqueio-aula-config.js, carregado antes deste script).
// Quem decide é o RLS da tabela atividade: o aluno só lê a atividade liberada para ele (a aula
// bloqueada bloqueia todas as atividades dela pelo trigger do banco); o professor lê todas.
// Se a atividade desta página não vier do banco, o conteúdo fica escondido, os links dos slides
// (PDF) somem e aparece o aviso. Enquanto o banco é consultado, o conteúdo também fica escondido
// (sem isso, o aluno abria os slides antes da conferência). Falha na consulta libera a página.
// Ao vivo (REALTIME-STATUS-ATIVIDADES.13): com a página aberta, o aviso
// 'atividades-status-alterado' (assets/js/realtime-atividades.js, carregado aqui se a página não
// o tiver) faz reler a atividade.
// Bloqueada agora: aviso em popup (assets/js/popup.js) e na página, a edição é TRAVADA (campos e
// botões desabilitados) e, ao fechar o popup, o aluno volta ao índice das atividades (a página
// "fecha"); o que já foi respondido está no banco e volta quando o professor liberar. Se o
// índice não for achado, a página fica travada. Liberada de novo: destrava e avisa. Página que
// abriu bloqueada
// (conteúdo nunca mostrado): ao ser liberada, avisa e recarrega. Só LÊ o banco e nunca dispara o
// aviso do Realtime: sem loop. O RLS continua recusando gravação de atividade bloqueada.
// Depende de: js/supabase.js (sbGet, obterClienteSupabase). Carregado pelas páginas geradas por
// assets/gerador-atividades/gerar_atividades.py e
// assets/gerador-avaliacao-discursiva/template_avaliacao_discursiva.html.

const TABELA_ATIVIDADE_PAGINA_BLOQUEIO = 'atividade';
const SELETOR_CONTAINER_PAGINA_BLOQUEIO = '.container';
const SELETOR_LINKS_SLIDES_PAGINA_BLOQUEIO = 'a[href$=".pdf" i]';
const CLASSE_AVISO_PAGINA_BLOQUEIO = 'aula-card';
const TITULO_AVISO_PAGINA_BLOQUEIO = '🔒 Aula Bloqueada!';
const TEXTO_AVISO_PAGINA_BLOQUEIO = 'Esta aula ou atividade está bloqueada pelo professor. ' +
    'Volte ao índice e aguarde a liberação.';
// atividade.pagina é gravada a partir de /MATERIAIS/ e com .html; o endereço aberto pode vir em
// minúsculas, sem .html ou com uma pasta antes (servidor local), e a comparação exata falhava (#285).
const PASTA_RAIZ_PAGINA_BLOQUEIO = '/materiais/';
const EXTENSAO_PAGINA_BLOQUEIO = '.html';
// Ao vivo (.13).
const ENDERECO_SCRIPT_PAGINA_BLOQUEIO = document.currentScript ? document.currentScript.src : '';
const EVENTO_STATUS_PAGINA_BLOQUEIO = 'atividades-status-alterado';
const TABELA_AULAS_PAGINA_BLOQUEIO = 'aulas';
const TABELA_MATERIA_PAGINA_BLOQUEIO = 'materia';
const PASTA_ATIVIDADES_PAGINA_BLOQUEIO = 'ATIVIDADES';
const ATRIBUTO_TRAVA_PAGINA_BLOQUEIO = 'data-trava-ao-vivo';
const ATRIBUTO_AVISO_PAGINA_BLOQUEIO = 'data-aviso-ao-vivo';
const SELETOR_CONTROLES_PAGINA_BLOQUEIO = 'input, textarea, select, button';
const SELETOR_CLIQUE_TRAVADO_PAGINA_BLOQUEIO = 'input, textarea, select, button, label';
const TITULO_TRAVA_PAGINA_BLOQUEIO = '🔒 Atividade bloqueada pelo professor';
const TEXTO_TRAVA_PAGINA_BLOQUEIO = 'O professor bloqueou esta atividade agora. O que você já ' +
    'respondeu está salvo: quando ela for liberada, você continua de onde parou. Você será ' +
    'levado de volta ao índice das atividades.';
// Pasta dos índices: .../<MATERIA>/ATIVIDADES/index.html.
const ARQUIVO_INDICE_PAGINA_BLOQUEIO = 'index.html';
const TITULO_LIBERADA_PAGINA_BLOQUEIO = 'Atividade liberada';
const TEXTO_LIBERADA_PAGINA_BLOQUEIO = 'O professor liberou esta atividade de novo. ' +
    'Você já pode continuar respondendo.';
const TEXTO_RECARREGAR_PAGINA_BLOQUEIO = 'O professor liberou esta atividade. ' +
    'A página será recarregada para mostrar o conteúdo.';
// materiaId: matéria do canal; abriuBloqueada: conteúdo nunca mostrado; travada: edição travada.
const estadoPaginaBloqueio = { materiaId: null, abriuBloqueada: false, travada: false,
    relendo: false, deNovo: false };

/**
 * Diz se o bloqueio da aula vale nesta página (matéria listada na configuração).
 * @returns {boolean} true se ligado.
 */
function bloqueioAulaLigadoNaPagina() {
    return typeof bloqueioDeAulaLigado === 'function' && bloqueioDeAulaLigado();
}

/**
 * Partes da página que mostram a atividade (tudo no container, menos o cabeçalho).
 * @returns {HTMLElement[]} Elementos do conteúdo.
 */
function listarConteudoDaPagina() {
    const container = document.querySelector(SELETOR_CONTAINER_PAGINA_BLOQUEIO);
    if (!container) return [];

    return [...container.children].filter((elemento) => elemento.tagName !== 'HEADER');
}

/**
 * Esconde ou mostra o conteúdo da atividade.
 * @param {boolean} esconder - true para esconder.
 */
function esconderConteudoDaPagina(esconder) {
    // display em vez de hidden: o CSS da página (display: flex/grid) venceria o atributo hidden.
    const exibicao = esconder ? 'none' : '';
    listarConteudoDaPagina().forEach((elemento) => { elemento.style.display = exibicao; });
}

/**
 * Caminho desta página no formato de atividade.pagina: a partir de /MATERIAIS/ e com .html.
 * @returns {string} Caminho normalizado (maiúsculas e minúsculas ficam para o ilike).
 */
function obterCaminhoDaPaginaBloqueio() {
    const caminho = decodeURIComponent(location.pathname);
    const inicio = caminho.toLowerCase().indexOf(PASTA_RAIZ_PAGINA_BLOQUEIO);
    const relativo = inicio >= 0 ? caminho.slice(inicio) : caminho;
    const temExtensao = relativo.toLowerCase().endsWith(EXTENSAO_PAGINA_BLOQUEIO);
    if (temExtensao) return relativo;

    return relativo + EXTENSAO_PAGINA_BLOQUEIO;
}

/**
 * Diz se o usuário logado consegue ler a atividade desta página (RLS do banco).
 * @returns {Promise<boolean>} true se a atividade veio do banco.
 * @throws {Error} Se a consulta falhar.
 */
async function atividadeDaPaginaLiberada() {
    return Boolean(await lerAtividadeDaPagina());
}

/**
 * Lê a atividade desta página como o usuário logado a vê (RLS do banco).
 * @returns {Promise<{id: number, aula_id: ?number}|null>} Atividade, ou null se bloqueada.
 * @throws {Error} Se a consulta falhar.
 */
async function lerAtividadeDaPagina() {
    // ilike sem curinga = igual sem diferenciar maiúsculas; o "_" escapado não vira curinga.
    const pagina = obterCaminhoDaPaginaBloqueio().replace(/_/g, '\\_');
    const filtro = 'pagina=ilike.' + encodeURIComponent(pagina);
    const linhas = await sbGet(TABELA_ATIVIDADE_PAGINA_BLOQUEIO, 'select=id,aula_id&' + filtro);
    return linhas[0] || null;
}

/**
 * Mostra o aviso de bloqueio no lugar do conteúdo e tira os links dos slides da página.
 */
function mostrarAvisoBloqueioPagina() {
    const linksDosSlides = document.querySelectorAll(SELETOR_LINKS_SLIDES_PAGINA_BLOQUEIO);
    linksDosSlides.forEach((link) => link.remove());
    const container = document.querySelector(SELETOR_CONTAINER_PAGINA_BLOQUEIO);
    if (!container) return;

    const aviso = document.createElement('section');
    aviso.className = CLASSE_AVISO_PAGINA_BLOQUEIO;
    const titulo = document.createElement('h2');
    titulo.textContent = TITULO_AVISO_PAGINA_BLOQUEIO;
    const texto = document.createElement('p');
    texto.textContent = TEXTO_AVISO_PAGINA_BLOQUEIO;
    aviso.append(titulo, texto);
    const cabecalho = container.querySelector('header');
    if (cabecalho) {
        cabecalho.after(aviso);
        return;
    }
    container.prepend(aviso);
}

/**
 * Confere o bloqueio da página: esconde o conteúdo, consulta o banco e libera ou bloqueia.
 */
async function iniciarBloqueioDaPagina() {
    if (!bloqueioAulaLigadoNaPagina()) return;

    esconderConteudoDaPagina(true);
    let atividade = null;
    let liberada = true;
    try {
        atividade = await lerAtividadeDaPagina();
        liberada = Boolean(atividade);
    } catch (erro) {
        console.warn('Bloqueio da aula não conferido:', erro.message);
    }
    if (liberada) esconderConteudoDaPagina(false);
    else mostrarAvisoBloqueioPagina();
    estadoPaginaBloqueio.abriuBloqueada = !liberada;
    // A matéria é lida AO ABRIR, enquanto a atividade ainda é visível (antes de um bloqueio).
    const materiaId = await descobrirMateriaDaPaginaBloqueio(atividade);
    if (materiaId) ligarAoVivoDaPagina(materiaId);
}

/**
 * Id da matéria da página: pela aula da atividade (aulas.materia_id) ou, se a atividade não
 * veio (página aberta bloqueada), pelo nome da pasta da matéria (só se achar uma matéria só).
 * @param {{aula_id: ?number}|null} atividade - Atividade lida ao abrir.
 * @returns {Promise<number|null>} Id da matéria ou null (sem ao vivo nesta página).
 */
async function descobrirMateriaDaPaginaBloqueio(atividade) {
    try {
        if (atividade?.aula_id) {
            const aulas = await sbGet(TABELA_AULAS_PAGINA_BLOQUEIO,
                'select=materia_id&id=eq.' + encodeURIComponent(atividade.aula_id));
            if (aulas[0]?.materia_id) return Number(aulas[0].materia_id);
        }
        const nome = lerNomeMateriaDaPaginaBloqueio();
        if (!nome) return null;
        const materias = await sbGet(TABELA_MATERIA_PAGINA_BLOQUEIO,
            'select=id&descricao=ilike.' + encodeURIComponent(nome.replace(/_/g, '\\_')));
        return materias.length === 1 ? Number(materias[0].id) : null;
    } catch (erro) {
        console.warn('Ao vivo: matéria da atividade não encontrada:', erro.message);
        return null;
    }
}

/**
 * Nome da matéria pela pasta (.../<MATERIA>/ATIVIDADES/<pagina>.html), com espaços no lugar dos
 * hífens, como em materia.descricao.
 * @returns {string} Nome da matéria ou texto vazio.
 */
function lerNomeMateriaDaPaginaBloqueio() {
    const partes = decodeURIComponent(location.pathname).split('/').filter(Boolean);
    const posicao = partes.map((parte) => parte.toUpperCase())
        .lastIndexOf(PASTA_ATIVIDADES_PAGINA_BLOQUEIO);
    return posicao >= 1 ? partes[posicao - 1].replace(/-/g, ' ') : '';
}

/**
 * Carrega um script da pasta deste arquivo (assets/js) uma vez só.
 * @param {string} arquivo - Nome do arquivo (ex.: 'popup.js').
 * @returns {Promise<boolean>} true se carregou (ou já estava na página).
 */
function carregarScriptPaginaBloqueio(arquivo) {
    if (!ENDERECO_SCRIPT_PAGINA_BLOQUEIO) return Promise.resolve(false);
    const existente = [...document.scripts].find((script) => script.src.endsWith('/' + arquivo));
    if (existente && existente.dataset.carregado !== 'nao') return Promise.resolve(true);

    return new Promise((resolver) => {
        const script = document.createElement('script');
        script.src = new URL(arquivo, ENDERECO_SCRIPT_PAGINA_BLOQUEIO).href;
        script.dataset.carregado = 'nao';
        script.addEventListener('load', () => {
            script.dataset.carregado = 'sim';
            resolver(true);
        });
        script.addEventListener('error', () => resolver(false));
        document.head.append(script);
    });
}

/**
 * Liga o ao vivo da página: escuta o aviso e inicia o canal da matéria (idempotente; o módulo
 * não assina sem login e respeita o interruptor RealtimeAtividades.ATIVO).
 * @param {number} materiaId - Id da matéria da atividade.
 */
async function ligarAoVivoDaPagina(materiaId) {
    estadoPaginaBloqueio.materiaId = materiaId;
    document.addEventListener(EVENTO_STATUS_PAGINA_BLOQUEIO, aoMudarStatusDaPaginaBloqueio);
    if (!window.RealtimeAtividades) await carregarScriptPaginaBloqueio('realtime-atividades.js');
    const modulo = window.RealtimeAtividades;
    const cliente = typeof obterClienteSupabase === 'function' ? obterClienteSupabase() : null;
    if (!modulo || typeof modulo.iniciar !== 'function' || !cliente) return;
    try {
        modulo.iniciar({ cliente, materiaId });
    } catch (erro) {
        console.warn('Ao vivo indisponível na atividade:', erro.message);
    }
}

/**
 * Aviso do Realtime da matéria desta página: relê a atividade (uma releitura por vez; aviso que
 * chega no meio vira UMA releitura a mais no fim).
 * @param {CustomEvent} evento - detail { materiaId, versao, origem }.
 */
async function aoMudarStatusDaPaginaBloqueio(evento) {
    const materia = Number(evento.detail?.materiaId);
    if (materia && materia !== estadoPaginaBloqueio.materiaId) return;
    if (estadoPaginaBloqueio.relendo) {
        estadoPaginaBloqueio.deNovo = true;
        return;
    }
    estadoPaginaBloqueio.relendo = true;
    try {
        do {
            estadoPaginaBloqueio.deNovo = false;
            await reaplicarStatusDaPagina();
        } while (estadoPaginaBloqueio.deNovo);
    } finally {
        estadoPaginaBloqueio.relendo = false;
    }
}

/**
 * Relê se a atividade está liberada e trava, destrava ou recarrega a página. Falha na leitura
 * não muda nada (não trava o aluno por queda de rede; o RLS continua valendo na gravação).
 */
async function reaplicarStatusDaPagina() {
    let liberada;
    try {
        liberada = await atividadeDaPaginaLiberada();
    } catch (erro) {
        console.warn('Ao vivo: status da atividade não conferido:', erro.message);
        return;
    }
    const estado = estadoPaginaBloqueio;
    if (estado.abriuBloqueada) {
        if (liberada) await avisarERecarregarPaginaBloqueio();
        return;
    }
    if (!liberada && !estado.travada) await travarEdicaoDaPagina();
    if (liberada && estado.travada) await destravarEdicaoDaPagina();
}

/**
 * Página que abriu bloqueada (conteúdo nunca mostrado, nada respondido): avisa e recarrega.
 */
async function avisarERecarregarPaginaBloqueio() {
    await mostrarPopupPaginaBloqueio(TEXTO_RECARREGAR_PAGINA_BLOQUEIO,
        { tipo: 'info', titulo: TITULO_LIBERADA_PAGINA_BLOQUEIO });
    location.reload();
}

/**
 * Mostra o popup do projeto (carrega o popup.js se a página não o tiver). Sem popup, só o aviso
 * escrito na página vale (nunca alert).
 * @param {string} mensagem - Texto do aviso.
 * @param {{tipo: string, titulo: string}} opcoes - Aparência do popup.
 * @returns {Promise<void>} Resolve quando o aluno fecha o popup.
 */
async function mostrarPopupPaginaBloqueio(mensagem, opcoes) {
    if (typeof mostrarPopup !== 'function') await carregarScriptPaginaBloqueio('popup.js');
    if (typeof mostrarPopup !== 'function') return;
    await mostrarPopup(mensagem, opcoes);
}

/**
 * Controles de resposta da atividade (no container, fora do cabeçalho).
 * @returns {HTMLElement[]} Campos e botões.
 */
function listarControlesDaPagina() {
    return listarConteudoDaPagina()
        .flatMap((parte) => [...parte.querySelectorAll(SELETOR_CONTROLES_PAGINA_BLOQUEIO)]);
}

/**
 * Trava a edição sem perder nada: guarda o "disabled" de cada controle e o desabilita (o valor
 * digitado e as marcações continuam); mostra o aviso na página e em popup.
 */
async function travarEdicaoDaPagina() {
    estadoPaginaBloqueio.travada = true;
    listarControlesDaPagina().forEach((controle) => {
        if (controle.hasAttribute(ATRIBUTO_TRAVA_PAGINA_BLOQUEIO)) return;
        controle.setAttribute(ATRIBUTO_TRAVA_PAGINA_BLOQUEIO, controle.disabled ? 'sim' : 'nao');
        controle.disabled = true;
    });
    mostrarAvisoTravaNaPagina();
    await mostrarPopupPaginaBloqueio(TEXTO_TRAVA_PAGINA_BLOQUEIO,
        { tipo: 'aviso', titulo: TITULO_TRAVA_PAGINA_BLOQUEIO });
    voltarAoIndiceDaAtividade();
}

/**
 * Endereço do índice de atividades da matéria desta página (.../ATIVIDADES/index.html).
 * @returns {string} Endereço do índice, ou texto vazio se a pasta ATIVIDADES não estiver no caminho.
 */
function obterEnderecoIndiceDaPagina() {
    const caminho = location.pathname;
    const posicao = caminho.toUpperCase().lastIndexOf('/' + PASTA_ATIVIDADES_PAGINA_BLOQUEIO + '/');
    if (posicao < 0) return '';

    const pasta = caminho.slice(0, posicao + PASTA_ATIVIDADES_PAGINA_BLOQUEIO.length + 2);
    return location.origin + pasta + ARQUIVO_INDICE_PAGINA_BLOQUEIO;
}

/**
 * "Fecha" a página bloqueada levando o aluno ao índice. Só vai se a atividade continuar
 * bloqueada (o professor pode ter liberado enquanto o popup estava aberto). Sem índice
 * conhecido, a página fica travada com o aviso.
 */
function voltarAoIndiceDaAtividade() {
    if (!estadoPaginaBloqueio.travada) return;

    const indice = obterEnderecoIndiceDaPagina();
    if (indice) location.assign(indice);
}

/**
 * Destrava a edição: devolve a cada controle o "disabled" que ele tinha antes da trava, tira o
 * aviso da página e avisa em popup.
 */
async function destravarEdicaoDaPagina() {
    estadoPaginaBloqueio.travada = false;
    document.querySelectorAll('[' + ATRIBUTO_TRAVA_PAGINA_BLOQUEIO + ']').forEach((controle) => {
        controle.disabled = controle.getAttribute(ATRIBUTO_TRAVA_PAGINA_BLOQUEIO) === 'sim';
        controle.removeAttribute(ATRIBUTO_TRAVA_PAGINA_BLOQUEIO);
    });
    document.querySelectorAll('[' + ATRIBUTO_AVISO_PAGINA_BLOQUEIO + ']')
        .forEach((aviso) => aviso.remove());
    await mostrarPopupPaginaBloqueio(TEXTO_LIBERADA_PAGINA_BLOQUEIO,
        { tipo: 'sucesso', titulo: TITULO_LIBERADA_PAGINA_BLOQUEIO });
}

/**
 * Aviso fixo na página (logo abaixo do cabeçalho) enquanto a edição estiver travada.
 */
function mostrarAvisoTravaNaPagina() {
    const container = document.querySelector(SELETOR_CONTAINER_PAGINA_BLOQUEIO);
    if (!container || container.querySelector('[' + ATRIBUTO_AVISO_PAGINA_BLOQUEIO + ']')) return;

    const aviso = document.createElement('section');
    aviso.className = CLASSE_AVISO_PAGINA_BLOQUEIO;
    aviso.setAttribute(ATRIBUTO_AVISO_PAGINA_BLOQUEIO, '');
    aviso.setAttribute('role', 'alert');
    const titulo = document.createElement('h2');
    titulo.textContent = TITULO_TRAVA_PAGINA_BLOQUEIO;
    const texto = document.createElement('p');
    texto.textContent = TEXTO_TRAVA_PAGINA_BLOQUEIO;
    aviso.append(titulo, texto);
    const cabecalho = container.querySelector('header');
    if (cabecalho) cabecalho.after(aviso);
    else container.prepend(aviso);
}

/**
 * Com a edição travada, corta clique e digitação nos controles criados DEPOIS da trava (ex.:
 * questão montada pelo script da página), que não chegaram a ser desabilitados.
 * @param {Event} evento - click ou keydown em qualquer parte da página.
 */
function barrarEdicaoTravadaDaPagina(evento) {
    if (!estadoPaginaBloqueio.travada) return;
    if (evento.type === 'keydown' && evento.key === 'Tab') return;
    const alvo = evento.target?.closest?.(SELETOR_CLIQUE_TRAVADO_PAGINA_BLOQUEIO);
    if (!alvo || alvo.closest('header')) return;
    const container = document.querySelector(SELETOR_CONTAINER_PAGINA_BLOQUEIO);
    if (!container || !container.contains(alvo)) return;
    evento.preventDefault();
    evento.stopPropagation();
}

document.addEventListener('click', barrarEdicaoTravadaDaPagina, true);
document.addEventListener('keydown', barrarEdicaoTravadaDaPagina, true);
document.addEventListener('submit', barrarEdicaoTravadaDaPagina, true);

/**
 * Recuperação (assets/js/recuperacao-visibilidade.js): a página de recuperação só abre para o
 * aluno marcado em recuperação. Vale em toda matéria, com ou sem o bloqueio da aula ligado.
 */
async function iniciarRecuperacaoDaPagina() {
    const carregou = await carregarScriptPaginaBloqueio('recuperacao-visibilidade.js');
    if (!carregou || !window.RecuperacaoVisibilidade) return;

    await window.RecuperacaoVisibilidade.bloquearPaginaDeRecuperacao();
}

iniciarRecuperacaoDaPagina();
iniciarBloqueioDaPagina();
