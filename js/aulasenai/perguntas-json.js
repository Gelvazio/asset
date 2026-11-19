// Monta as perguntas de uma atividade (objetiva ou prática) a partir de UM arquivo JSON do
// repositório; o BANCO diz quais perguntas estão ATIVAS (função itens_ativos): o JSON sempre tem
// todas (ex.: 50 objetivas), mas só as liberadas pelo professor chegam ao aluno. A resposta certa
// nunca está no JSON. Regra: .claude/rules/atividades-banco.md ("Tela = espelho do banco", #389).
//
// Uso na página (dois modos, sempre no fim do <body>, com
// <span id="ancora-perguntas" hidden></span> onde os cards entram):
//
// 1) Caminho direto (modo antigo, segue valendo):
//    <script src=".../perguntas-json.js" data-json="DADOS/ARQUIVO.json"
//      data-antes="a.js,b.js" data-depois="c.js,d.js"></script>
//
// 2) Pelo índice da matéria (ATIVIDADES/ATIVIDADES.json), sem data-json:
//    <script src=".../perguntas-json.js" data-atividade-id="190"
//      data-indice="ATIVIDADES.json" data-antes="a.js,b.js" data-depois="c.js,d.js"></script>
//    data-indice é opcional (padrão "ATIVIDADES.json", relativo à página); o caminho "json" da
//    entrada do índice é resolvido em relação ao próprio índice. Sem entrada para o
//    data-atividade-id, a página mostra o aviso de erro (sem plano B por HTML fixo).
//
// O loader carrega os scripts "antes" (supabase, login), lê JSON + itens ativos, monta os cards
// e só então carrega os "depois" (os da própria atividade, que leem os cards do DOM).
// Marcadores de total na página: [data-perguntas-total] (texto) e [data-perguntas-pontos].

const ROTA_ITENS_ATIVOS = '/rest/v1/rpc/itens_ativos';
const ID_ANCORA_PERGUNTAS = 'ancora-perguntas';
const MSG_ERRO_PERGUNTAS = 'Não foi possível carregar as perguntas desta atividade. ' +
    'Recarregue a página; se continuar, avise o professor.';
const MSG_SEM_ORIGEM_PERGUNTAS = 'o <script> precisa de data-json ou de data-atividade-id';
const ARQUIVO_INDICE_PADRAO = 'ATIVIDADES.json';
const ROTULO_JSON_PERGUNTAS = 'JSON';
const ROTULO_INDICE_PERGUNTAS = 'Índice';
const TIPO_OBJETIVA_PERGUNTAS = 'objetiva';
const SCRIPT_PERGUNTAS = document.currentScript;

/**
 * Carrega um script em ordem e espera terminar.
 * @param {string} caminho - Caminho (relativo à página) do script.
 * @returns {Promise<void>} Resolve quando carregou.
 */
function carregarScriptPerguntas(caminho) {
    return new Promise((resolver, rejeitar) => {
        const script = document.createElement('script');
        script.src = caminho;
        script.async = false;
        script.onload = () => resolver();
        script.onerror = () => rejeitar(new Error('Não foi possível carregar ' + caminho));
        document.body.appendChild(script);
    });
}

/**
 * Carrega vários scripts, um depois do outro.
 * @param {string[]} caminhos - Scripts na ordem.
 * @returns {Promise<void>} Resolve quando todos carregaram.
 */
async function carregarScriptsPerguntas(caminhos) {
    for (const caminho of caminhos) await carregarScriptPerguntas(caminho);
}

/**
 * Lê uma lista de caminhos de um atributo data- do script (separados por vírgula).
 * @param {string} atributo - Nome do atributo (sem "data-").
 * @returns {string[]} Caminhos.
 */
function lerListaPerguntas(atributo) {
    return (SCRIPT_PERGUNTAS.dataset[atributo] || '').split(',').map((c) => c.trim())
        .filter(Boolean);
}

/**
 * Cria um elemento com classe, texto e atributos.
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classes CSS.
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoPerguntas(tag, classe, texto = '') {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto) elemento.textContent = texto;
    return elemento;
}

/**
 * Cria uma caixa "rótulo + texto" (CAPACIDADE, CONTEXTO, COMANDO...).
 * @param {string} rotulo - Rótulo com emoji.
 * @param {string} texto - Texto da caixa.
 * @returns {HTMLElement} Caixa pronta.
 */
