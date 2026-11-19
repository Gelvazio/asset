// Trava de horário da atividade — PROFESSOR (TRAVA-HORARIO-ATIVIDADE-16-11-2026.3).
// No Quadro de Progresso (progresso-turma-global.js, objetivas e discursivas), para a turma do
// combo "Turma": data/hora de INÍCIO e de FIM (horário de Brasília), botões Salvar e Desligar,
// e a situação da entrega automática. Sem turma escolhida ("Todas as turmas"), fica escondido.
// No FIM, o banco abre 1 tarefa (tarefa_entrega_automatica) e a Edge Function
// "entrega-automatica" entrega quem ainda não entregou. Funções do banco:
// definir_janela_atividade, desligar_janela_atividade (database/2026-11-16-trava-horario-atividade.sql).
// Depende de js/supabase.js (SUPABASE, sbH, sbGet) e popup.js.

const ROTA_DEFINIR_TRAVA = '/rest/v1/rpc/definir_janela_atividade';
const ROTA_DESLIGAR_TRAVA = '/rest/v1/rpc/desligar_janela_atividade';
const CLASSE_TRAVA_PROFESSOR = 'trava-horario-professor';
const EVENTO_TURMA_TRAVA = 'relatorio-professor:turma';
const FUSO_TRAVA_PROFESSOR = 'America/Sao_Paulo';
const estadoTravaProfessor = { area: null, atividadeId: null, turma: '', inicio: null, fim: null,
    aviso: null, ativa: false };

/**
 * Chama uma função (RPC) do banco com o JWT do professor.
 * @param {string} rota - Rota da função.
 * @param {Object} corpo - Parâmetros.
 * @returns {Promise<*>} Resposta.
 * @throws {Error} Se o banco recusar.
 */
async function chamarFuncaoTrava(rota, corpo) {
    const resposta = await fetch(SUPABASE.URL + rota, {
        method: 'POST', headers: await sbH(), body: JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(dados?.message || 'erro ' + resposta.status);
    return dados;
}

/**
 * Converte uma data ISO para o valor de <input type="datetime-local"> em hora de Brasília.
 * @param {string} iso - Data ISO.
 * @returns {string} "AAAA-MM-DDTHH:MM".
 */
function paraCampoLocalTrava(iso) {
    const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO_TRAVA_PROFESSOR,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        hourCycle: 'h23' }).format(new Date(iso));
    return partes.replace(' ', 'T');
}

/**
 * Texto da última tarefa de entrega automática da turma (ou vazio).
 * @returns {Promise<string>} Situação.
 */
async function lerTarefaEntregaTrava() {
    const { atividadeId, turma } = estadoTravaProfessor;
    const linhas = await sbGet('tarefa_entrega_automatica', 'select=status,entregas,executada_em' +
        '&atividade_id=eq.' + atividadeId + '&turma_codigo=eq.' + encodeURIComponent(turma) +
        '&order=id.desc&limit=1').catch(() => []);
    const tarefa = linhas[0];
    if (!tarefa) return '';
    return ' Entrega automática: ' + tarefa.status + (tarefa.status === 'EXECUTADA'
        ? ' (' + tarefa.entregas + ' entrega(s))' : '') + '.';
}

/**
 * Lê a trava da turma escolhida e atualiza campos e aviso.
 */
async function atualizarTravaProfessor() {
    const { area, atividadeId, turma } = estadoTravaProfessor;
    if (!area) return;
    area.hidden = !turma;
    if (!turma) return;
    try {
        const [janela] = await sbGet('atividade_janela_turma', 'select=inicia_em,encerra_em,ativa' +
            '&atividade_id=eq.' + atividadeId + '&turma_codigo=eq.' + encodeURIComponent(turma));
        estadoTravaProfessor.ativa = Boolean(janela?.ativa);
        estadoTravaProfessor.inicio.value = janela ? paraCampoLocalTrava(janela.inicia_em) : '';
        estadoTravaProfessor.fim.value = janela ? paraCampoLocalTrava(janela.encerra_em) : '';
        const texto = estadoTravaProfessor.ativa
            ? 'Trava LIGADA para a turma ' + turma + ' (horário de Brasília).'
            : 'Sem trava de horário para a turma ' + turma + '.';
        estadoTravaProfessor.aviso.textContent = texto + await lerTarefaEntregaTrava();
    } catch (erro) {
        estadoTravaProfessor.aviso.textContent = 'Não foi possível ler a trava: ' + erro.message;
    }
}

/**
 * Salva início e fim da turma escolhida, com confirmação.
 */
