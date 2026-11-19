// Card "Notas e média" do índice de atividades: cálculo puro (sem DOM, sem banco).
// A média é ponderada: Σ(nota × peso) ÷ Σ(peso), só das atividades com "Calcula Media" ligado
// (naMedia) e peso maior que zero. Atividade ligada e sem nota conta como ZERO.
// Consumido por card-notas-media.js.

const TEXTO_SEM_NOTA_CARD = '—';
const CASAS_DECIMAIS_CARD = 1;
const NOTA_AUSENTE_CARD = 0;

/**
 * Diz se um item entra na média ponderada.
 * @param {{nota: number|null, naMedia: boolean, peso: number}} item - Atividade do card.
 * @returns {boolean} true se está ligada na média e tem peso positivo (nota não é exigida).
 */
function itemEntraNaMediaCard(item) {
    const temPeso = Number(item.peso) > 0;
    return Boolean(item.naMedia) && temPeso;
}

/**
 * Nota usada na soma: a lançada, ou zero quando ausente ou inválida.
 * @param {{nota: number|null}} item - Atividade do card.
 * @returns {number} Nota numérica.
 */
function notaParaMediaCard(item) {
    const nota = item.nota === null || item.nota === undefined ? NaN : Number(item.nota);
    return Number.isNaN(nota) ? NOTA_AUSENTE_CARD : nota;
}

/**
 * Calcula a média ponderada das notas.
 * @param {{nota: number|null, naMedia: boolean, peso: number}[]} itens - Atividades do card.
 * @returns {{media: number|null, quantidadeNaMedia: number, quantidadeTotal: number,
 *     somaPesos: number}} Média (null sem itens válidos) e contagens.
 */
function calcularMediaPonderada(itens) {
    const lista = Array.isArray(itens) ? itens : [];
    const validos = lista.filter(itemEntraNaMediaCard);
    const somaPesos = validos.reduce((soma, item) => soma + Number(item.peso), 0);
    const resultado = { media: null, quantidadeNaMedia: validos.length,
        quantidadeTotal: lista.length, somaPesos };
    if (!validos.length) return resultado;

    const somaPonderada = validos
        .reduce((soma, item) => soma + notaParaMediaCard(item) * Number(item.peso), 0);
    resultado.media = somaPonderada / somaPesos;
    return resultado;
}

/**
 * Formata uma nota com uma casa decimal e vírgula.
 * @param {number|null|undefined} valor - Nota a formatar.
 * @returns {string} Ex.: "8,5"; "—" quando não há nota.
 */
function formatarNotaCard(valor) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
        return TEXTO_SEM_NOTA_CARD;
    }
    return Number(valor).toFixed(CASAS_DECIMAIS_CARD).replace('.', ',');
}
