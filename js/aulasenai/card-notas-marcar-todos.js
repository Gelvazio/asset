// Card "Notas e média": interruptor "Marcar Todos(Calcula Media)" (só professor).
// Liga/desliga calcula_media de todas as atividades da turma escolhida, direto no banco.
// Usa globais de card-notas-media.js (estadoNotas, criarInterruptorSimplesNotas, ...) só em
// tempo de chamada; por isso pode carregar antes dele.

const ROTULO_MARCAR_TODOS_NOTAS = 'Marcar Todos(Calcula Media)';
const MSG_FALHA_MARCAR_TODOS_NOTAS = 'Não foi possível gravar a configuração da média.';

let controleMarcarTodosNotas = null;

const ROTULO_SELECIONAR_ATIVIDADE_NOTAS = 'Selecionar atividade';
const ROTULO_SELECIONAR_TODAS_NOTAS = 'Selecionar todas as atividades';

// Seleção das linhas: todas nascem marcadas; só as desmarcadas ficam guardadas, por turma.
const desmarcadasNotas = new Set();
let turmaDaSelecaoNotas = null;
let caixaTodasNotas = null;

/**
 * Zera a seleção (todas marcadas) quando a turma do combo mudou desde a última leitura.
 */
function sincronizarSelecaoComTurmaNotas() {
    if (turmaDaSelecaoNotas === estadoNotas.turma) return;

    turmaDaSelecaoNotas = estadoNotas.turma;
    desmarcadasNotas.clear();
}

/**
 * Diz se a linha da atividade está marcada.
 * @param {string} pagina - Página da atividade.
 * @returns {boolean} true se marcada.
 */
function estaMarcadaNotas(pagina) {
    sincronizarSelecaoComTurmaNotas();
    return !desmarcadasNotas.has(pagina);
}

/**
 * Lista as atividades visíveis, marcadas e com cadastro no banco.
 * @returns {Array<{pagina: string, id: number}>} Páginas com o id da atividade.
 */
function listarAtividadesComIdNotas() {
    const lista = [];
    listarAtividadesVisiveisNotas().forEach(({ pagina }) => {
        const id = estadoNotas.ids.get(pagina)?.id;
        if (id && estaMarcadaNotas(pagina)) lista.push({ pagina, id });
    });
    return lista;
}

/**
 * Repinta a chave "todas" do cabeçalho conforme as linhas visíveis.
 */
function atualizarCaixaTodasNotas() {
    if (!caixaTodasNotas) return;

    const visiveis = listarAtividadesVisiveisNotas();
    caixaTodasNotas.checked = visiveis.length > 0
        && visiveis.every(({ pagina }) => estaMarcadaNotas(pagina));
    caixaTodasNotas.disabled = !visiveis.length;
}

/**
 * Cria um checkbox (exibido como chave ON/OFF pelo CSS do card).
 * @param {string} rotulo - Texto de acessibilidade.
 * @param {boolean} marcado - Estado inicial.
 * @returns {HTMLInputElement} Checkbox real.
 */
function criarCaixaSelecaoNotas(rotulo, marcado) {
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = marcado;
    caixa.setAttribute('aria-label', rotulo);
    return caixa;
}

/**
 * Cria o checkbox de seleção de uma linha de atividade.
 * @param {string} pagina - Página da atividade.
 * @returns {HTMLInputElement} Checkbox ligado à seleção.
 */
function criarCaixaLinhaNotas(pagina) {
    const caixa = criarCaixaSelecaoNotas(ROTULO_SELECIONAR_ATIVIDADE_NOTAS,
        estaMarcadaNotas(pagina));
    caixa.addEventListener('change', () => {
        if (caixa.checked) desmarcadasNotas.delete(pagina);
        else desmarcadasNotas.add(pagina);
        atualizarCaixaTodasNotas();
        atualizarInterruptorMarcarTodosNotas();
    });
    return caixa;
}

/**
 * Cria o checkbox "selecionar todas" do cabeçalho (marca/desmarca as linhas visíveis).
 * @returns {HTMLInputElement} Checkbox do cabeçalho.
 */
function criarCaixaTodasNotas() {
    const caixa = criarCaixaSelecaoNotas(ROTULO_SELECIONAR_TODAS_NOTAS, false);
    caixa.addEventListener('change', () => {
        listarAtividadesVisiveisNotas().forEach(({ pagina }) => {
            if (caixa.checked) desmarcadasNotas.delete(pagina);
            else desmarcadasNotas.add(pagina);
        });
        renderizarTabelaNotas();
    });
    caixaTodasNotas = caixa;
    atualizarCaixaTodasNotas();
    return caixa;
}

