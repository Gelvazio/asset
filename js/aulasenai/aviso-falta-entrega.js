// Aluno: aviso em fundo amarelo claro no topo da atividade entregue por falta (professor ligou o
// "Faltou?" no Progresso da turma). Lê a própria linha em falta_entrega_atividade (RLS: o aluno só
// vê a dele; professor e visitante não veem o aviso). A observação vem do banco, sem texto fixo.
// Carregado por respostas-atividade.js (objetiva) e avaliacao-discursiva.js (prática).
// Tarefa FALTOU-ENTREGA-AMARELO.1. Depende de js/supabase.js (obterClienteSupabase, sbGet).

const CLASSE_AVISO_FALTA_ENTREGA = 'aviso-falta-entrega';
const SELETOR_ONDE_AVISAR_FALTA = '.content-section';
const TITULO_AVISO_FALTA_ENTREGA = 'Atividade entregue por falta';
const ARQUIVO_CSS_AVISO_FALTA = '../css/aviso-falta-entrega.css';
const BASE_SCRIPTS_AVISO_FALTA = document.currentScript?.src.replace(/[^/]*$/, '') || '';

/**
 * Liga a folha de estilo do aviso (fica ao lado da pasta dos scripts).
 */
function incluirEstiloAvisoFalta() {
    if (!BASE_SCRIPTS_AVISO_FALTA) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_AVISO_FALTA + ARQUIVO_CSS_AVISO_FALTA;
    document.head.appendChild(link);
}

/**
 * Lê a observação de falta da tentativa atual do aluno logado nesta atividade.
 * @param {string} alunoId - Id do aluno logado.
 * @returns {Promise<string|null>} Observação, ou null se a atividade não foi entregue por falta.
 */
async function lerObservacaoDeFaltaDaPagina(alunoId) {
    const atividades = await sbGet('atividade',
        'select=id&pagina=eq.' + encodeURIComponent(location.pathname));
    if (!atividades[0]) return null;

    const linhas = await sbGet('falta_entrega_atividade',
        'select=observacao,tentativa&atividade_id=eq.' + atividades[0].id +
        '&aluno_id=eq.' + encodeURIComponent(alunoId) + '&order=tentativa.desc&limit=1');
    return linhas[0]?.observacao || null;
}

/**
 * Põe o aviso amarelo no topo da seção principal da atividade.
 * @param {string} observacao - Texto gravado pelo professor ao marcar a falta.
 */
function mostrarAvisoFaltaEntrega(observacao) {
    const secao = document.querySelector(SELETOR_ONDE_AVISAR_FALTA);
    if (!secao || secao.querySelector('.' + CLASSE_AVISO_FALTA_ENTREGA)) return;

    const aviso = document.createElement('div');
    aviso.className = CLASSE_AVISO_FALTA_ENTREGA;
    aviso.setAttribute('role', 'status');
    const titulo = document.createElement('strong');
    titulo.textContent = '⚠️ ' + TITULO_AVISO_FALTA_ENTREGA;
    const texto = document.createElement('p');
    texto.textContent = observacao;
    aviso.append(titulo, texto);
    secao.prepend(aviso);
}

/**
 * Mostra o aviso quando o aluno logado teve esta atividade entregue por falta.
 */
async function iniciarAvisoFaltaEntrega() {
    try {
        const cliente = obterClienteSupabase();
        const { data } = cliente ? await cliente.auth.getSession() : { data: null };
        const usuario = data?.session?.user;
        const ehAluno = usuario && (usuario.app_metadata?.perfil || 'ALUNO') === 'ALUNO';
        if (!ehAluno) return;

        const observacao = await lerObservacaoDeFaltaDaPagina(usuario.id);
        if (observacao) mostrarAvisoFaltaEntrega(observacao);
    } catch (erro) {
        console.warn('Aviso de falta indisponível:', erro.message);
    }
}

incluirEstiloAvisoFalta();
iniciarAvisoFaltaEntrega();