function criarCaixaPerguntas(rotulo, texto) {
    const caixa = criarElementoPerguntas('div', 'content-box');
    caixa.append(criarElementoPerguntas('div', 'content-label', rotulo),
        criarElementoPerguntas('div', 'content-text', texto));
    return caixa;
}

/**
 * Caixa de texto que só existe quando o JSON traz o texto (pergunta direta, sem contexto/comando).
 * @param {string} rotulo - Título da caixa.
 * @param {string|undefined} texto - Texto da caixa; vazio ou ausente = não cria a caixa.
 * @returns {HTMLElement|null} Caixa pronta, ou null quando não há texto.
 */
function criarCaixaOpcionalPerguntas(rotulo, texto) {
    return texto ? criarCaixaPerguntas(rotulo, texto) : null;
}

/**
 * Número do item com dois dígitos ("01").
 * @param {number} item - Número do item.
 * @returns {string} Número formatado.
 */
function doisDigitosPerguntas(item) {
    return String(item).padStart(2, '0');
}

/**
 * Monta o card de uma pergunta objetiva.
 * @param {Object} pergunta - Item do JSON (item, titulo, capacidade, comando, alternativas).
 * @returns {HTMLElement} Card pronto.
 */
function montarCardObjetiva(pergunta) {
    const card = criarElementoPerguntas('div', 'aula-card questao');
    card.append(criarElementoPerguntas('span', 'aula-badge',
        'ITEM ' + doisDigitosPerguntas(pergunta.item)),
        criarElementoPerguntas('div', 'aula-title', pergunta.titulo),
        criarCaixaPerguntas('🎯 CAPACIDADE', pergunta.capacidade),
        criarCaixaPerguntas('🎬 COMANDO', pergunta.comando));
    const caixa = criarElementoPerguntas('div', 'content-box');
    const lista = criarElementoPerguntas('ul', 'alternativas');
    pergunta.alternativas.forEach((alternativa) => {
        const linha = document.createElement('li');
        linha.append(criarElementoPerguntas('span', 'letra', alternativa.letra + ')'),
            document.createTextNode(alternativa.texto));
        lista.append(linha);
    });
    caixa.append(criarElementoPerguntas('div', 'content-label', '📝 ALTERNATIVAS'), lista);
    card.append(caixa);
    return card;
}

/**
 * Texto dos pontos de um tópico ("0,2 ponto", "1 ponto", "1,5 pontos").
 * @param {number} pontos - Pontos do tópico (do banco).
 * @returns {string} Texto formatado.
 */
function formatarPontosPerguntas(pontos) {
    const numero = Number(pontos);
    const texto = numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return texto + (numero > 1 ? ' pontos' : ' ponto');
}

/**
 * Monta o bloco de resposta de um tópico da prática.
 * @param {Object} topico - Tópico do JSON (topico, enunciado).
 * @param {{item: number, pontos: number, maximo: string}} dados - Item, pontos do banco e
 *     limite de caracteres da página.
 * @returns {HTMLElement} Bloco pronto.
 */
function montarTopicoPratica(topico, dados) {
    const letra = String.fromCharCode(96 + topico.topico);
    const id = 'resposta-' + doisDigitosPerguntas(dados.item) + '-' + letra;
    const bloco = criarElementoPerguntas('div', 'topico-resposta');
    bloco.dataset.item = dados.item;
    bloco.dataset.topico = topico.topico;
    const rotulo = criarElementoPerguntas('label', 'topico-resposta__rotulo');
    rotulo.htmlFor = id;
    rotulo.append(criarElementoPerguntas('span', 'topico-resposta__letra', letra + ')'),
        document.createTextNode(' ' + topico.enunciado + ' '),
        criarElementoPerguntas('span', 'topico-resposta__pontos',
            formatarPontosPerguntas(dados.pontos)));
    const campo = criarElementoPerguntas('textarea', 'topico-resposta__campo');
    Object.assign(campo, { id, rows: 5, readOnly: true,
        placeholder: 'Escreva aqui a sua resposta do tópico ' + letra + ')...' });
    campo.dataset.item = dados.item;
    campo.dataset.topico = topico.topico;
    campo.maxLength = Number(dados.maximo) || 3000;
    const rodape = criarElementoPerguntas('div', 'topico-resposta__rodape');
    rodape.append(criarElementoPerguntas('span', 'topico-resposta__situacao'),
        criarElementoPerguntas('span', 'topico-resposta__contador', '0/' + campo.maxLength));
    rodape.firstChild.setAttribute('aria-live', 'polite');
    bloco.append(rotulo, campo, rodape);
    return bloco;
}