/**
 * Diz se todas as atividades da turma calculam média (sem linha de configuração = ligado).
 * @param {Array<{pagina: string}>} atividades - Atividades com id.
 * @returns {boolean} true se todas estão ligadas.
 */
function todasCalculamMediaNotas(atividades) {
    return atividades.every(({ pagina }) => lerConfiguracaoNotas(pagina).naMedia);
}

/**
 * Grava calcula_media de várias atividades da turma num único POST (upsert).
 * Não envia o peso: o peso já gravado fica como está.
 * @param {{atividades: Array<{id: number}>, turma: string, ligado: boolean}} lote - Dados.
 * @returns {Promise<void>}
 * @throws {Error} Se o banco recusar a gravação.
 */
async function gravarCalculaMediaEmLoteNotas({ atividades, turma, ligado }) {
    const agora = new Date().toISOString();
    const corpo = atividades.map(({ id }) => ({ atividade_id: id, turma_codigo: turma,
        calcula_media: ligado, atualizado_em: agora }));
    const resposta = await fetch(SUPABASE.URL + '/rest/v1/' + TABELA_CONFIG_CARD +
        '?on_conflict=atividade_id,turma_codigo', {
        method: 'POST',
        headers: { ...(await sbH()),
            Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(corpo),
    });
    if (resposta.ok) return;

    const detalhe = await resposta.text();
    throw new Error(detalhe || MSG_FALHA_MARCAR_TODOS_NOTAS);
}

/**
 * Aplica o novo estado na configuração em memória, mantendo o peso de cada atividade.
 * @param {Array<{pagina: string}>} atividades - Atividades com id.
 * @param {boolean} ligado - Novo valor de naMedia.
 */
function aplicarMarcarTodosNaTelaNotas(atividades, ligado) {
    atividades.forEach(({ pagina }) => {
        const atual = lerConfiguracaoNotas(pagina);
        estadoNotas.configuracao.set(pagina, { ...atual, naMedia: ligado });
    });
}

/**
 * Trata o clique: grava em lote no banco e só então atualiza a tela.
 * @param {HTMLButtonElement} botao - Botão do interruptor.
 */
async function aoClicarMarcarTodosNotas(botao) {
    const turma = estadoNotas.turma;
    const atividades = listarAtividadesComIdNotas();
    if (!turma || !atividades.length) return;

    const ligado = !todasCalculamMediaNotas(atividades);
    botao.disabled = true;
    try {
        await gravarCalculaMediaEmLoteNotas({ atividades, turma, ligado });
        if (estadoNotas.turma !== turma) return;

        aplicarMarcarTodosNaTelaNotas(atividades, ligado);
        mostrarAvisoNotas('');
        renderizarTabelaNotas();
    } catch (erro) {
        mostrarAvisoNotas(MSG_ERRO_GRAVAR_NOTAS + erro.message, true);
    } finally {
        botao.disabled = false;
        atualizarInterruptorMarcarTodosNotas();
    }
}

/**
 * Cria o interruptor "Marcar Todos(Calcula Media)" para a faixa de filtros.
 * @returns {HTMLLabelElement} Rótulo com a chave ON/OFF, oculto até o perfil professor.
 */
function criarInterruptorMarcarTodosNotas() {
    const controle = criarInterruptorSimplesNotas(ROTULO_MARCAR_TODOS_NOTAS);
    controle.etiqueta.hidden = true;
    controle.botao.addEventListener('click', () => aoClicarMarcarTodosNotas(controle.botao));
    controleMarcarTodosNotas = controle;
    atualizarInterruptorMarcarTodosNotas();
    return controle.etiqueta;
}

/**
 * Repinta o interruptor (ON/OFF/desabilitado) a partir da configuração atual.
 */
function atualizarInterruptorMarcarTodosNotas() {
    if (!controleMarcarTodosNotas) return;

    const { etiqueta, botao } = controleMarcarTodosNotas;
    etiqueta.hidden = !estadoNotas.ehProfessor;
    const atividades = listarAtividadesComIdNotas();
    const estaHabilitado = Boolean(estadoNotas.turma) && atividades.length > 0;
    pintarInterruptorNotas(botao, estaHabilitado && todasCalculamMediaNotas(atividades));
    botao.disabled = !estaHabilitado;
}

window.criarCaixaLinhaNotas = criarCaixaLinhaNotas;
window.criarCaixaTodasNotas = criarCaixaTodasNotas;
window.criarInterruptorMarcarTodosNotas = criarInterruptorMarcarTodosNotas;
window.atualizarInterruptorMarcarTodosNotas = atualizarInterruptorMarcarTodosNotas;
