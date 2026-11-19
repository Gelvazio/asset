// Trava de horário da atividade — tela do ALUNO (TRAVA-HORARIO-ATIVIDADE-16-11-2026.3).
// Global: carregado por respostas-atividade.js (objetivas) e avaliacao-discursiva.js
// (discursivas). O professor define INÍCIO e FIM por turma no Quadro de Progresso
// (trava-horario-professor.js). Hora sempre do SERVIDOR (RPC janela_atividade_aluno devolve
// now()); o relógio do aluno só conta o tempo entre uma leitura e outra.
//  • antes do início: cobertura bloqueia a atividade, com contagem regressiva;
//  • durante: faixa com o tempo restante;
//  • no fim (ou se o professor mudar a trava): a página RECARREGA sozinha.
// O banco também recusa gravar/entregar fora da trava (pode_responder_no_horario, RLS).
// Depende de js/supabase.js (SUPABASE, sbH). SQL: database/2026-11-16-trava-horario-atividade.sql.
// Card de controle do professor (pausa/fim): controle-atividade-aluno.js, carregado aqui; com
// estado, a trava não desenha (database/2026-11-16-card-controle-atividade.sql).

const ROTA_JANELA_ALUNO = '/rest/v1/rpc/janela_atividade_aluno';
const INTERVALO_TIQUE_TRAVA_MS = 1000;
const INTERVALO_CONFERIR_TRAVA_MS = 60000;
const ESPERA_RECARREGAR_TRAVA_MS = 1500;
const CLASSE_TRAVA_ALUNO = 'trava-horario';
const ARQUIVO_CSS_TRAVA = '../css/trava-horario.css';
const BASE_SCRIPTS_TRAVA = document.currentScript?.src.replace(/[^/]*$/, '') || '';
const FUSO_TRAVA = 'America/Sao_Paulo';
const estadoTravaAluno = { atividadeId: null, janela: null, desvioMs: 0, mostrada: null,
    faixa: null, cobertura: null, recarregando: false };

/**
 * Lê a trava do aluno no banco (situação, início, fim e hora do servidor).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<{situacao: string, inicia_em: ?string, encerra_em: ?string, agora: string}>}
 * @throws {Error} Se o banco recusar.
 */
async function lerJanelaDoAluno(atividadeId) {
    const resposta = await fetch(SUPABASE.URL + ROTA_JANELA_ALUNO, {
        method: 'POST', headers: await sbH(), body: JSON.stringify({ p_atividade: atividadeId }),
    });
    if (!resposta.ok) throw new Error('trava de horário: erro ' + resposta.status);
    return resposta.json();
}

/**
 * Hora atual do servidor (relógio local corrigido pelo desvio medido na última leitura).
 * @returns {number} Milissegundos.
 */
function agoraDoServidor() {
    return Date.now() + estadoTravaAluno.desvioMs;
}

/**
 * Situação da trava agora, pela hora do servidor.
 * @returns {string} 'sem_janela', 'antes', 'durante' ou 'encerrada'.
 */
function situacaoDaTrava() {
    const janela = estadoTravaAluno.janela;
    if (!janela?.inicia_em || !janela?.encerra_em) return 'sem_janela';
    const agora = agoraDoServidor();
    if (agora < Date.parse(janela.inicia_em)) return 'antes';
    if (agora >= Date.parse(janela.encerra_em)) return 'encerrada';
    return 'durante';
}

/**
 * Duração em texto (ex.: "1d 02:05:09" ou "00:04:30").
 * @param {number} ms - Milissegundos.
 * @returns {string} Duração formatada.
 */
function formatarDuracaoTrava(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const dias = Math.floor(total / 86400);
    const partes = [Math.floor(total % 86400 / 3600), Math.floor(total % 3600 / 60), total % 60]
        .map((valor) => String(valor).padStart(2, '0')).join(':');
    return (dias ? dias + 'd ' : '') + partes;
}

/**
 * Data e hora de Brasília (ex.: "16/11/2026 19:00").
 * @param {string} iso - Data ISO.
 * @returns {string} Texto.
 */
function formatarDataHoraTrava(iso) {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO_TRAVA, dateStyle: 'short',
        timeStyle: 'short' });
}

/**
 * Cria (uma vez) um elemento da trava e põe no body.
 * @param {string} chave - 'faixa' ou 'cobertura'.
 * @returns {HTMLElement} Elemento.
 */
function garantirElementoTrava(chave) {
    if (!estadoTravaAluno[chave]) {
        const elemento = document.createElement('div');
        elemento.className = CLASSE_TRAVA_ALUNO + '__' + chave;
        elemento.setAttribute('role', 'status');
        if (chave === 'faixa') document.body.prepend(elemento);
        else document.body.appendChild(elemento);
        estadoTravaAluno[chave] = elemento;
    }
    return estadoTravaAluno[chave];
}

/**
 * Desliga os campos de resposta da página (o banco já recusa; aqui é só para o aluno ver).
 */