/**
 * Monta a seção de uma pergunta prática, só com os tópicos ativos.
 * @param {Object} pergunta - Item do JSON (item, titulo, capacidade, contexto, comando, topicos).
 * @param {Map<number, number>} pontosPorTopico - Pontos dos tópicos ativos (do banco).
 * @param {{aula: string, tema: string}} pagina - Aula e tema (do <body>).
 * @returns {HTMLElement} Seção pronta.
 */
function montarCardPratica(pergunta, pontosPorTopico, pagina) {
    const secao = criarElementoPerguntas('section', 'aula-card questao-discursiva');
    secao.id = 'item-' + doisDigitosPerguntas(pergunta.item);
    secao.dataset.item = pergunta.item;
    secao.append(criarElementoPerguntas('span', 'aula-badge',
        'ITEM ' + doisDigitosPerguntas(pergunta.item)),
        criarElementoPerguntas('span', 'questao-discursiva__aula',
            '📚 Aula ' + pagina.aula + ' · ' + pagina.tema),
        criarElementoPerguntas('h2', 'aula-title', pergunta.titulo),
        criarCaixaPerguntas('🎯 CAPACIDADE', pergunta.capacidade),
        ...[criarCaixaOpcionalPerguntas('🎬 CONTEXTO', pergunta.contexto),
            criarCaixaOpcionalPerguntas('🎯 COMANDO', pergunta.comando)].filter(Boolean),
        criarElementoPerguntas('div', 'content-label questao-discursiva__rotulo-topicos',
            '✍️ RESPONDA CADA TÓPICO'));
    pergunta.topicos.filter((topico) => pontosPorTopico.has(topico.topico)).forEach((topico) =>
        secao.append(montarTopicoPratica(topico, { item: pergunta.item,
            pontos: pontosPorTopico.get(topico.topico),
            maximo: document.body.dataset.maximoCaracteres })));
    return secao;
}

/**
 * Lê do banco os itens ativos da atividade (sem a resposta certa).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<{item: number, topico: number, pontos: number|null}[]>} Itens ativos.
 */
async function lerItensAtivosPerguntas(atividadeId) {
    const resposta = await fetch(SUPABASE.URL + ROTA_ITENS_ATIVOS, {
        method: 'POST', headers: await sbH(),
        body: JSON.stringify({ p_atividade_id: atividadeId }),
    });
    if (!resposta.ok) throw new Error('itens_ativos: ' + resposta.status);
    return resposta.json();
}

/**
 * Atualiza os totais da página (body, textos marcados e título) com o que está ativo.
 * @param {number} totalItens - Quantidade de perguntas ativas.
 * @param {number} totalTopicos - Quantidade de tópicos ativos (0 na objetiva).
 */
