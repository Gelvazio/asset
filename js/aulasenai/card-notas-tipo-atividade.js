// Coluna "Tipo" do card "Notas e média": combo por atividade (só o professor vê) que grava
// atividade.tipo_avaliacao (1 sala objetiva, 2 sala discursiva, 3 prova objetiva, 4 prova prática,
// vazio = sem tipo). A gravação usa o JWT do professor logado (política RLS
// atividade_update_professor; nunca service_role). Depois de gravar, descarta o cache de tipos da
// Média das Atividades e recalcula o rodapé do card.
// Depende de: js/supabase.js (sbPatch), card-notas-media-atividades.js (estadoMediaAtividades) e
// do mapa de ids de card-notas-media-repositorio.js ({id, nome, tipo} por página).

const TABELA_ATIVIDADE_TIPO_NOTAS = 'atividade';
const CLASSE_COMBO_TIPO_NOTAS = 'card-notas-media__tipo';
const ROTULO_ACESSIBILIDADE_TIPO_NOTAS = 'Tipo da atividade';
const VALOR_SEM_TIPO_NOTAS = '';
const MSG_ERRO_TIPO_NOTAS = 'Não foi possível gravar o tipo da atividade.';
const OPCOES_TIPO_NOTAS = [
    { valor: VALOR_SEM_TIPO_NOTAS, rotulo: 'Sem tipo' },
    { valor: '1', rotulo: 'Atividade de sala objetiva' },
    { valor: '2', rotulo: 'Atividade de sala discursiva' },
    { valor: '3', rotulo: 'Prova objetiva' },
    { valor: '4', rotulo: 'Prova prática' },
];

/**
 * Converte o tipo do banco no valor do combo.
 * @param {number|null|undefined} tipo - tipo_avaliacao da atividade.
 * @returns {string} Valor do combo ('' quando não há tipo).
 */
function valorDoComboTipoNotas(tipo) {
    return tipo === null || tipo === undefined ? VALOR_SEM_TIPO_NOTAS : String(tipo);
}

/**
 * Converte o valor do combo no tipo do banco.
 * @param {string} valor - Valor escolhido no combo.
 * @returns {number|null} tipo_avaliacao (null quando "Sem tipo").
 */
function tipoDoValorComboNotas(valor) {
    return valor === VALOR_SEM_TIPO_NOTAS ? null : Number(valor);
}

/**
 * Cria o combo com as opções de tipo, já no valor atual.
 * @param {number|null} tipoAtual - tipo_avaliacao atual da atividade.
 * @returns {HTMLSelectElement} Combo pronto.
 */
function criarListaTipoNotas(tipoAtual) {
    const lista = document.createElement('select');
    lista.className = CLASSE_COMBO_TIPO_NOTAS;
    lista.setAttribute('aria-label', ROTULO_ACESSIBILIDADE_TIPO_NOTAS);
    OPCOES_TIPO_NOTAS.forEach(({ valor, rotulo }) => {
        const opcao = document.createElement('option');
        opcao.value = valor;
        opcao.textContent = rotulo;
        lista.append(opcao);
    });
    lista.value = valorDoComboTipoNotas(tipoAtual);
    lista.dataset.tipo = lista.value;
    return lista;
}

/**
 * Grava o tipo no banco e guarda no mapa de ids; descarta o cache da Média das Atividades.
 * @param {{id: number, tipo: number|null}} registro - Registro da atividade no mapa de ids.
 * @param {string} valor - Valor escolhido no combo.
 * @throws {Error} Se o banco recusar a gravação (ex.: usuário sem permissão).
 */
async function gravarTipoAtividadeNotas(registro, valor) {
    const tipo = tipoDoValorComboNotas(valor);
    await sbPatch(TABELA_ATIVIDADE_TIPO_NOTAS, 'id', registro.id, { tipo_avaliacao: tipo });
    registro.tipo = tipo;
    estadoMediaAtividades.tipos = null;
    estadoMediaAtividades.leituras.clear();
}

/**
 * Cria o combo de tipo de uma atividade (para a célula da coluna "Tipo").
 * @param {{id: number, tipo: number|null}|undefined} registro - Registro da atividade no mapa
 *     de ids (sem registro, a atividade ainda não está no banco e o combo não aparece).
 * @param {function(): void} aoMudar - Recalcula o rodapé do card depois de gravar.
 * @returns {HTMLElement|string} Combo, ou '' se a atividade não está cadastrada.
 */
function criarComboTipoAtividadeNotas(registro, aoMudar) {
    if (!registro) return '';

    const lista = criarListaTipoNotas(registro.tipo);
    lista.addEventListener('change', async () => {
        lista.disabled = true;
        try {
            await gravarTipoAtividadeNotas(registro, lista.value);
            lista.dataset.tipo = lista.value;
            aoMudar();
        } catch (erro) {
            console.warn('Tipo da atividade:', erro.message);
            lista.value = valorDoComboTipoNotas(registro.tipo);
            lista.dataset.tipo = lista.value;
            window.mostrarPopup?.(MSG_ERRO_TIPO_NOTAS, { tipo: 'erro' });
        } finally {
            lista.disabled = false;
        }
    });
    return lista;
}

window.criarComboTipoAtividadeNotas = criarComboTipoAtividadeNotas;
