// Atividade Dinâmica (SOLUCAO-DINAMICA-ALUNO): acesso ao banco da solução. Só chama as funções
// ler_solucao_dinamica e definir_solucao_dinamica_liberada com o JWT do usuário logado; quem decide
// quem pode ver é o banco (professor vê tudo; aluno só se liberada e entregue, sem o roteiro).
// Depende de js/supabase.js (SUPABASE, sbH) e nota-dinamica-repositorio.js (lerAtividadeDaDinamica).
// Regra: docs/regras/atividade-dinamica.md

const ROTA_LER_SOLUCAO = '/rest/v1/rpc/ler_solucao_dinamica';
const ROTA_LIBERAR_SOLUCAO = '/rest/v1/rpc/definir_solucao_dinamica_liberada';
const MSG_ERRO_SOLUCAO = 'Não foi possível acessar a solução: ';

/**
 * Chama uma função do banco com o JWT do usuário.
 * @param {string} rota - Rota REST da função.
 * @param {Object} parametros - Corpo da chamada.
 * @returns {Promise<any>} Resposta JSON da função.
 * @throws {Error} Se o banco recusar.
 */
async function chamarFuncaoSolucao(rota, parametros) {
    const resposta = await fetch(SUPABASE.URL + rota, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify(parametros),
    });
    if (resposta.ok) return resposta.json();

    const erro = await resposta.json().catch(() => ({}));
    throw new Error(MSG_ERRO_SOLUCAO + (erro.message || resposta.status));
}

/**
 * Lê a solução da atividade desta página.
 * @returns {Promise<{atividadeId: number, professor: boolean, liberada: boolean,
 *   conteudo: Object}|null>} Solução visível para o usuário, ou null (sem acesso ou sem linha).
 * @throws {Error} Se o banco recusar.
 */
async function lerSolucaoDaDinamica() {
    const atividade = await lerAtividadeDaDinamica();
    if (!atividade) return null;

    const resposta = await chamarFuncaoSolucao(ROTA_LER_SOLUCAO, { p_atividade_id: atividade.id });
    if (!resposta) return null;

    return { atividadeId: atividade.id, ...resposta };
}

/**
 * Liga ou desliga a solução para todos os alunos (só o professor consegue).
 * @param {number} atividadeId - Id da atividade.
 * @param {boolean} liberada - true para liberar, false para esconder.
 * @returns {Promise<boolean>} Novo valor gravado.
 * @throws {Error} Se o banco recusar.
 */
async function definirSolucaoLiberada(atividadeId, liberada) {
    return chamarFuncaoSolucao(ROTA_LIBERAR_SOLUCAO,
        { p_atividade_id: atividadeId, p_liberada: liberada });
}