function travarCamposDeResposta() {
    document.querySelectorAll('.content-section input, .content-section textarea')
        .forEach((campo) => { campo.disabled = true; });
}

/**
 * Desenha a trava conforme a situação.
 * @param {string} situacao - Situação atual.
 */
function desenharTrava(situacao) {
    const janela = estadoTravaAluno.janela;
    const agora = agoraDoServidor();
    if (situacao === 'antes') {
        const cobertura = garantirElementoTrava('cobertura');
        cobertura.textContent = '🔒 Atividade bloqueada até ' +
            formatarDataHoraTrava(janela.inicia_em) + ' (horário de Brasília). Começa em ' +
            formatarDuracaoTrava(Date.parse(janela.inicia_em) - agora) + '.';
    } else if (situacao === 'durante') {
        garantirElementoTrava('faixa').textContent = '⏳ Tempo restante: ' +
            formatarDuracaoTrava(Date.parse(janela.encerra_em) - agora) + ' — encerra às ' +
            formatarDataHoraTrava(janela.encerra_em) + '.';
    } else if (situacao === 'encerrada') {
        garantirElementoTrava('faixa').textContent = '⛔ Atividade encerrada em ' +
            formatarDataHoraTrava(janela.encerra_em) + '. Não é mais possível responder.';
        travarCamposDeResposta();
    }
}

/**
 * Recarrega a página uma vez (com uma folga para o servidor já estar na nova situação).
 */
function recarregarPorTrava() {
    if (estadoTravaAluno.recarregando) return;
    estadoTravaAluno.recarregando = true;
    setTimeout(() => window.location.reload(), ESPERA_RECARREGAR_TRAVA_MS);
}

/**
 * A cada segundo: atualiza o contador; se a situação mudou (início/fim), recarrega.
 */
function tiqueDaTrava() {
    if (window.controleSobrepoeTrava?.()) return;
    const situacao = situacaoDaTrava();
    if (estadoTravaAluno.mostrada !== null && situacao !== estadoTravaAluno.mostrada) {
        recarregarPorTrava();
        return;
    }
    estadoTravaAluno.mostrada = situacao;
    desenharTrava(situacao);
}

/**
 * Relê a trava no servidor (o professor pode ter mudado o horário) e acerta o desvio.
 * Uma falha mantém a última leitura.
 */
async function conferirTravaNoServidor() {
    try {
        const antes = Date.now();
        const janela = await lerJanelaDoAluno(estadoTravaAluno.atividadeId);
        const meio = antes + (Date.now() - antes) / 2;
        estadoTravaAluno.desvioMs = Date.parse(janela.agora) - meio;
        estadoTravaAluno.janela = janela;
    } catch (erro) {
        console.warn('Trava de horário:', erro.message);
    }
}

/**
 * Inclui o CSS da trava (uma vez).
 */
function incluirEstiloTrava() {
    if (!BASE_SCRIPTS_TRAVA || document.querySelector('link[data-trava-horario]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_TRAVA + ARQUIVO_CSS_TRAVA;
    link.dataset.travaHorario = 'sim';
    document.head.appendChild(link);
}

/**
 * Card de controle do professor (INICIAR/PAUSAR/FINALIZAR): carrega controle-atividade-aluno.js,
 * que manda sobre a trava quando há estado (CARD-CONTROLE-ATIVIDADE-16-11-2026.3).
 * Uma falha aqui não atrapalha a trava.
 * @param {number} atividadeId - Id da atividade.
 */
async function iniciarControleDaAtividade(atividadeId) {
    try {
        if (typeof window.iniciarControleAtividadeAluno !== 'function') {
            await new Promise((ok, falha) => {
                const script = document.createElement('script');
                script.src = BASE_SCRIPTS_TRAVA + 'controle-atividade-aluno.js';
                script.onload = ok;
                script.onerror = () => falha(new Error('controle-atividade-aluno.js'));
                document.head.appendChild(script);
            });
        }
        await window.iniciarControleAtividadeAluno(atividadeId);
    } catch (erro) {
        console.warn('Controle da atividade:', erro.message);
    }
}

/**
 * Ponto de entrada (aluno logado). Atividade já entregue não precisa de trava.
 * @param {number} atividadeId - Id da atividade.
 * @param {{entregue?: boolean}} [opcoes] - Estado da página.
 */
async function iniciarTravaHorarioAluno(atividadeId, opcoes = {}) {
    if (!atividadeId || opcoes.entregue || estadoTravaAluno.atividadeId) return;
    estadoTravaAluno.atividadeId = atividadeId;
    incluirEstiloTrava();
    await iniciarControleDaAtividade(atividadeId);
    await conferirTravaNoServidor();
    tiqueDaTrava();
    setInterval(tiqueDaTrava, INTERVALO_TIQUE_TRAVA_MS);
    setInterval(conferirTravaNoServidor, INTERVALO_CONFERIR_TRAVA_MS);
}

window.iniciarTravaHorarioAluno = iniciarTravaHorarioAluno;
