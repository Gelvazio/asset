// Visibilidade da atividade de RECUPERAÇÃO para o aluno: só quem está marcado "em recuperação"
// (tabela aluno_recuperacao) vê o botão no índice e abre/faz a página. Professor vê tudo.
// Este módulo só decide e esconde; a defesa final é do banco (RLS da tabela atividade, função
// recuperacao_liberada_para_usuario): o aluno de fora nem lê a linha da atividade nem grava.
// Duas entradas, ligadas por ganchos mínimos (carregam este arquivo sozinhos, sem regerar página):
//   - índice de atividades (assets/js/indice-atividades-bloqueio.js): esconderLinksDoAluno(links);
//   - página da atividade (assets/js/atividade-bloqueio-aula.js): bloquearPaginaDeRecuperacao().
// Como o aluno de fora não lê a linha da atividade, o que não dá para saber pelo banco (botão
// fixo do HTML, página sem linha lida) é reconhecido pelo nome "RECUPERACAO" no arquivo.
// Falha de leitura NUNCA bloqueia por conta própria (o RLS continua valendo).
// Depende de: js/supabase.js (obterClienteSupabase, sbGet) e do repositório
// assets/js/recuperacao-repositorio.js (carregado aqui se faltar).
// Orientação: docs/ORIENTACAO_JS_RECUPERACAO.md

const PERFIL_PROFESSOR_RECUPERACAO = 'PROFESSOR';
const ENDERECO_SCRIPT_RECUPERACAO = document.currentScript ? document.currentScript.src : '';
const ARQUIVO_REPOSITORIO_RECUPERACAO = 'recuperacao-repositorio.js';
const ARQUIVO_CSS_RECUPERACAO = '../css/recuperacao-visibilidade.css';
const PADRAO_NOME_RECUPERACAO = /recupera[cç][aã]o/i;
const TABELA_ATIVIDADE_VISIBILIDADE = 'atividade';
const ATRIBUTO_VINCULO_RECUPERACAO = 'data-vinculo-banco';
const ATRIBUTOS_HREF_RECUPERACAO = ['href', 'data-href-bloqueado', 'data-href-aula-bloqueada'];
const SEGMENTOS_CHAVE_RECUPERACAO = 2;
const PASTA_RAIZ_PAGINA_RECUPERACAO = '/materiais/';
const EXTENSAO_PAGINA_RECUPERACAO = '.html';
const CLASSE_LINK_OCULTO_RECUPERACAO = 'atividade--recuperacao-oculta';
const CLASSE_AVISO_RECUPERACAO = 'aula-card aviso-recuperacao';
const SELETOR_CONTAINER_RECUPERACAO = '.container';
const SELETOR_CONTROLES_RECUPERACAO = 'input, textarea, select, button';
const SELETOR_LINKS_SLIDES_RECUPERACAO = 'a[href$=".pdf" i]';
const ATRIBUTO_CONFERINDO_RECUPERACAO = 'data-recuperacao-conferindo';
const ATRIBUTO_BLOQUEADA_RECUPERACAO = 'data-recuperacao-bloqueada';
const TITULO_AVISO_RECUPERACAO = '🔒 Atividade de recuperação';
const TEXTO_AVISO_RECUPERACAO = 'Esta atividade é de recuperação e não está liberada para você.';

/**
 * Carrega um script da pasta deste arquivo (assets/js) uma vez só.
 * @param {string} arquivo - Nome do arquivo (ex.: 'recuperacao-repositorio.js').
 * @returns {Promise<boolean>} true se carregou (ou já estava na página).
 */
function carregarScriptRecuperacao(arquivo) {
    if (!ENDERECO_SCRIPT_RECUPERACAO) return Promise.resolve(false);

    const existente = document.querySelector('script[src$="/' + arquivo + '"]');
    if (existente) return Promise.resolve(true);

    return new Promise((resolver) => {
        const script = document.createElement('script');
        script.src = new URL(arquivo, ENDERECO_SCRIPT_RECUPERACAO).href;
        script.addEventListener('load', () => resolver(true));
        script.addEventListener('error', () => resolver(false));
        document.head.append(script);
    });
}

