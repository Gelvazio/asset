// Liga o índice de atividades (MATERIAIS/**/ATIVIDADES/index.html) ao status em tempo real
// (REALTIME-STATUS-ATIVIDADES.16 e .17; decisões em docs/realtime-atividades.md).
// .17: assim que o cliente Supabase e a matéria do índice são conhecidos, chama
// RealtimeAtividades.iniciar({ cliente, materiaId }) (assets/js/realtime-atividades.js). A
// matéria vem das aulas da grade do banco (estadoCardsAula, indice-aula-data.js) ou, sem aulas,
// do nome da pasta (descobrirMateriaDoIndice). Visitante sem login não assina (item 3.2).
// .16: no índice do professor, o aviso 'atividades-status-alterado' remonta os ON/OFF
// (montarInterruptoresBloquear, indice-atividades-bloqueio.js), que só LEEM o banco: não há
// gravação nem novo aviso, então não há loop. O aviso gerado pela própria gravação do professor
// é absorvido: enquanto um ON/OFF grava (botão desabilitado) ou logo depois de um clique, a
// remontagem espera e acontece uma vez só, já com o valor gravado no banco.
// Carregado por assets/js/atividades-crud-modal.js (carregarRealtimeIndice), depois do
// indice-aula-data.js e do realtime-atividades.js. Sem segredo: usa o cliente de js/supabase.js.

const EVENTO_STATUS_REALTIME_INDICE = 'atividades-status-alterado';
const EVENTO_CARDS_MONTADOS_REALTIME = 'cards-aula-montados';
// Mesmo evento do botão da aula: plano B se a função de remontagem não existir.
const EVENTO_REMONTAR_INTERRUPTORES_REALTIME = 'aula-bloqueio-alterado';
const SELETOR_INTERRUPTOR_REALTIME = '.interruptor-atividade';
const SELETOR_CAIXA_GRAVANDO_REALTIME = '.interruptor-atividade input:disabled';
// Janela em que um aviso é tratado como eco da gravação feita nesta aba (ms).
const JANELA_ECO_GRAVACAO_MS = 3000;
// Intervalo para conferir de novo se a gravação local já terminou (ms).
const ESPERA_GRAVACAO_LOCAL_MS = 500;

const estadoRealtimeIndice = {
    iniciado: false,
    materiaId: null,
    ehProfessor: false,
    ultimaGravacaoLocal: 0,
    remontagemAgendada: null,
    remontando: false,
    remontarDeNovo: false,
};

/**
 * Diz se há usuário logado (o visitante sem login não assina o canal).
 * @returns {Promise<boolean>} true com sessão do Supabase Auth.
 */
async function haUsuarioLogadoRealtime() {
    if (typeof obterTokenUsuario !== 'function') return false;
    try {
        return Boolean(await obterTokenUsuario());
    } catch (erro) {
        return false;
    }
}

/**
 * Id da matéria do índice, pelas aulas dos cards já montados ou pelo nome da pasta.
 * @returns {Promise<number|null>} Id da matéria ou null.
 */
async function descobrirMateriaRealtime() {
    if (typeof descobrirMateriaDoIndice !== 'function') return null;
    const cards = typeof estadoCardsAula === 'object' ? estadoCardsAula.cards : [];
    try {
        return await descobrirMateriaDoIndice(cards || []);
    } catch (erro) {
        console.warn('Realtime: matéria do índice não encontrada:', erro.message);
        return null;
    }
}

/**
 * Inicia o Realtime uma vez só, quando cliente, matéria e login estão prontos.
 * Falha não quebra o índice (a tela continua com a releitura ao abrir).
 */
