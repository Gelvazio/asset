// Atividade Dinâmica (tarefas #517 e SOLUCAO-DINAMICA-ALUNO): card da solução. O professor vê o
// card sempre, com a chave ON/OFF de liberação; o aluno só vê se o professor liberou e se ele já
// entregou (o banco decide e nunca manda o roteiro de fala ao aluno). Sem acesso, linha ausente,
// erro ou 401: não escreve nada na tela. Nenhum texto da solução fica neste arquivo.
// Depende de js/supabase.js, solucao-dinamica-repositorio.js, nota-dinamica-repositorio.js,
// dinamica-3d-controle.js e solucao-dinamica-svg.js. Regra: docs/regras/atividade-dinamica.md

const ID_CARD_SOLUCAO = 'dinamica-solucao';
const PADRAO_AULA_SOLUCAO = /AULA-(\d+)/i;
const TITULO_CARD_PROFESSOR = 'SOLUÇÃO DO PROFESSOR';
const TITULO_CARD_ALUNO = 'SOLUÇÃO DA ATIVIDADE';
const TEXTO_CHAVE_LIBERAR = 'Liberar para todos os alunos (só vê quem já entregou)';
const TITULO_PROBLEMAS_SOLUCAO = 'Problemas encontrados';
const TITULO_PASSOS_SOLUCAO = 'Redesenho passo a passo';
const TITULO_ROTEIRO_SOLUCAO = 'Roteiro de fala';
const TITULO_CHECKLIST_SOLUCAO = 'Checklist respondido';

/**
 * Cria um elemento com classe e texto (nunca HTML).
 * @param {string} etiqueta - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto.
 * @returns {HTMLElement} Elemento criado.
 */
function criarNoSolucao(etiqueta, classe, texto) {
    const no = document.createElement(etiqueta);
    if (classe) no.className = classe;
    if (texto !== undefined) no.textContent = texto;
    return no;
}

/**
 * Cria uma lista de itens, cada um com um título em negrito e um texto.
 * @param {Object[]} itens - Itens da lista.
 * @param {function(Object): string[]} extrair - Devolve [título, texto] de um item.
 * @returns {HTMLOListElement} Lista pronta.
 */
function criarListaSolucao(itens, extrair) {
    const lista = criarNoSolucao('ol', 'dinamica__roteiro');
    itens.forEach((item) => {
        const [titulo, texto] = extrair(item);
        const linha = criarNoSolucao('li');
        linha.append(criarNoSolucao('strong', '', titulo), criarNoSolucao('span', '', ' ' + texto));
        lista.append(linha);
    });
    return lista;
}

/**
 * Cria uma seção do card com título e conteúdo.
 * @param {string} titulo - Título da seção.
 * @param {HTMLElement} conteudo - Conteúdo.
 * @returns {HTMLElement} Seção.
 */
function criarSecaoSolucao(titulo, conteudo) {
    const secao = criarNoSolucao('div', 'dinamica__solucao-secao');
    secao.append(criarNoSolucao('h3', '', titulo), conteudo);
    return secao;
}

/**
 * Número da aula desta página, lido do nome do arquivo (ex.: ATIVIDADE-DINAMICA-AULA-02).
 * @returns {string|null} Número com dois dígitos, ou null.
 */
function lerNumeroAulaSolucao() {
    const achado = PADRAO_AULA_SOLUCAO.exec(obterPaginaDaDinamica());
    return achado ? achado[1].padStart(2, '0') : null;
}

/**
 * Lista "antes": a tela original registrada pela própria atividade, se existir.
 * @returns {Object[]|null} Elementos da tela original, ou null.
 */
function lerTelaAntesSolucao() {
    const aula = lerNumeroAulaSolucao();
    if (!aula || typeof obterDinamica3d !== 'function') return null;

    return obterDinamica3d(aula)?.tela || null;
}

/**
 * Monta o conteúdo do card a partir do jsonb da solução.
 * @param {Object} solucao - Conteúdo de solucao_professor_dinamica.
 * @returns {DocumentFragment} Partes do card.
 */
function montarConteudoSolucao(solucao) {
    const partes = document.createDocumentFragment();
    partes.append(criarNoSolucao('p', 'dinamica__texto', solucao.resumo));
    partes.append(criarComparacaoTelasSolucao(lerTelaAntesSolucao(), solucao.tela_depois));
    partes.append(criarSecaoSolucao(TITULO_PROBLEMAS_SOLUCAO, criarListaSolucao(
        solucao.problemas, (item) => [item.titulo + '.', item.por_que])));
    partes.append(criarSecaoSolucao(TITULO_PASSOS_SOLUCAO, criarListaSolucao(
        solucao.passos, (item) => [item.titulo + '.', item.acao + ' ' + item.por_que])));
    if (solucao.roteiro) {
        partes.append(criarSecaoSolucao(TITULO_ROTEIRO_SOLUCAO, criarListaSolucao(
            solucao.roteiro, (item) => ['Minuto ' + item.minuto + ':', item.fala])));
    }
    partes.append(criarSecaoSolucao(TITULO_CHECKLIST_SOLUCAO, criarListaSolucao(
        solucao.checklist, (item) => [item.pergunta, item.resposta])));
    return partes;
}

/**
 * Cria a chave ON/OFF que libera a solução para os alunos (só o professor a recebe).
 * @param {number} atividadeId - Id da atividade.
 * @param {boolean} liberadaInicial - Estado atual da liberação.
 * @returns {HTMLLabelElement} Rótulo com a chave (checkbox global ON/OFF) pronta.
 */
function criarChaveLiberarSolucao(atividadeId, liberadaInicial) {
    const rotulo = criarNoSolucao('label', 'dinamica__chave-solucao');
    const chave = criarNoSolucao('input');
    chave.type = 'checkbox';
    chave.checked = liberadaInicial;
    chave.addEventListener('change', async () => {
        const novoValor = chave.checked;
        chave.disabled = true;
        try {
            chave.checked = await definirSolucaoLiberada(atividadeId, novoValor);
        } catch (erro) {
            chave.checked = !novoValor;
            alert(erro.message);
        }
        chave.disabled = false;
    });
    rotulo.append(chave, criarNoSolucao('span', '', TEXTO_CHAVE_LIBERAR));
    return rotulo;
}

/**
 * Mostra o card para quem o banco liberou; em qualquer outro caso ou erro, não faz nada.
 * @returns {Promise<void>}
 */
async function iniciarSolucaoDaDinamica() {
    const card = document.getElementById(ID_CARD_SOLUCAO);
    if (!card) return;

    try {
        const solucao = await lerSolucaoDaDinamica();
        if (!solucao) return;

        const titulo = solucao.professor ? TITULO_CARD_PROFESSOR : TITULO_CARD_ALUNO;
        card.append(criarNoSolucao('h2', '', titulo));
        if (solucao.professor) {
            card.append(criarChaveLiberarSolucao(solucao.atividadeId, solucao.liberada));
        }
        card.append(montarConteudoSolucao(solucao.conteudo));
        card.hidden = false;
    } catch (erro) {
        card.replaceChildren();
    }
}

document.addEventListener('DOMContentLoaded', iniciarSolucaoDaDinamica);
