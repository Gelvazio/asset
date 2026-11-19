// Página pública verificar-ficha.html: consulta a RPC verificar_ficha_aluno (só a chave anon,
// sem sessão de usuário) e mostra a ficha emitida. Todo dado do banco entra no DOM por
// textContent. Usa SUPABASE (js/supabase.js) só para URL e chave pública.

const ORIGEM_OFICIAL_VERIFICAR_FICHA = 'https://aulasenai.vercel.app';
const RPC_VERIFICAR_FICHA = 'verificar_ficha_aluno';
const PARAMETRO_CODIGO_VERIFICAR_FICHA = 'codigo';
const FUSO_VERIFICAR_FICHA = 'America/Sao_Paulo';
const TEXTO_SEM_VALOR_VERIFICAR_FICHA = '—';
const MSG_NAO_ENCONTRADA_VERIFICAR_FICHA =
    'Ficha não encontrada: este código não foi emitido pelo sistema';
const MSG_ERRO_VERIFICAR_FICHA = 'Não foi possível consultar agora. Tente novamente mais tarde.';
const MSG_CODIGO_VAZIO_VERIFICAR_FICHA = 'Digite o código de verificação impresso na ficha.';
const MSG_ORIENTACAO_VERIFICAR_FICHA = 'Compare os dados abaixo com a ficha em papel (ou PDF). '
    + 'Se algum nome, nota ou data for diferente, a ficha foi alterada e não é autêntica.';
const COLUNAS_VERIFICAR_FICHA = ['Aula', 'Data', 'Atividade', 'Situação', 'Nota'];
const CHAVES_LINHA_VERIFICAR_FICHA = ['aula', 'data', 'atividade', 'situacao', 'nota'];
const MEDIAS_VERIFICAR_FICHA = [['atividades', 'Média das Atividades'],
    ['objetiva', 'Prova Objetiva'], ['pratica', 'Prova Prática'], ['final', 'Média Final']];

let clientePublicoVerificarFicha = null;

/**
 * Cria (uma vez) o cliente Supabase anônimo, sem guardar sessão.
 * @returns {Object|null} Cliente, ou null se a biblioteca não carregou.
 */
function obterClientePublicoVerificarFicha() {
    if (clientePublicoVerificarFicha) return clientePublicoVerificarFicha;
    if (!window.supabase?.createClient) return null;

    clientePublicoVerificarFicha = window.supabase.createClient(SUPABASE.URL, SUPABASE.KEY,
        { auth: { persistSession: false, autoRefreshToken: false } });
    return clientePublicoVerificarFicha;
}

/**
 * Cria um elemento com classe e texto (sempre por textContent).
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classe CSS ('' para nenhuma).
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoVerificarFicha(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

/**
 * Formata data e hora de emissão no fuso de Brasília, com segundos.
 * @param {string} dataIso - Timestamp ISO do banco.
 * @returns {string} dd/mm/aaaa hh:mm:ss (Brasília).
 */
function formatarEmissaoVerificarFicha(dataIso) {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return TEXTO_SEM_VALOR_VERIFICAR_FICHA;

    return data.toLocaleString('pt-BR', { timeZone: FUSO_VERIFICAR_FICHA, hour12: false,
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        second: '2-digit' }) + ' (Brasília)';
}

/**
 * Formata uma média (0 a 10) com vírgula; null vira "—".
 * @param {number|null} valor - Média.
 * @returns {string} Texto da média.
 */
function formatarMediaVerificarFicha(valor) {
    if (valor === null || valor === undefined) return TEXTO_SEM_VALOR_VERIFICAR_FICHA;

    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1,
        maximumFractionDigits: 2 });
}

/**
 * Monta a lista de dados (turma, matéria, docente, emissão, código).
 * @param {Object} ficha - Resposta da RPC.
 * @returns {HTMLElement} Elemento dl.
 */
function montarDadosVerificarFicha(ficha) {
    const dados = criarElementoVerificarFicha('dl', 'verificar-ficha__dados');
    [['Turma', ficha.turma_nome], ['Matéria (UC)', ficha.materia_nome],
        ['Docente', ficha.docente_nome],
        ['Emitida em', formatarEmissaoVerificarFicha(ficha.emitida_em)],
        ['Código', ficha.codigo]].forEach(([rotulo, valor]) => {
        const bloco = criarElementoVerificarFicha('div', '');
        bloco.append(criarElementoVerificarFicha('dt', '', rotulo),
            criarElementoVerificarFicha('dd', '', valor || TEXTO_SEM_VALOR_VERIFICAR_FICHA));
        dados.append(bloco);
    });
    return dados;
}

/**
 * Monta os quatro cartões de média.
 * @param {Object} medias - {atividades, objetiva, pratica, final}.
 * @returns {HTMLElement} Elemento com os cartões.
 */
function montarMediasVerificarFicha(medias) {
    const area = criarElementoVerificarFicha('div', 'verificar-ficha__medias');
    MEDIAS_VERIFICAR_FICHA.forEach(([chave, rotulo]) => {
        const cartao = criarElementoVerificarFicha('div', 'verificar-ficha__media');
        cartao.append(criarElementoVerificarFicha('strong', '',
            formatarMediaVerificarFicha(medias?.[chave])),
        criarElementoVerificarFicha('span', '', rotulo));
        area.append(cartao);
    });
    return area;
}

