// Card de controle da atividade — PROFESSOR (CARD-CONTROLE-ATIVIDADE-16-11-2026.2 e .4).
// Card no TOPO da atividade, só para o professor (o aluno nunca vê; o banco também só deixa o
// professor da turma ler e gravar), para a turma do combo "Turma" do Progresso da turma:
//  • INICIAR ATIVIDADE: libera as respostas na hora (vale sobre a trava de horário);
//  • PAUSAR ATIVIDADE: ninguém responde até o professor iniciar de novo;
//  • FINALIZAR E ENTREGAR ATIVIDADE: finaliza e entrega todos os alunos ativos da turma que ainda
//    não entregaram (inclusive quem não respondeu); se todos já entregaram, só finaliza.
// Como ligar numa página: incluir este arquivo na lista data-depois do perguntas-json.js (ou num
// <script> comum, depois de js/supabase.js). O id vem do <script data-atividade-id> da página ou
// de <body data-controle-atividade-id>. Funções do banco: iniciar_atividade_turma,
// pausar_atividade_turma, finalizar_entregar_atividade_turma
// (database/2026-11-16-card-controle-atividade.sql). Depende de js/supabase.js; usa popup.js.

const ROTA_CONTROLE = '/rest/v1/rpc/';
const PERFIL_PROFESSOR_CONTROLE = 'PROFESSOR';
const EVENTO_TURMA_CONTROLE = 'relatorio-professor:turma';
const INTERVALO_CONTROLE_PROFESSOR_MS = 5000;
const CLASSE_CONTROLE = 'controle-atividade';
const BASE_SCRIPTS_CONTROLE = document.currentScript?.src.replace(/[^/]*$/, '') || '';
const TEXTO_ESTADO_CONTROLE = {
    INICIADA: '▶️ INICIADA — os alunos podem responder.',
    PAUSADA: '⏸️ PAUSADA — ninguém responde até você iniciar de novo.',
    FINALIZADA: '⛔ FINALIZADA — atividade encerrada e entregue.',
    '': '🔒 Não iniciada — alunos bloqueados até INICIAR ATIVIDADE.',
};
const ACOES_CONTROLE = [
    { chave: 'iniciar', rotulo: '▶️ INICIAR ATIVIDADE', rpc: 'iniciar_atividade_turma',
        pergunta: 'Iniciar a atividade agora para a turma {t}? As respostas ficam liberadas na hora.' },
    { chave: 'pausar', rotulo: '⏸️ PAUSAR ATIVIDADE', rpc: 'pausar_atividade_turma',
        pergunta: 'Pausar a atividade para a turma {t}? Ninguém responde até você iniciar de novo.' },
    { chave: 'finalizar', rotulo: '⛔ FINALIZAR E ENTREGAR ATIVIDADE',
        rpc: 'finalizar_entregar_atividade_turma',
        pergunta: 'Finalizar a atividade da turma {t} e entregar todos os alunos que ainda não ' +
            'entregaram (inclusive quem não respondeu nada)? Isso não apaga nenhuma resposta.' },
];
const estadoControle = { atividadeId: null, turma: '', estado: '', card: null, textoEstado: null,
    aviso: null, botoes: [], ocupado: false };

/**
 * Diz se quem está logado é professor (só para a tela; quem decide é o banco).
 * @returns {Promise<boolean>} true se o perfil é PROFESSOR.
 */
async function ehProfessorControle() {
    const cliente = typeof obterClienteSupabase === 'function' ? obterClienteSupabase() : null;
    if (!cliente) return false;
    const { data } = await cliente.auth.getSession();
    return data?.session?.user?.app_metadata?.perfil === PERFIL_PROFESSOR_CONTROLE;
}

/**
 * Id da atividade da página.
 * @returns {number|null} Id, ou null se a página não tiver.
 */
function lerAtividadeIdControle() {
    const valor = document.body.dataset.controleAtividadeId ||
        document.querySelector('script[data-atividade-id]')?.dataset.atividadeId;
    return Number(valor) || null;
}

/**
 * Chama uma função (RPC) do banco com o JWT do professor.
 * @param {string} rpc - Nome da função.
 * @returns {Promise<Object>} Resposta.
 * @throws {Error} Se o banco recusar.
 */
