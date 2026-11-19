// Professor: botões "REABRIR ERRADAS" e "REABRIR MEIA CERTAS" ao lado dos filtros de "Respostas dos
// alunos" da discursiva. Cada um reabre, só do aluno e da tentativa mostrados na tela, as
// alternativas RESPONDIDAS que o professor já confirmou como errada (nota 0) ou como meia certa:
// elas voltam a ficar sem nota do professor para serem confirmadas de novo. Quem faz o trabalho é
// a função do banco reabrir_correcao_discursiva (database/2026-11-11-reabrir-correcao-
// discursiva.sql), que também apaga a nota gravada do aluno. Só professor do aluno consegue.
// Carregado por assets/js/avaliacao-discursiva.js depois de mostrar-certas-discursiva.js.
// Depende de js/supabase.js (obterClienteSupabase) e dos popups (confirmarPopup, mostrarPopup).
// Regra: docs/regras/atividades.md

const CLASSE_REABRIR_CORRECAO = 'reabrir-correcao';
const FUNCAO_REABRIR_CORRECAO = 'reabrir_correcao_discursiva';
const TITULO_POPUP_REABRIR = 'Reabrir correção';
const SELETOR_COMBO_ALUNO_REABRIR = '.respostas-aluno-professor select';

const TIPOS_REABRIR_CORRECAO = [
    { tipo: 'errada', texto: 'REABRIR ERRADAS', descricao: 'erradas',
        alvo: 'as alternativas respondidas e confirmadas como erradas',
        dica: 'Reabre as alternativas respondidas que você confirmou como erradas.' },
    { tipo: 'meia', texto: 'REABRIR MEIA CERTAS', descricao: 'meia certas',
        alvo: 'as alternativas respondidas e confirmadas como meia certas',
        dica: 'Reabre as alternativas respondidas que você confirmou como meia certas.' },
    { tipo: 'todas', texto: 'Reabrir Correcao', descricao: 'confirmadas',
        alvo: 'TODAS as alternativas já confirmadas (certas, meia certas e erradas), apagando ' +
            'a correção do professor, a justificativa e o histórico, como se nunca tivesse ' +
            'corrigido',
        dica: 'Apaga tudo o que você confirmou deste aluno, como se nunca tivesse corrigido.' },
];

/**
 * Pergunta ao professor se quer mesmo reabrir (a nota gravada do aluno é apagada).
 * @param {{texto: string, descricao: string}} configuracao - Tipo de reabertura.
 * @param {string} nome - Nome do aluno mostrado.
 * @returns {Promise<boolean>} true se o professor confirmou.
 */
function confirmarReabertura(configuracao, nome) {
    return confirmarPopup('Reabrir ' + configuracao.alvo + ' de ' + nome + '?\n\nFicam sem ' +
        'nota do professor para você corrigir de novo, e a nota gravada deste aluno nesta ' +
        'atividade é apagada até você confirmar tudo outra vez.', { tipo: 'aviso', titulo: TITULO_POPUP_REABRIR,
        textoConfirmar: configuracao.texto });
}

/**
 * Chama a função do banco que reabre as alternativas do aluno.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno e tentativa mostrados.
 * @param {number} atividadeId - Id da atividade.
 * @param {string} tipo - 'errada', 'meia' ou 'todas'.
 * @returns {Promise<number>} Quantas alternativas foram reabertas.
 * @throws {Error} Se o banco recusar.
 */
async function chamarReabrirCorrecao(aluno, atividadeId, tipo) {
    const { data, error } = await obterClienteSupabase().rpc(FUNCAO_REABRIR_CORRECAO, {
        p_aluno: aluno.alunoId, p_atividade: atividadeId, p_tentativa: aluno.tentativa,
        p_tipo: tipo });
    if (error) throw new Error(error.message);
    return Number(data) || 0;
}

/**
 * Refaz a tela do aluno escolhido (o combo recarrega as respostas e as notas).
 */
function recarregarAlunoMostrado() {
    const combo = document.querySelector(SELETOR_COMBO_ALUNO_REABRIR);
    if (combo) combo.dispatchEvent(new Event('change'));
}

/**
 * Trata o clique de um botão de reabrir.
 * @param {{texto: string, descricao: string, tipo: string}} configuracao - Tipo de reabertura.
 * @param {function(): {aluno: Object|null, atividadeId: number}} lerEscolha - Aluno mostrado.
 * @param {HTMLButtonElement} botao - Botão clicado (fica desligado enquanto grava).
 */
async function reabrirCorrecaoDoAluno(configuracao, lerEscolha, botao) {
    const { aluno, atividadeId } = lerEscolha();
    if (!aluno) {
        await mostrarPopup('Escolha primeiro o aluno.', { tipo: 'aviso',
            titulo: TITULO_POPUP_REABRIR });
        return;
    }
    if (!(await confirmarReabertura(configuracao, aluno.nome || 'este aluno'))) return;

    botao.disabled = true;
    try {
        const total = await chamarReabrirCorrecao(aluno, atividadeId, configuracao.tipo);
        const mensagem = total
            ? total + ' alternativa(s) reaberta(s).'
            : 'Nenhuma alternativa respondida e confirmada como ' + configuracao.descricao + '.';
        await mostrarPopup(mensagem, { tipo: total ? 'sucesso' : 'aviso',
            titulo: TITULO_POPUP_REABRIR });
        if (total) recarregarAlunoMostrado();
    } catch (erro) {
        await mostrarPopup('Não foi possível reabrir: ' + erro.message, { tipo: 'erro',
            titulo: TITULO_POPUP_REABRIR });
    } finally {
        botao.disabled = false;
    }
}

/**
 * Cria os dois botões de reabrir.
 * @param {function(): {aluno: Object|null, atividadeId: number}} lerEscolha - Devolve o aluno
 *     mostrado e a atividade (lido na hora do clique).
 * @returns {HTMLButtonElement[]} Botões REABRIR ERRADAS e REABRIR MEIA CERTAS.
 */
function criarBotoesReabrirCorrecao(lerEscolha) {
    return TIPOS_REABRIR_CORRECAO.map((configuracao) => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn-export ' + CLASSE_REABRIR_CORRECAO;
        botao.textContent = configuracao.texto;
        botao.title = configuracao.dica;
        botao.addEventListener('click',
            () => reabrirCorrecaoDoAluno(configuracao, lerEscolha, botao));
        return botao;
    });
}

window.criarBotoesReabrirCorrecao = criarBotoesReabrirCorrecao;
