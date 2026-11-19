// Card "Notas e média" (só PROFESSOR): coluna "Finalizar" com o botão "Finalizar Atividade" em
// cada linha (tarefa NOTAS-FINALIZAR-ATIVIDADE, pedido do usuário em 2026-11-09).
// O botão faz, só naquela atividade e na turma do combo TURMA, a MESMA ação do botão
// "🔓 Liberar gabaritos (turma X)" do relatório do professor: chama
// alternarGabaritoTurmaComConfirmacao (liberacao-respostas-professor.js), que pede a mesma
// confirmação, chama a RPC liberar_gabarito_turma (grava a turma em atividade.gabarito_liberado e
// encerra o preenchimento da turma) e mostra o mesmo aviso. Nenhuma lógica nova de banco aqui.
// Estado: lido do banco (atividade.gabarito_liberado, numa consulta só por turma, pela função
// lerTurmasComGabaritoLiberado). Com a turma já liberada, o botão aparece desabilitado com
// "Finalizada". Depois do clique, o card relê o banco e redesenha a tabela.
// Depende de liberacao-respostas-professor.js, js/supabase.js e popup.js (carregado sob demanda
// pelo garantirPopupCrud de atividades-crud-modal.js, se ainda não estiver na página).

const CLASSE_CELULA_FINALIZAR = 'card-notas-media__finalizar';
const CLASSE_BOTAO_FINALIZAR = 'card-notas-media__finalizar-botao btn';
const ROTULO_FINALIZAR_ATIVIDADE = 'Finalizar Atividade';
const ROTULO_FINALIZADA_ATIVIDADE = 'Finalizada';
const TITULO_FINALIZAR_ATIVIDADE = 'Libera o gabarito desta atividade para a turma e encerra ' +
    'o preenchimento (mesma ação do "Liberar gabaritos").';
const TITULO_FINALIZADA_ATIVIDADE = 'Gabarito liberado: preenchimento encerrado nesta turma.';

/**
 * Diz se as funções do "Liberar gabaritos" estão carregadas na página.
 * @returns {boolean} true se o botão pode funcionar.
 */
function finalizarAtividadeDisponivel() {
    return typeof alternarGabaritoTurmaComConfirmacao === 'function' &&
        typeof lerTurmasComGabaritoLiberado === 'function';
}

/**
 * Lê no banco quais atividades do índice já têm o gabarito liberado (finalizadas) na turma.
 * Em falha, devolve o mapa vazio (os botões ficam habilitados; liberar de novo não muda nada).
 * @param {string} turma - Código da turma do combo.
 * @param {Map<string, {id: number}>} idsPorPagina - Id da atividade por página.
 * @returns {Promise<Map<string, boolean>>} true por página quando a turma já está liberada.
 */
async function lerFinalizadasPorPaginaTurma(turma, idsPorPagina) {
    const porPagina = new Map();
    if (!turma || !finalizarAtividadeDisponivel()) return porPagina;

    try {
        const ids = [...idsPorPagina.values()].map((dados) => dados.id);
        const turmasPorId = await lerTurmasComGabaritoLiberado(ids);
        idsPorPagina.forEach((dados, pagina) => porPagina.set(pagina,
            (turmasPorId.get(Number(dados.id)) || []).includes(turma)));
    } catch (erro) {
        console.warn('Situação "Finalizada" indisponível:', erro.message);
    }
    return porPagina;
}

/**
 * Executa a ação do "Liberar gabaritos" na atividade e na turma e relê o banco.
 * @param {HTMLButtonElement} botao - Botão clicado (fica desabilitado durante a ação).
 * @param {number} atividadeId - Id da atividade.
 * @param {{turma: string, aoConcluir: Function}} contexto - Turma e releitura do card.
 */
async function finalizarAtividadeNotas(botao, atividadeId, contexto) {
    botao.disabled = true;
    try {
        if (typeof confirmarPopup !== 'function' && typeof garantirPopupCrud === 'function') {
            await garantirPopupCrud();
        }
        await alternarGabaritoTurmaComConfirmacao(
            { atividadeId, turma: contexto.turma, liberado: false });
    } catch (erro) {
        console.warn('Finalizar Atividade indisponível:', erro.message);
    }
    botao.disabled = false;
    await contexto.aoConcluir();
}

/**
 * Célula "Finalizar" de uma linha: botão "Finalizar Atividade" ou "Finalizada" desabilitado.
 * @param {number|undefined} atividadeId - Id da atividade (sem cadastro, fica desabilitado).
 * @param {{turma: string, finalizada: boolean, aoConcluir: Function}} contexto - Turma, situação
 *     lida do banco e a função que relê o banco e redesenha a tabela.
 * @returns {HTMLTableCellElement} Célula pronta.
 */
function criarCelulaFinalizarAtividade(atividadeId, contexto) {
    const celula = document.createElement('td');
    celula.className = CLASSE_CELULA_FINALIZAR;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_FINALIZAR;
    const finalizada = contexto.finalizada === true;
    botao.textContent = finalizada ? ROTULO_FINALIZADA_ATIVIDADE : ROTULO_FINALIZAR_ATIVIDADE;
    botao.title = finalizada ? TITULO_FINALIZADA_ATIVIDADE : TITULO_FINALIZAR_ATIVIDADE;
    botao.disabled = finalizada || !atividadeId || !contexto.turma ||
        !finalizarAtividadeDisponivel();
    botao.addEventListener('click', () => finalizarAtividadeNotas(botao, atividadeId, contexto));
    celula.append(botao);
    return celula;
}
