// Filtro "Somente Atividades Pendentes" no cabeçalho do card "Notas e média" do índice de
// atividades. Ligado, esconde os cards de aula em verde (classe card-atividade-concluida, posta
// pelo indice-atividades-pendentes.js). O verde só existe para o professor; por isso a chave
// só aparece quando o interruptor "Mostrar" do card (só do professor) está à vista.
// Reaplica a ocultação a cada repintura da grade com um MutationObserver.
// Carregado DEPOIS de card-notas-media.js, de quem usa criarInterruptorSimplesNotas e
// pintarInterruptorNotas.

const CHAVE_SOMENTE_PENDENTES = 'indice-atividades:somente-pendentes';
const VALOR_LIGADO_SOMENTE_PENDENTES = 'sim';
const VALOR_DESLIGADO_SOMENTE_PENDENTES = 'nao';
const ROTULO_SOMENTE_PENDENTES = 'Somente Atividades Pendentes';
const SELETOR_GRADE_SOMENTE_PENDENTES = 'section.grade';
const SELETOR_CABECALHO_SOMENTE_PENDENTES = '.card-notas-media__cabecalho';
const SELETOR_VISIBILIDADE_SOMENTE_PENDENTES = '.card-notas-media__visibilidade';
const CLASSE_CARD_VERDE_SOMENTE_PENDENTES = 'card-atividade-concluida';
const CLASSE_CARD_OCULTO_SOMENTE_PENDENTES = 'aula--oculta-pendentes';
const CLASSE_CHAVE_SOMENTE_PENDENTES = 'card-notas-media__somente-pendentes';

const estadoSomentePendentes = { ligado: false, botao: null };

/**
 * Lê no localStorage se o filtro ficou ligado; sem valor salvo, vale OFF.
 * @returns {boolean} true só se o valor salvo for "sim".
 */
function lerPreferenciaSomentePendentes() {
    try {
        return localStorage.getItem(CHAVE_SOMENTE_PENDENTES) === VALOR_LIGADO_SOMENTE_PENDENTES;
    } catch (erro) {
        return false;
    }
}

/**
 * Guarda no localStorage o estado do filtro (sem falhar se for bloqueado).
 * @param {boolean} ligado - Estado do filtro.
 */
function salvarPreferenciaSomentePendentes(ligado) {
    try {
        localStorage.setItem(CHAVE_SOMENTE_PENDENTES,
            ligado ? VALOR_LIGADO_SOMENTE_PENDENTES : VALOR_DESLIGADO_SOMENTE_PENDENTES);
    } catch (erro) {
        console.warn('Filtro de pendentes não salvo no navegador:', erro.message);
    }
}

/**
 * Esconde (filtro ligado) ou mostra os cards de aula em verde da grade.
 * Só mexe na classe quando o valor muda, para não disparar o observador à toa.
 */
function aplicarOcultacaoSomentePendentes() {
    const cards = document.querySelectorAll(SELETOR_GRADE_SOMENTE_PENDENTES + ' article.aula');
    cards.forEach((card) => {
        const deveOcultar = estadoSomentePendentes.ligado &&
            card.classList.contains(CLASSE_CARD_VERDE_SOMENTE_PENDENTES);
        if (card.classList.contains(CLASSE_CARD_OCULTO_SOMENTE_PENDENTES) !== deveOcultar) {
            card.classList.toggle(CLASSE_CARD_OCULTO_SOMENTE_PENDENTES, deveOcultar);
        }
    });
}

/**
 * Trata o clique na chave: guarda o estado, repinta a chave e refaz a ocultação.
 */
function alternarSomentePendentes() {
    estadoSomentePendentes.ligado = !estadoSomentePendentes.ligado;
    salvarPreferenciaSomentePendentes(estadoSomentePendentes.ligado);
    pintarInterruptorNotas(estadoSomentePendentes.botao, estadoSomentePendentes.ligado);
    aplicarOcultacaoSomentePendentes();
}

/**
 * Cria a chave no cabeçalho do card, antes da chave "Mostrar", se ainda não existir.
 * Só cria quando a área da chave "Mostrar" está visível (professor).
 */
function garantirChaveSomentePendentes() {
    const cabecalho = document.querySelector(SELETOR_CABECALHO_SOMENTE_PENDENTES);
    const visibilidade = cabecalho?.querySelector(SELETOR_VISIBILIDADE_SOMENTE_PENDENTES);
    if (!visibilidade || visibilidade.hidden) return;
    if (cabecalho.contains(estadoSomentePendentes.botao)) return;

    const controle = criarInterruptorSimplesNotas(ROTULO_SOMENTE_PENDENTES);
    controle.etiqueta.classList.add(CLASSE_CHAVE_SOMENTE_PENDENTES);
    controle.botao.addEventListener('click', alternarSomentePendentes);
    estadoSomentePendentes.botao = controle.botao;
    pintarInterruptorNotas(controle.botao, estadoSomentePendentes.ligado);
    cabecalho.insertBefore(controle.etiqueta, visibilidade);
}

/**
 * Refaz a chave e a ocultação depois de qualquer mudança relevante na página.
 */
function atualizarSomentePendentes() {
    garantirChaveSomentePendentes();
    aplicarOcultacaoSomentePendentes();
}

/**
 * Liga o filtro: lê a preferência e observa a página para reaplicar após cada repintura.
 */
function iniciarFiltroSomentePendentes() {
    estadoSomentePendentes.ligado = lerPreferenciaSomentePendentes();
    const observador = new MutationObserver(atualizarSomentePendentes);
    observador.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
    });
    atualizarSomentePendentes();
}

iniciarFiltroSomentePendentes();