async function salvarTravaProfessor() {
    const { atividadeId, turma, inicio, fim } = estadoTravaProfessor;
    if (!inicio.value || !fim.value || fim.value <= inicio.value) {
        await mostrarPopup('Informe início e fim, com o fim depois do início.', { tipo: 'erro' });
        return;
    }
    const pergunta = 'Travar a atividade para a turma ' + turma + ' de ' +
        inicio.value.replace('T', ' ') + ' até ' + fim.value.replace('T', ' ') + '? No fim, a tela ' +
        'dos alunos recarrega e quem não entregou tem a atividade entregue automaticamente.';
    if (!(await confirmarPopup(pergunta, { tipo: 'pergunta', titulo: 'Trava de horário' }))) return;
    try {
        await chamarFuncaoTrava(ROTA_DEFINIR_TRAVA, { p_atividade: atividadeId, p_turma: turma,
            p_inicio: inicio.value + ':00', p_fim: fim.value + ':00' });
        await mostrarPopup('Trava de horário salva.', { tipo: 'sucesso' });
    } catch (erro) {
        await mostrarPopup('Não foi possível salvar a trava: ' + erro.message, { tipo: 'erro' });
    }
    await atualizarTravaProfessor();
}

/**
 * Desliga a trava da turma escolhida (a atividade volta às regras de sempre).
 */
async function desligarTravaProfessor() {
    const { atividadeId, turma, ativa } = estadoTravaProfessor;
    if (!ativa) return;
    const pergunta = 'Desligar a trava de horário da turma ' + turma + '?';
    if (!(await confirmarPopup(pergunta, { tipo: 'pergunta', titulo: 'Trava de horário' }))) return;
    try {
        await chamarFuncaoTrava(ROTA_DESLIGAR_TRAVA, { p_atividade: atividadeId, p_turma: turma });
    } catch (erro) {
        await mostrarPopup('Não foi possível desligar: ' + erro.message, { tipo: 'erro' });
    }
    await atualizarTravaProfessor();
}

/**
 * Cria um elemento com classe, texto e (opcional) tipo.
 * @param {string} tag - Tag.
 * @param {string} classe - Classe CSS.
 * @param {string} [texto] - Texto.
 * @returns {HTMLElement} Elemento.
 */
function criarElementoTrava(tag, classe, texto = '') {
    const elemento = document.createElement(tag);
    elemento.className = classe;
    elemento.textContent = texto;
    return elemento;
}

/**
 * Cria um campo datetime-local com rótulo.
 * @param {string} rotulo - Texto do rótulo.
 * @returns {{rotulo: HTMLElement, campo: HTMLInputElement}} Rótulo e campo.
 */
function criarCampoTrava(rotulo) {
    const elemento = criarElementoTrava('label', CLASSE_TRAVA_PROFESSOR + '__campo', rotulo + ' ');
    const campo = document.createElement('input');
    campo.type = 'datetime-local';
    elemento.appendChild(campo);
    return { rotulo: elemento, campo };
}

/**
 * Monta a trava de horário no Quadro de Progresso.
 * @param {HTMLElement} destino - Onde entra (área do Quadro de Progresso).
 * @param {{atividadeId: number, turma: string}} contexto - Atividade e turma escolhida.
 */
function montarTravaHorarioProfessor(destino, contexto) {
    const area = criarElementoTrava('div', CLASSE_TRAVA_PROFESSOR);
    const inicio = criarCampoTrava('⏰ Início');
    const fim = criarCampoTrava('Fim');
    const salvar = criarElementoTrava('button', 'btn-export', '💾 Salvar trava');
    const desligar = criarElementoTrava('button', 'btn-export btn-export--secundario',
        '🔓 Desligar trava');
    [salvar, desligar].forEach((botao) => { botao.type = 'button'; });
    salvar.addEventListener('click', salvarTravaProfessor);
    desligar.addEventListener('click', desligarTravaProfessor);
    const aviso = criarElementoTrava('span', CLASSE_TRAVA_PROFESSOR + '__aviso');
    area.append(criarElementoTrava('strong', '', 'Trava de horário'), inicio.rotulo, fim.rotulo,
        salvar, desligar, aviso);
    Object.assign(estadoTravaProfessor, { area, aviso, inicio: inicio.campo, fim: fim.campo,
        atividadeId: contexto.atividadeId, turma: contexto.turma || '' });
    destino.appendChild(area);
    atualizarTravaProfessor();
}

document.addEventListener(EVENTO_TURMA_TRAVA, (evento) => {
    estadoTravaProfessor.turma = String(evento.detail?.turma || '');
    atualizarTravaProfessor();
});

window.montarTravaHorarioProfessor = montarTravaHorarioProfessor;

(function incluirEstiloTravaProfessor() {
    const base = document.currentScript?.src.replace(/[^/]*$/, '') || '';
    if (!base || document.querySelector('link[data-trava-horario]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = base + '../css/trava-horario.css';
    link.dataset.travaHorario = 'sim';
    document.head.appendChild(link);
})();