async function iniciarRealtimeDoIndice() {
    const modulo = window.RealtimeAtividades;
    if (estadoRealtimeIndice.iniciado || !modulo || !modulo.ATIVO) return;
    const cliente = typeof obterClienteSupabase === 'function' ? obterClienteSupabase() : null;
    if (!cliente || !await haUsuarioLogadoRealtime()) return;

    const materiaId = await descobrirMateriaRealtime();
    if (!materiaId || estadoRealtimeIndice.iniciado) return;

    estadoRealtimeIndice.iniciado = true;
    estadoRealtimeIndice.materiaId = Number(materiaId);
    estadoRealtimeIndice.ehProfessor = typeof estadoCardsAula === 'object' &&
        Boolean(estadoCardsAula.ehProfessor);
    try {
        modulo.iniciar({ cliente, materiaId: estadoRealtimeIndice.materiaId });
    } catch (erro) {
        console.warn('Realtime indisponível no índice:', erro.message);
    }
}

/**
 * Diz se o ON/OFF desta aba gravou há pouco ou ainda está gravando.
 * @returns {boolean} true enquanto o aviso pode ser eco da gravação local.
 */
function gravacaoLocalRecente() {
    if (document.querySelector(SELETOR_CAIXA_GRAVANDO_REALTIME)) return true;
    return Date.now() - estadoRealtimeIndice.ultimaGravacaoLocal < JANELA_ECO_GRAVACAO_MS;
}

/**
 * Relê o banco e refaz os ON/OFF (só leitura: não grava nem dispara o aviso do Realtime).
 * Pedido que chega durante a remontagem vira uma remontagem a mais, no fim.
 */
async function remontarInterruptoresRealtime() {
    if (estadoRealtimeIndice.remontando) {
        estadoRealtimeIndice.remontarDeNovo = true;
        return;
    }
    estadoRealtimeIndice.remontando = true;
    try {
        if (typeof montarInterruptoresBloquear === 'function') await montarInterruptoresBloquear();
        else document.dispatchEvent(new CustomEvent(EVENTO_REMONTAR_INTERRUPTORES_REALTIME));
    } catch (erro) {
        console.warn('Realtime: ON/OFF não foi refeito:', erro.message);
    } finally {
        estadoRealtimeIndice.remontando = false;
    }
    if (!estadoRealtimeIndice.remontarDeNovo) return;
    estadoRealtimeIndice.remontarDeNovo = false;
    agendarRemontagemRealtime();
}

/**
 * Agenda uma remontagem só; espera a gravação local terminar (absorve o eco dela).
 */
function agendarRemontagemRealtime() {
    if (estadoRealtimeIndice.remontagemAgendada) return;
    const tentar = () => {
        if (gravacaoLocalRecente()) {
            estadoRealtimeIndice.remontagemAgendada = setTimeout(tentar, ESPERA_GRAVACAO_LOCAL_MS);
            return;
        }
        estadoRealtimeIndice.remontagemAgendada = null;
        remontarInterruptoresRealtime();
    };
    tentar();
}

/**
 * Trata o aviso do Realtime no índice do professor (o do aluno fica com .10 a .15).
 * @param {CustomEvent} evento - detail { materiaId, versao, origem }.
 */
function aoMudarStatusRealtimeProfessor(evento) {
    if (!estadoRealtimeIndice.ehProfessor) return;
    const materia = Number(evento.detail?.materiaId);
    if (materia && materia !== estadoRealtimeIndice.materiaId) return;
    if (!document.querySelector(SELETOR_INTERRUPTOR_REALTIME)) return;

    agendarRemontagemRealtime();
}

/**
 * Marca o clique no ON/OFF desta aba (o aviso que vier logo depois é eco dele).
 * @param {Event} evento - change de qualquer elemento da página.
 */
function marcarGravacaoLocalRealtime(evento) {
    if (evento.target?.closest?.(SELETOR_INTERRUPTOR_REALTIME)) {
        estadoRealtimeIndice.ultimaGravacaoLocal = Date.now();
    }
}

document.addEventListener('change', marcarGravacaoLocalRealtime, true);
document.addEventListener(EVENTO_STATUS_REALTIME_INDICE, aoMudarStatusRealtimeProfessor);
document.addEventListener(EVENTO_CARDS_MONTADOS_REALTIME, () => iniciarRealtimeDoIndice());
// Se a grade já ficou pronta antes deste arquivo rodar, não espera o evento.
if (typeof estadoCardsAula === 'object' && estadoCardsAula.cards.length) iniciarRealtimeDoIndice();