/**
 * Monta a tabela das linhas da ficha.
 * @param {Object[]} linhas - Linhas {aula, data, atividade, situacao, nota}.
 * @returns {HTMLElement} Área rolável com a tabela.
 */
function montarTabelaVerificarFicha(linhas) {
    const area = criarElementoVerificarFicha('div', 'verificar-ficha__tabela-area');
    const tabela = criarElementoVerificarFicha('table', 'verificar-ficha__tabela');
    const cabecalho = criarElementoVerificarFicha('tr', '');
    COLUNAS_VERIFICAR_FICHA.forEach((nome) =>
        cabecalho.append(criarElementoVerificarFicha('th', '', nome)));
    const corpo = criarElementoVerificarFicha('tbody', '');
    (linhas || []).forEach((linha) => {
        const tr = criarElementoVerificarFicha('tr', '');
        CHAVES_LINHA_VERIFICAR_FICHA.forEach((chave) =>
            tr.append(criarElementoVerificarFicha('td', '', linha[chave] ?? '')));
        corpo.append(tr);
    });
    const topo = criarElementoVerificarFicha('thead', '');
    topo.append(cabecalho);
    tabela.append(topo, corpo);
    area.append(tabela);
    return area;
}

/**
 * Mostra a ficha autêntica na área de resultado.
 * @param {HTMLElement} area - Área de resultado (é esvaziada).
 * @param {Object} ficha - Resposta da RPC com encontrada = true.
 */
function mostrarFichaVerificarFicha(area, ficha) {
    area.hidden = false;
    const selo = criarElementoVerificarFicha('p', 'verificar-ficha__selo verificar-ficha__selo--ok',
        'Ficha autêntica');
    selo.append(criarElementoVerificarFicha('small', '',
        'Emitida pelo sistema em ' + ORIGEM_OFICIAL_VERIFICAR_FICHA));
    const hash = criarElementoVerificarFicha('p', 'verificar-ficha__hash',
        'SHA-256 do conteúdo: ' + (ficha.hash_sha256 || TEXTO_SEM_VALOR_VERIFICAR_FICHA));
    area.replaceChildren(selo,
        criarElementoVerificarFicha('h2', 'verificar-ficha__estudante', ficha.aluno_nome),
        criarElementoVerificarFicha('p', 'verificar-ficha__orientacao',
            MSG_ORIENTACAO_VERIFICAR_FICHA),
        montarDadosVerificarFicha(ficha),
        montarMediasVerificarFicha(ficha.conteudo?.medias),
        montarTabelaVerificarFicha(ficha.conteudo?.linhas), hash);
}

/**
 * Mostra uma mensagem de erro/ausência na área de resultado.
 * @param {HTMLElement} area - Área de resultado.
 * @param {string} mensagem - Texto a mostrar.
 */
function mostrarMensagemVerificarFicha(area, mensagem) {
    area.hidden = false;
    document.getElementById('areaConsulta').hidden = false;
    area.replaceChildren(criarElementoVerificarFicha('p',
        'verificar-ficha__selo verificar-ficha__selo--erro', mensagem));
}

/**
 * Consulta o código no banco e mostra o resultado.
 * @param {string} codigo - Código digitado ou vindo da URL.
 */
async function verificarCodigoFicha(codigo) {
    const area = document.getElementById('areaResultado');
    if (!codigo.trim()) {
        mostrarMensagemVerificarFicha(area, MSG_CODIGO_VAZIO_VERIFICAR_FICHA);
        return;
    }
    const cliente = obterClientePublicoVerificarFicha();
    if (!cliente) {
        mostrarMensagemVerificarFicha(area, MSG_ERRO_VERIFICAR_FICHA);
        return;
    }
    const { data, error } = await cliente.rpc(RPC_VERIFICAR_FICHA, { p_codigo: codigo.trim() });
    if (error) {
        mostrarMensagemVerificarFicha(area, MSG_ERRO_VERIFICAR_FICHA);
        return;
    }
    if (!data?.encontrada) {
        mostrarMensagemVerificarFicha(area, MSG_NAO_ENCONTRADA_VERIFICAR_FICHA);
        return;
    }
    mostrarFichaVerificarFicha(area, data);
}

/**
 * Inicializa a página: domínio oficial, formulário e consulta do código da URL.
 */
function iniciarVerificarFicha() {
    document.getElementById('dominioOficial').textContent = ORIGEM_OFICIAL_VERIFICAR_FICHA;
    const codigo = new URLSearchParams(window.location.search)
        .get(PARAMETRO_CODIGO_VERIFICAR_FICHA) || '';
    const campo = document.getElementById('campoCodigo');
    campo.value = codigo;
    document.getElementById('formCodigo').addEventListener('submit', (evento) => {
        evento.preventDefault();
        verificarCodigoFicha(campo.value);
    });
    if (codigo) {
        verificarCodigoFicha(codigo);
        return;
    }
    document.getElementById('areaConsulta').hidden = false;
    document.getElementById('areaResultado').hidden = true;
}

iniciarVerificarFicha();