function atualizarTotaisPerguntas(totalItens, totalTopicos) {
    document.body.dataset.total = totalItens;
    if (totalTopicos) document.body.dataset.topicos = totalTopicos;
    document.querySelectorAll('[data-perguntas-total]').forEach((no) => {
        no.textContent = totalItens + (totalTopicos ? ' (' + totalTopicos + ' tópicos)' : '');
    });
    document.querySelectorAll('[data-perguntas-total-simples]').forEach((no) => {
        no.textContent = totalItens;
    });
    document.querySelectorAll('[data-perguntas-pontos]').forEach((no) => {
        no.textContent = totalItens;
    });
    document.title = document.title.replace(/\(\d+ Questões/, '(' + totalItens + ' Questões');
}

/**
 * Monta os cards das perguntas ativas antes da âncora e remove a âncora.
 * @param {Object} dadosJson - Conteúdo do arquivo JSON.
 * @param {{item: number, topico: number, pontos: number|null}[]} ativos - Itens ativos.
 * @returns {{ancora: HTMLElement, ativos: number, topicosAtivos: number[]}} Estado montado.
 */
function montarPerguntas(dadosJson, ativos) {
    const ancora = document.getElementById(ID_ANCORA_PERGUNTAS);
    const itensAtivos = new Set(ativos.map((linha) => linha.item));
    const ehObjetiva = dadosJson.tipo === TIPO_OBJETIVA_PERGUNTAS;
    const pagina = { aula: document.body.dataset.aula, tema: document.body.dataset.tema };
    dadosJson.itens.filter((pergunta) => itensAtivos.has(pergunta.item)).forEach((pergunta) => {
        const pontos = new Map(ativos.filter((linha) => linha.item === pergunta.item)
            .map((linha) => [linha.topico, linha.pontos]));
        ancora.before(ehObjetiva ? montarCardObjetiva(pergunta)
            : montarCardPratica(pergunta, pontos, pagina));
    });
    atualizarTotaisPerguntas(itensAtivos.size, ehObjetiva ? 0 : ativos.length);
    return { ancora, ativos: itensAtivos.size,
        topicosAtivos: [...new Set(ativos.map((linha) => linha.topico))].filter(Boolean) };
}

/**
 * Põe a caixa "Liberar perguntas" (só professor) e tira a âncora. Falha não derruba a página.
 * @param {Object} dadosJson - Conteúdo do arquivo JSON.
 * @param {{ancora: HTMLElement, ativos: number, topicosAtivos: number[]}} estado - Resultado
 *     de montarPerguntas.
 */
async function prepararLiberacaoPerguntas(dadosJson, estado) {
    try {
        const base = SCRIPT_PERGUNTAS.src.replace(/[^/]*$/, '');
        await carregarScriptPerguntas(base + 'liberar-itens-professor.js');
        await window.mostrarLiberarItensProfessor({ atividadeId: dadosJson.atividadeId,
            total: dadosJson.itens.length, ativos: estado.ativos, tipo: dadosJson.tipo,
            topicosAtivos: estado.topicosAtivos, antesDe: estado.ancora });
    } catch (erro) {
        console.warn('Liberar perguntas:', erro.message);
    }
    estado.ancora.remove();
}

/**
 * Baixa um arquivo JSON do repositório.
 * @param {string} caminho - Caminho (relativo à página) ou URL do arquivo.
 * @param {string} rotulo - Nome usado na mensagem de erro.
 * @returns {Promise<Object>} Conteúdo do arquivo.
 * @throws {Error} Se a resposta não vier com sucesso.
 */
async function baixarJsonPerguntas(caminho, rotulo) {
    const resposta = await fetch(caminho, { cache: 'no-cache' });
    if (!resposta.ok) throw new Error(rotulo + ': ' + resposta.status);
    return resposta.json();
}

/**
 * Acha no índice da matéria (ATIVIDADES.json) o JSON de perguntas de uma atividade.
 * @param {string} atividadeId - Id da atividade (data-atividade-id).
 * @returns {Promise<string>} URL do JSON das perguntas, resolvida a partir do índice.
 * @throws {Error} Se o índice não tiver a atividade ou a entrada não tiver "json".
 */
async function acharJsonNoIndicePerguntas(atividadeId) {
    const caminhoIndice = SCRIPT_PERGUNTAS.dataset.indice || ARQUIVO_INDICE_PADRAO;
    const urlIndice = new URL(caminhoIndice, document.baseURI);
    const indice = await baixarJsonPerguntas(urlIndice.href, ROTULO_INDICE_PERGUNTAS);
    const atividades = Array.isArray(indice.atividades) ? indice.atividades : [];
    const entrada = atividades.find((item) => String(item.atividadeId) === atividadeId);
    if (!entrada) {
        throw new Error(ROTULO_INDICE_PERGUNTAS + ': atividade ' + atividadeId + ' não está em ' +
            urlIndice.href);
    }
    if (!entrada.json) {
        throw new Error(ROTULO_INDICE_PERGUNTAS + ': atividade ' + atividadeId + ' sem "json"');
    }
    return new URL(entrada.json, urlIndice).href;
}

/**
 * Descobre de onde vêm as perguntas: data-json (modo antigo) ou índice da matéria.
 * @returns {Promise<string>} Caminho ou URL do JSON das perguntas.
 * @throws {Error} Se o script não tiver data-json nem data-atividade-id.
 */
async function resolverCaminhoPerguntas() {
    const caminhoDireto = SCRIPT_PERGUNTAS.dataset.json;
    if (caminhoDireto) return caminhoDireto;

    const atividadeId = SCRIPT_PERGUNTAS.dataset.atividadeId;
    if (!atividadeId) throw new Error(MSG_SEM_ORIGEM_PERGUNTAS);
    return acharJsonNoIndicePerguntas(atividadeId);
}

/**
 * Confere se o atividadeId do JSON das perguntas bate com o data-atividade-id da página.
 * @param {Object} dadosJson - Conteúdo do JSON das perguntas.
 * @throws {Error} Se os dois ids forem diferentes.
 */
function conferirAtividadeIdPerguntas(dadosJson) {
    const esperado = SCRIPT_PERGUNTAS.dataset.atividadeId;
    if (!esperado) return;

    const estaIgual = String(dadosJson.atividadeId) === String(esperado);
    if (estaIgual) return;
    throw new Error(ROTULO_JSON_PERGUNTAS + ': atividadeId ' + dadosJson.atividadeId +
        ' diferente do esperado ' + esperado);
}

/**
 * Lê o arquivo JSON das perguntas (por data-json ou pelo índice da matéria).
 * @returns {Promise<Object>} Conteúdo do JSON.
 * @throws {Error} Se não achar o arquivo ou o atividadeId não bater.
 */
async function lerJsonPerguntas() {
    const caminho = await resolverCaminhoPerguntas();
    const dadosJson = await baixarJsonPerguntas(caminho, ROTULO_JSON_PERGUNTAS);
    conferirAtividadeIdPerguntas(dadosJson);
    return dadosJson;
}

/**
 * Mostra a falha no lugar das perguntas (sem plano B por HTML fixo).
 * @param {Error} erro - Erro ocorrido.
 */
function mostrarErroPerguntas(erro) {
    console.warn('Perguntas:', erro.message);
    const ancora = document.getElementById(ID_ANCORA_PERGUNTAS);
    const aviso = criarElementoPerguntas('div', 'aula-card', MSG_ERRO_PERGUNTAS);
    if (ancora) ancora.replaceWith(aviso);
}

/**
 * Roda os scripts da atividade como se fossem carregados com a página: os que esperam o
 * DOMContentLoaded (que já passou) são chamados depois que todos carregam.
 * @param {string[]} caminhos - Scripts da atividade, na ordem.
 */
async function carregarScriptsDaAtividadePerguntas(caminhos) {
    const esperando = [];
    const original = document.addEventListener.bind(document);
    document.addEventListener = (tipo, funcao, opcoes) => {
        if (tipo === 'DOMContentLoaded') esperando.push(funcao);
        else original(tipo, funcao, opcoes);
    };
    try {
        await carregarScriptsPerguntas(caminhos);
    } finally {
        document.addEventListener = original;
    }
    esperando.forEach((funcao) => funcao.call(document, new Event('DOMContentLoaded')));
}

/**
 * Fluxo do loader: scripts de base → JSON + itens ativos → cards → scripts da atividade.
 */
async function iniciarPerguntasJson() {
    try {
        await carregarScriptsPerguntas(lerListaPerguntas('antes'));
        const dadosJson = await lerJsonPerguntas();
        const estado = montarPerguntas(dadosJson,
            await lerItensAtivosPerguntas(dadosJson.atividadeId));
        await prepararLiberacaoPerguntas(dadosJson, estado);
    } catch (erro) {
        mostrarErroPerguntas(erro);
        return;
    }
    await carregarScriptsDaAtividadePerguntas(lerListaPerguntas('depois'));
}

iniciarPerguntasJson();