async function chamarFuncaoControle(rpc) {
    const resposta = await fetch(SUPABASE.URL + ROTA_CONTROLE + rpc, {
        method: 'POST', headers: await sbH(),
        body: JSON.stringify({ p_atividade: estadoControle.atividadeId,
            p_turma: estadoControle.turma }),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(dados?.message || 'erro ' + resposta.status);
    return dados;
}

/**
 * Lê o estado gravado para a turma escolhida (vazio = sem controle).
 * @returns {Promise<string>} Estado.
 */
async function lerEstadoControle() {
    const { atividadeId, turma } = estadoControle;
    if (!turma) return '';
    const linhas = await sbGet('atividade_controle_turma', 'select=estado&atividade_id=eq.' +
        atividadeId + '&turma_codigo=eq.' + encodeURIComponent(turma)).catch(() => []);
    return linhas[0]?.estado || '';
}

/**
 * Atualiza o texto do estado e liga/desliga os botões conforme a turma e o estado.
 */
function desenharControle() {
    const { turma, estado, ocupado } = estadoControle;
    estadoControle.textoEstado.textContent = turma
        ? 'Turma ' + turma + ': ' + TEXTO_ESTADO_CONTROLE[estado]
        : 'Escolha a turma no combo "Turma" do Progresso da turma para controlar a atividade.';
    estadoControle.botoes.forEach(({ acao, botao }) => {
        const repetida = (acao.chave === 'iniciar' && estado === 'INICIADA') ||
            (acao.chave === 'pausar' && (estado === '' || estado === 'PAUSADA' ||
                estado === 'FINALIZADA'));
        botao.disabled = !turma || ocupado || repetida;
    });
}

/**
 * Relê a turma do combo e o estado no banco, e redesenha.
 * @returns {Promise<void>}
 */
async function atualizarControle() {
    if (typeof window.lerTurmaEscolhidaProgresso === 'function') {
        estadoControle.turma = String(window.lerTurmaEscolhidaProgresso() || '');
    }
    estadoControle.estado = await lerEstadoControle();
    desenharControle();
}

/**
 * Pergunta antes de agir (popup do site; sem ele, confirm do navegador).
 * @param {string} pergunta - Texto.
 * @returns {Promise<boolean>} true se confirmou.
 */
async function confirmarControle(pergunta) {
    if (typeof window.confirmarPopup === 'function') {
        return window.confirmarPopup(pergunta, { tipo: 'pergunta', titulo: 'Controle da atividade' });
    }
    return window.confirm(pergunta);
}

/**
 * Executa um botão: confirma, chama o banco, mostra o resultado e relê o estado.
 * @param {Object} acao - Item de ACOES_CONTROLE.
 * @returns {Promise<void>}
 */
async function executarAcaoControle(acao) {
    const pergunta = acao.pergunta.replace('{t}', estadoControle.turma);
    if (!(await confirmarControle(pergunta))) return;
    estadoControle.ocupado = true;
    desenharControle();
    try {
        const dados = await chamarFuncaoControle(acao.rpc);
        estadoControle.aviso.textContent = acao.chave === 'finalizar'
            ? '✅ Finalizada. Entregas feitas agora: ' + (dados?.entregas ?? 0) + '.'
            : '✅ Feito.';
    } catch (erro) {
        estadoControle.aviso.textContent = '❌ Não foi possível: ' + erro.message;
    }
    estadoControle.ocupado = false;
    await atualizarControle();
}

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Tag.
 * @param {string} classe - Sufixo da classe (BEM).
 * @param {string} [texto] - Texto.
 * @returns {HTMLElement} Elemento.
 */
function criarElementoControle(tag, classe, texto = '') {
    const elemento = document.createElement(tag);
    elemento.className = CLASSE_CONTROLE + (classe ? '__' + classe : '');
    elemento.textContent = texto;
    return elemento;
}

/**
 * Monta o card e o põe no topo da atividade (logo depois do cabeçalho).
 */
function montarCardControle() {
    const card = criarElementoControle('section', '');
    const botoes = criarElementoControle('div', 'botoes');
    estadoControle.botoes = ACOES_CONTROLE.map((acao) => {
        const botao = criarElementoControle('button', 'botao', acao.rotulo);
        botao.type = 'button';
        botao.classList.add(CLASSE_CONTROLE + '__botao--' + acao.chave);
        botao.addEventListener('click', () => executarAcaoControle(acao));
        botoes.append(botao);
        return { acao, botao };
    });
    estadoControle.textoEstado = criarElementoControle('p', 'estado');
    estadoControle.aviso = criarElementoControle('p', 'aviso');
    card.append(criarElementoControle('p', 'titulo', '🎛️ Controle da atividade (só professor)'),
        estadoControle.textoEstado, botoes, estadoControle.aviso);
    const cabecalho = document.querySelector('.container > header');
    if (cabecalho) cabecalho.after(card);
    else document.body.prepend(card);
    estadoControle.card = card;
}

/**
 * Inclui o CSS do card (uma vez).
 */
function incluirEstiloControle() {
    if (!BASE_SCRIPTS_CONTROLE || document.querySelector('link[data-controle-atividade]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_CONTROLE + '../css/controle-atividade.css';
    link.dataset.controleAtividade = 'sim';
    document.head.appendChild(link);
}

/**
 * Ponto de entrada: só professor, só uma vez, só com id de atividade.
 * @returns {Promise<void>}
 */
async function iniciarControleAtividadeProfessor() {
    const atividadeId = lerAtividadeIdControle();
    if (!atividadeId || estadoControle.atividadeId || !(await ehProfessorControle())) return;
    estadoControle.atividadeId = atividadeId;
    incluirEstiloControle();
    montarCardControle();
    document.addEventListener(EVENTO_TURMA_CONTROLE, (evento) => {
        estadoControle.turma = String(evento.detail?.turma || '');
        atualizarControle();
    });
    await atualizarControle();
    setInterval(atualizarControle, INTERVALO_CONTROLE_PROFESSOR_MS);
}

iniciarControleAtividadeProfessor().catch((erro) => {
    console.warn('Controle da atividade:', erro.message);
});
