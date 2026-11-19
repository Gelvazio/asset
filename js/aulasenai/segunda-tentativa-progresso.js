// Professor: botão "2ª Tentativa" na célula de cada aluno do Progresso da turma GLOBAL
// (progresso-turma-global.js), só nas atividades discursivas, logo abaixo do "Reabrir Correção".
// Libera ao aluno uma nova tentativa só com o que ele NÃO acertou: os tópicos com nota máxima do
// professor são copiados (herdados) com a mesma nota; os errados, meia certos e sem resposta
// voltam em branco para ele responder de novo. Quem faz o trabalho é a função do banco
// liberar_nova_tentativa (database/2026-11-13-nova-tentativa-so-erradas-discursiva.sql), que
// também confere o perfil do professor, a turma, a entrega e o limite de tentativas.
// Depende de js/supabase.js (obterClienteSupabase) e assets/js/popup.js (confirmarPopup,
// mostrarPopup). O visual reaproveita o do "Reabrir Correção" (progresso-turma-global.css).

const FUNCAO_SEGUNDA_TENTATIVA = 'liberar_nova_tentativa';
const TEXTO_BOTAO_SEGUNDA_TENTATIVA = '2ª Tentativa';
const TITULO_POPUP_SEGUNDA_TENTATIVA = '2ª Tentativa';
const DICA_BOTAO_SEGUNDA_TENTATIVA = 'Reabre a atividade para o aluno só com o que ele errou ' +
    'ou não respondeu; o que ele acertou fica como está.';
const DICA_SEM_ENTREGA_SEGUNDA_TENTATIVA = 'O aluno ainda não entregou a atividade.';
const MSG_ERRO_SEGUNDA_TENTATIVA = 'Não foi possível liberar a 2ª tentativa: ';

/**
 * Pergunta ao professor se quer liberar a nova tentativa do aluno.
 * @param {string} nome - Nome do aluno.
 * @returns {Promise<boolean>} true se o professor confirmou.
 */
function perguntarSegundaTentativa(nome) {
    return confirmarPopup('Liberar a 2ª tentativa para ' + nome + '?\n\nA atividade reabre para ' +
        'ele só com o que errou ou não respondeu. O que ele acertou (nota máxima) fica como ' +
        'está e a tentativa anterior não é alterada.',
    { tipo: 'aviso', titulo: TITULO_POPUP_SEGUNDA_TENTATIVA,
        textoConfirmar: TEXTO_BOTAO_SEGUNDA_TENTATIVA });
}

/**
 * Chama a função do banco que libera a nova tentativa só com o que falta refazer.
 * @param {{atividadeId: number, aluno: {alunoId: string}}} contexto - Dados do painel.
 * @returns {Promise<number>} Número da nova tentativa.
 * @throws {Error} Se o banco recusar (sem entrega, limite de tentativas, tudo certo...).
 */
async function liberarSegundaTentativaNoBanco(contexto) {
    const { data, error } = await obterClienteSupabase().rpc(FUNCAO_SEGUNDA_TENTATIVA, {
        p_aluno: contexto.aluno.alunoId, p_atividade: contexto.atividadeId });
    if (error) throw new Error(error.message);
    return Number(data) || 0;
}

/**
 * Faz o "2ª Tentativa" de um aluno: pergunta, libera, avisa e atualiza o painel.
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 */
async function liberarSegundaTentativaDoAlunoProgresso(contexto) {
    if (!await perguntarSegundaTentativa(contexto.aluno.nome)) return;

    try {
        const tentativa = await liberarSegundaTentativaNoBanco(contexto);
        await mostrarPopup('Tentativa ' + tentativa + ' liberada para ' + contexto.aluno.nome +
            ': só com o que ele errou ou não respondeu.',
        { tipo: 'sucesso', titulo: TITULO_POPUP_SEGUNDA_TENTATIVA });
        await contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup(MSG_ERRO_SEGUNDA_TENTATIVA + erro.message,
            { tipo: 'erro', titulo: TITULO_POPUP_SEGUNDA_TENTATIVA });
    }
}

/**
 * Cria o botão "2ª Tentativa" do aluno (desativado enquanto ele não entregou).
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 * @returns {HTMLButtonElement} Botão.
 */
function criarBotaoSegundaTentativaAluno(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'progresso-turma__reabrir-correcao';
    botao.textContent = TEXTO_BOTAO_SEGUNDA_TENTATIVA;
    botao.title = DICA_BOTAO_SEGUNDA_TENTATIVA;
    botao.disabled = !contexto.aluno.entregue;
    if (botao.disabled) botao.title = DICA_SEM_ENTREGA_SEGUNDA_TENTATIVA;
    botao.addEventListener('click', () => liberarSegundaTentativaDoAlunoProgresso(contexto));
    return botao;
}

window.criarBotaoSegundaTentativaAluno = criarBotaoSegundaTentativaAluno;
