// Card de controle da atividade — tela do ALUNO (CARD-CONTROLE-ATIVIDADE-16-11-2026.3).
// Carregado por trava-horario-aluno.js (objetivas e discursivas). Lê o estado que o professor
// deu à turma do aluno (RPC controle_atividade_aluno) a cada 10 s:
//  • NAO_INICIADA (atividade com card, turma sem estado) e PAUSADA: banner piscando
//    "Aguarde o Professor Iniciar/Despausar a Atividade!" no topo e campos travados;
//  • FINALIZADA: faixa de atividade finalizada e campos desligados;
//  • mudou (iniciou, pausou, retomou ou finalizou): a página RECARREGA sozinha.
// O banco também recusa gravar/entregar sem início, pausada ou finalizada (pode_responder_no_horario;
// database/2026-11-16-card-controle-bloqueio-sem-inicio.sql).
// Com estado (qualquer um), a trava de horário não desenha nada: o professor manda.
// Depende de js/supabase.js (SUPABASE, sbH). SQL: database/2026-11-16-card-controle-atividade.sql.

const ROTA_CONTROLE_ALUNO = '/rest/v1/rpc/controle_atividade_aluno';
const INTERVALO_CONTROLE_ALUNO_MS = 10000;
const ESPERA_RECARREGAR_CONTROLE_MS = 1000;
const SEM_CONTROLE_ALUNO = 'SEM_CONTROLE';
const NAO_INICIADA_ALUNO = 'NAO_INICIADA';
const TEXTO_AGUARDE_CONTROLE_ALUNO = 'Aguarde o Professor Iniciar/Despausar a Atividade!';
const CLASSE_CONTROLE_ALUNO = 'controle-atividade-aluno';
const BASE_SCRIPTS_CONTROLE_ALUNO = document.currentScript?.src.replace(/[^/]*$/, '') || '';
const estadoControleAluno = { atividadeId: null, estado: null, elemento: null,
    recarregando: false };

/**
 * Lê no banco o estado que o professor deu à atividade na turma do aluno.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<string>} 'INICIADA', 'PAUSADA', 'FINALIZADA', 'NAO_INICIADA' ou
 *     'SEM_CONTROLE'.
 * @throws {Error} Se o banco recusar.
 */
async function lerControleDoAluno(atividadeId) {
    const resposta = await fetch(SUPABASE.URL + ROTA_CONTROLE_ALUNO, {
        method: 'POST', headers: await sbH(), body: JSON.stringify({ p_atividade: atividadeId }),
    });
    if (!resposta.ok) throw new Error('controle da atividade: erro ' + resposta.status);
    const dados = await resposta.json();
    return dados?.estado || SEM_CONTROLE_ALUNO;
}

/**
 * Desliga os campos de resposta (o banco já recusa; aqui é só para o aluno ver).
 */
function desligarCamposControleAluno() {
    document.querySelectorAll('.content-section input, .content-section textarea')
        .forEach((campo) => { campo.disabled = true; });
}

/**
 * Mantém os campos desligados, inclusive os que a página monta depois (perguntas do JSON).
 */
function manterCamposDesligadosControleAluno() {
    desligarCamposControleAluno();
    const secao = document.querySelector('.content-section');
    if (!secao) return;
    new MutationObserver(desligarCamposControleAluno).observe(secao,
        { childList: true, subtree: true });
}

/**
 * Mostra o aviso do estado: sem início ou pausada = banner piscando no topo (CARD-CONTROLE.7,
 * pedido do usuário); finalizada = faixa no topo. Nos três, os campos ficam travados.
 * @param {string} estado - Estado atual.
 */
function desenharControleAluno(estado) {
    const aguardando = estado === NAO_INICIADA_ALUNO || estado === 'PAUSADA';
    if (!aguardando && estado !== 'FINALIZADA') return;
    const elemento = document.createElement('div');
    elemento.setAttribute('role', 'status');
    elemento.className = CLASSE_CONTROLE_ALUNO + (aguardando ? '__aguarde' : '__faixa');
    elemento.textContent = aguardando ? TEXTO_AGUARDE_CONTROLE_ALUNO
        : '⛔ Atividade finalizada pelo professor. Não é mais possível responder.';
    document.body.prepend(elemento);
    estadoControleAluno.elemento = elemento;
    manterCamposDesligadosControleAluno();
}

/**
 * Relê o estado; se mudou desde a abertura da página, recarrega uma vez.
 * Uma falha mantém a última leitura.
 */
async function conferirControleDoAluno() {
    try {
        const estado = await lerControleDoAluno(estadoControleAluno.atividadeId);
        if (estado === estadoControleAluno.estado || estadoControleAluno.recarregando) return;
        estadoControleAluno.recarregando = true;
        setTimeout(() => window.location.reload(), ESPERA_RECARREGAR_CONTROLE_MS);
    } catch (erro) {
        console.warn('Controle da atividade:', erro.message);
    }
}

/**
 * Diz se o professor já controla a atividade nesta turma (aí a trava de horário não desenha).
 * @returns {boolean} true se há estado (INICIADA, PAUSADA, FINALIZADA ou NAO_INICIADA).
 */
function controleSobrepoeTrava() {
    const estado = estadoControleAluno.estado;
    return Boolean(estado) && estado !== SEM_CONTROLE_ALUNO;
}

/**
 * Inclui o CSS do controle (uma vez).
 */
function incluirEstiloControleAluno() {
    if (!BASE_SCRIPTS_CONTROLE_ALUNO || document.querySelector('link[data-controle-atividade]')) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_CONTROLE_ALUNO + '../css/controle-atividade.css';
    link.dataset.controleAtividade = 'sim';
    document.head.appendChild(link);
}

/**
 * Ponto de entrada (aluno logado): primeira leitura, aviso e conferência periódica.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<void>}
 */
async function iniciarControleAtividadeAluno(atividadeId) {
    if (!atividadeId || estadoControleAluno.atividadeId) return;
    estadoControleAluno.atividadeId = atividadeId;
    incluirEstiloControleAluno();
    try {
        estadoControleAluno.estado = await lerControleDoAluno(atividadeId);
    } catch (erro) {
        estadoControleAluno.estado = SEM_CONTROLE_ALUNO;
        console.warn('Controle da atividade:', erro.message);
    }
    desenharControleAluno(estadoControleAluno.estado);
    setInterval(conferirControleDoAluno, INTERVALO_CONTROLE_ALUNO_MS);
}

window.iniciarControleAtividadeAluno = iniciarControleAtividadeAluno;
window.controleSobrepoeTrava = controleSobrepoeTrava;