/**
 * Liga a folha de estilo deste módulo (esconde botão e conteúdo), uma vez só.
 */
function garantirCssRecuperacao() {
    if (!ENDERECO_SCRIPT_RECUPERACAO) return;
    if (document.querySelector('link[href$="recuperacao-visibilidade.css"]')) return;

    const estilo = document.createElement('link');
    estilo.rel = 'stylesheet';
    estilo.href = new URL(ARQUIVO_CSS_RECUPERACAO, ENDERECO_SCRIPT_RECUPERACAO).href;
    document.head.append(estilo);
}

/**
 * Indica se o usuário logado é professor (ele vê e abre todas as recuperações).
 * @param {Object} cliente - Cliente supabase-js.
 * @returns {Promise<boolean>} true se o perfil é PROFESSOR.
 */
async function usuarioEhProfessorRecuperacao(cliente) {
    const { data } = await cliente.auth.getSession();
    return data?.session?.user?.app_metadata?.perfil === PERFIL_PROFESSOR_RECUPERACAO;
}

/**
 * Cria o repositório da recuperação (carrega o arquivo dele se a página ainda não o tem).
 * @param {Object} cliente - Cliente supabase-js.
 * @returns {Promise<Object>} Repositório (idsTodasRecuperacoes, idsRecuperacaoDoAluno...).
 * @throws {Error} Se o repositório não puder ser carregado.
 */
async function criarRepositorioRecuperacao(cliente) {
    if (typeof window.criarRecuperacaoRepositorio !== 'function') {
        await carregarScriptRecuperacao(ARQUIVO_REPOSITORIO_RECUPERACAO);
    }
    if (typeof window.criarRecuperacaoRepositorio !== 'function') {
        throw new Error('Repositório da recuperação indisponível.');
    }
    return window.criarRecuperacaoRepositorio(cliente);
}

/**
 * Chave de comparação de uma página: as duas últimas partes do caminho, em minúsculas
 * (pasta/arquivo), para o endereço do botão casar com atividade.pagina.
 * @param {string} endereco - Href do botão ou atividade.pagina.
 * @returns {string} Chave, ou texto vazio se não houver endereço.
 */
