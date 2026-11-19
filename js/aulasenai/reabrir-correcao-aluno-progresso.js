// Professor: botão "Reabrir Correção" na célula de cada aluno do Progresso da turma GLOBAL
// (progresso-turma-global.js), só nas atividades discursivas, logo abaixo do "Lançado AVA".
// Reabre, só deste aluno e da tentativa mostrada, as alternativas RESPONDIDAS que o professor
// confirmou como ERRADAS (nota 0): elas voltam a ficar sem nota do professor para serem
// confirmadas de novo. As meia certas e as certas ficam como estão. Quem faz o trabalho é a função
// do banco reabrir_correcao_discursiva (p_tipo = 'errada'; database/2026-11-11-reabrir-correcao-
// discursiva.sql), que também apaga a nota gravada do aluno até a nova confirmação. Só o professor
// do aluno consegue (a função confere o perfil e a turma).
// Depende de js/supabase.js (obterClienteSupabase) e assets/js/popup.js (confirmarPopup,
// mostrarPopup). O visual vem de progresso-turma-global.css.

const FUNCAO_REABRIR_CORRECAO_ALUNO = 'reabrir_correcao_discursiva';
const TIPO_REABRIR_ERRADAS_ALUNO = 'errada';
const TEXTO_BOTAO_REABRIR_CORRECAO_ALUNO = 'Reabrir Correção';
const TITULO_POPUP_REABRIR_CORRECAO_ALUNO = 'Reabrir correção';
const DICA_BOTAO_REABRIR_CORRECAO_ALUNO = 'Reabre só as alternativas respondidas que você ' +
    'confirmou como erradas; as meia certas e as certas ficam como estão.';
const DICA_SEM_ENTREGA_REABRIR_CORRECAO_ALUNO = 'O aluno ainda não entregou a atividade.';
const MSG_NADA_REABRIR_CORRECAO_ALUNO = 'Nenhuma alternativa errada confirmada para reabrir.';
const MSG_ERRO_REABRIR_CORRECAO_ALUNO = 'Não foi possível reabrir a correção: ';

/**
 * Pergunta ao professor se quer reabrir as erradas do aluno.
 * @param {string} nome - Nome do aluno.
 * @returns {Promise<boolean>} true se o professor confirmou.
 */
function perguntarReabrirCorrecaoAluno(nome) {
    return confirmarPopup('Reabrir as alternativas ERRADAS de ' + nome + '?\n\nSó as respondidas ' +
        'que você confirmou como erradas ficam sem nota do professor para corrigir de novo. As ' +
        'meia certas e as certas continuam como estão, mas a nota gravada do aluno nesta ' +
        'atividade é apagada até você confirmar tudo outra vez.',
    { tipo: 'aviso', titulo: TITULO_POPUP_REABRIR_CORRECAO_ALUNO,
        textoConfirmar: TEXTO_BOTAO_REABRIR_CORRECAO_ALUNO });
}

/**
 * Chama a função do banco que reabre as alternativas erradas do aluno.
 * @param {{atividadeId: number, aluno: {alunoId: string, tentativa: number}}} contexto - Dados
 *     do painel.
 * @returns {Promise<number>} Quantas alternativas foram reabertas.
 * @throws {Error} Se o banco recusar.
 */
async function reabrirErradasNoBanco(contexto) {
    const { data, error } = await obterClienteSupabase().rpc(FUNCAO_REABRIR_CORRECAO_ALUNO, {
        p_aluno: contexto.aluno.alunoId, p_atividade: contexto.atividadeId,
        p_tentativa: contexto.aluno.tentativa, p_tipo: TIPO_REABRIR_ERRADAS_ALUNO });
    if (error) throw new Error(error.message);
    return Number(data) || 0;
}

/**
 * Faz o "Reabrir Correção" de um aluno: pergunta, reabre, avisa e atualiza o painel.
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 */
async function reabrirErradasDoAlunoProgresso(contexto) {
    if (!await perguntarReabrirCorrecaoAluno(contexto.aluno.nome)) return;

    try {
        const reabertas = await reabrirErradasNoBanco(contexto);
        if (!reabertas) {
            await mostrarPopup(MSG_NADA_REABRIR_CORRECAO_ALUNO,
                { tipo: 'info', titulo: TITULO_POPUP_REABRIR_CORRECAO_ALUNO });
            return;
        }
        await mostrarPopup(reabertas + ' alternativa(s) errada(s) reaberta(s).',
            { tipo: 'sucesso', titulo: TITULO_POPUP_REABRIR_CORRECAO_ALUNO });
        await contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup(MSG_ERRO_REABRIR_CORRECAO_ALUNO + erro.message,
            { tipo: 'erro', titulo: TITULO_POPUP_REABRIR_CORRECAO_ALUNO });
    }
}

/**
 * Cria o botão "Reabrir Correção" do aluno (desativado enquanto ele não entregou).
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 * @returns {HTMLButtonElement} Botão.
 */
function criarBotaoReabrirCorrecaoAluno(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'progresso-turma__reabrir-correcao';
    botao.textContent = TEXTO_BOTAO_REABRIR_CORRECAO_ALUNO;
    botao.title = DICA_BOTAO_REABRIR_CORRECAO_ALUNO;
    botao.disabled = !contexto.aluno.entregue;
    if (botao.disabled) botao.title = DICA_SEM_ENTREGA_REABRIR_CORRECAO_ALUNO;
    botao.addEventListener('click', () => reabrirErradasDoAlunoProgresso(contexto));
    return botao;
}

window.criarBotaoReabrirCorrecaoAluno = criarBotaoReabrirCorrecaoAluno;