function obterChavePaginaRecuperacao(endereco) {
    if (!endereco) return '';

    const semParametros = String(endereco).split(/[?#]/)[0];
    const partes = decodeURIComponent(semParametros).toLowerCase().split('/').filter(Boolean);
    return partes.slice(-SEGMENTOS_CHAVE_RECUPERACAO).join('/');
}

/**
 * Diz se o nome do arquivo da página indica uma atividade de recuperação.
 * @param {string} endereco - Href do botão ou caminho da página.
 * @returns {boolean} true se o nome do arquivo tem "recuperacao".
 */
function nomeIndicaRecuperacao(endereco) {
    const chave = obterChavePaginaRecuperacao(endereco);
    const nomeArquivo = chave.split('/').pop();
    return PADRAO_NOME_RECUPERACAO.test(nomeArquivo);
}

/**
 * Lê o que o usuário logado pode ver das recuperações.
 * @returns {Promise<{liberaTudo: boolean, naoLiberados: Set<number>, minhasPaginas: Set<string>}>}
 *     liberaTudo = professor; naoLiberados = recuperações em que o aluno NÃO está;
 *     minhasPaginas = chaves das páginas das recuperações dele.
 * @throws {Error} Se o banco recusar (quem chama deixa passar: o RLS continua valendo).
 */
async function lerEstadoRecuperacao() {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error('Conexão com o banco indisponível.');
    if (await usuarioEhProfessorRecuperacao(cliente)) {
        return { liberaTudo: true, naoLiberados: new Set(), minhasPaginas: new Set() };
    }
    const repositorio = await criarRepositorioRecuperacao(cliente);
    const [todas, dele] = await Promise.all([
        repositorio.idsTodasRecuperacoes(), repositorio.idsRecuperacaoDoAluno()]);
    const meus = new Set(dele.map(Number));
    const naoLiberados = new Set(todas.map(Number).filter((id) => !meus.has(id)));
    return { liberaTudo: false, naoLiberados, minhasPaginas: await lerPaginasDosIds([...meus]) };
}

/**
 * Chaves das páginas das atividades (as que o aluno consegue ler) pelos ids.
 * @param {number[]} ids - Ids das atividades de recuperação do aluno.
 * @returns {Promise<Set<string>>} Chaves pasta/arquivo em minúsculas.
 */
async function lerPaginasDosIds(ids) {
    if (!ids.length) return new Set();

    const linhas = await sbGet(TABELA_ATIVIDADE_VISIBILIDADE,
        'select=pagina&id=in.(' + ids.join(',') + ')');
    return new Set(linhas.map((linha) => obterChavePaginaRecuperacao(linha.pagina)));
}

/**
 * Endereço de uma atividade no botão do índice (também quando o bloqueio guardou o href).
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @returns {string} Endereço, ou texto vazio.
 */
function lerEnderecoDoLinkRecuperacao(link) {
    const atributo = ATRIBUTOS_HREF_RECUPERACAO.find((nome) => link.getAttribute(nome));
    return atributo ? link.getAttribute(atributo) : '';
}

/**
 * Diz se o botão do índice é de uma recuperação em que o aluno NÃO está.
 * @param {HTMLAnchorElement} link - Botão da atividade.
 * @param {{naoLiberados: Set<number>, minhasPaginas: Set<string>}} estado - Estado lido.
 * @returns {boolean} true se o botão deve ficar escondido.
 */
function linkDeRecuperacaoDeOutroAluno(link, estado) {
    const idVinculo = Number(link.getAttribute(ATRIBUTO_VINCULO_RECUPERACAO));
    if (idVinculo) return estado.naoLiberados.has(idVinculo);

    const endereco = lerEnderecoDoLinkRecuperacao(link);
    const ehPorNome = nomeIndicaRecuperacao(endereco);
    return ehPorNome && !estado.minhasPaginas.has(obterChavePaginaRecuperacao(endereco));
}

/**
 * Índice, aluno: esconde os botões das recuperações em que ele não está e devolve os que ficam.
 * Professor e falha de leitura não escondem nada.
 * @param {HTMLAnchorElement[]} links - Botões das atividades do índice.
 * @returns {Promise<HTMLAnchorElement[]>} Botões que continuam visíveis.
 */
async function esconderLinksDoAluno(links) {
    let estado = null;
    try {
        estado = await lerEstadoRecuperacao();
    } catch (erro) {
        console.warn('Recuperação: visibilidade não conferida:', erro.message);
    }
    if (!estado || estado.liberaTudo) return links;

    garantirCssRecuperacao();
    return links.filter((link) => {
        const ocultar = linkDeRecuperacaoDeOutroAluno(link, estado);
        link.classList.toggle(CLASSE_LINK_OCULTO_RECUPERACAO, ocultar);
        return !ocultar;
    });
}

/**
 * Caminho desta página no formato de atividade.pagina: a partir de /MATERIAIS/ e com .html.
 * @returns {string} Caminho normalizado.
 */
function obterCaminhoDaPaginaRecuperacao() {
    const caminho = decodeURIComponent(location.pathname);
    const inicio = caminho.toLowerCase().indexOf(PASTA_RAIZ_PAGINA_RECUPERACAO);
    const relativo = inicio >= 0 ? caminho.slice(inicio) : caminho;
    const temExtensao = relativo.toLowerCase().endsWith(EXTENSAO_PAGINA_RECUPERACAO);
    return temExtensao ? relativo : relativo + EXTENSAO_PAGINA_RECUPERACAO;
}

/**
 * Id da atividade desta página, se o usuário logado conseguir ler a linha (RLS).
 * @param {string} caminho - Caminho da página.
 * @returns {Promise<number|null>} Id, ou null se a linha não vem do banco.
 */
async function lerIdDaPaginaRecuperacao(caminho) {
    // ilike sem curinga = igual sem diferenciar maiúsculas; o "_" escapado não vira curinga.
    const pagina = caminho.replace(/_/g, '\\_');
    const linhas = await sbGet(TABELA_ATIVIDADE_VISIBILIDADE,
        'select=id&pagina=ilike.' + encodeURIComponent(pagina));
    return linhas[0] ? Number(linhas[0].id) : null;
}

/**
 * Decide se o aluno logado não pode ver esta página (recuperação em que ele não está).
 * @param {string} caminho - Caminho da página.
 * @returns {Promise<boolean>} true se a página deve ficar bloqueada.
 * @throws {Error} Se a leitura falhar (quem chama deixa passar).
 */
async function paginaDeRecuperacaoBloqueada(caminho) {
    const estado = await lerEstadoRecuperacao();
    if (estado.liberaTudo) return false;

    const idAtividade = await lerIdDaPaginaRecuperacao(caminho);
    if (idAtividade) return estado.naoLiberados.has(idAtividade);

    // Sem a linha (o RLS escondeu): só bloqueia o que o nome mostra ser recuperação.
    return nomeIndicaRecuperacao(caminho);
}

/**
 * Troca o conteúdo da página pelo aviso de recuperação não liberada e trava os campos.
 */
function mostrarBloqueioDaPaginaRecuperacao() {
    garantirCssRecuperacao();
    document.body.setAttribute(ATRIBUTO_BLOQUEADA_RECUPERACAO, '');
    document.querySelectorAll(SELETOR_LINKS_SLIDES_RECUPERACAO).forEach((link) => link.remove());
    const container = document.querySelector(SELETOR_CONTAINER_RECUPERACAO);
    if (!container) return;

    container.querySelectorAll(SELETOR_CONTROLES_RECUPERACAO).forEach((controle) => {
        if (!controle.closest('header')) controle.disabled = true;
    });
    const aviso = document.createElement('section');
    aviso.className = CLASSE_AVISO_RECUPERACAO;
    aviso.setAttribute('role', 'alert');
    const titulo = document.createElement('h2');
    titulo.textContent = TITULO_AVISO_RECUPERACAO;
    const texto = document.createElement('p');
    texto.textContent = TEXTO_AVISO_RECUPERACAO;
    aviso.append(titulo, texto);
    const cabecalho = container.querySelector('header');
    if (cabecalho) cabecalho.after(aviso);
    else container.prepend(aviso);
}

/**
 * Página da atividade, aluno: bloqueia (aviso + campos travados) se for recuperação em que ele
 * não está. Página com "recuperacao" no nome fica escondida enquanto o banco é consultado.
 * Professor e falha de leitura deixam a página como está.
 * @returns {Promise<boolean>} true se a página foi bloqueada.
 */
async function bloquearPaginaDeRecuperacao() {
    const caminho = obterCaminhoDaPaginaRecuperacao();
    const parecePorNome = nomeIndicaRecuperacao(caminho);
    if (parecePorNome) {
        garantirCssRecuperacao();
        document.body.setAttribute(ATRIBUTO_CONFERINDO_RECUPERACAO, '');
    }
    let bloqueada = false;
    try {
        bloqueada = await paginaDeRecuperacaoBloqueada(caminho);
    } catch (erro) {
        console.warn('Recuperação: página não conferida:', erro.message);
    }
    document.body.removeAttribute(ATRIBUTO_CONFERINDO_RECUPERACAO);
    if (bloqueada) mostrarBloqueioDaPaginaRecuperacao();
    return bloqueada;
}

window.RecuperacaoVisibilidade = { esconderLinksDoAluno, bloquearPaginaDeRecuperacao };
