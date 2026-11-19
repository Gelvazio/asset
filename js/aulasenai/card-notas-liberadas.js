// Atividades liberadas na turma, para o filtro "Apenas atividades liberadas" do card
// "Notas e média". Liberada = não bloqueada na turma, o mesmo critério do card verde (#431):
// bloqueada quando atividade.ativo = false, atividade.bloqueio contém a turma ou a aula está
// bloqueada na turma (aula_turma.bloqueio).
// PROFESSOR: reaproveita a RPC atividades_pendentes_turma (coluna `bloqueada`, regra única do
// banco). ALUNO: a RPC é só do professor, então lê atividade e aula_turma pela API.
// Depende de: js/supabase.js (SUPABASE, sbH, sbGet).

const ROTA_LIBERADAS_TURMA = '/rest/v1/rpc/atividades_pendentes_turma';
const NOTA_MINIMA_LIBERADAS = 7;
const TABELA_ATIVIDADE_LIBERADAS = 'atividade';
const TABELA_AULA_TURMA_LIBERADAS = 'aula_turma';

/**
 * Ids das atividades liberadas na turma, pela RPC do professor.
 * @param {string} turma - Código da turma.
 * @returns {Promise<Set<number>>} Ids das atividades não bloqueadas.
 * @throws {Error} Se o banco recusar a chamada.
 */
async function buscarLiberadasDoProfessor(turma) {
    const resposta = await fetch(SUPABASE.URL + ROTA_LIBERADAS_TURMA, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify({ p_turma: turma, p_nota_minima: NOTA_MINIMA_LIBERADAS }),
    });
    const linhas = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(linhas?.message || 'erro ' + resposta.status);

    const liberadas = (Array.isArray(linhas) ? linhas : [])
        .filter((linha) => !linha.bloqueada)
        .map((linha) => Number(linha.atividade_id));
    return new Set(liberadas);
}

/**
 * Diz se o jsonb `bloqueio` da atividade cita a turma (chave de objeto ou item de lista),
 * como o operador `?` do banco.
 * @param {*} bloqueio - Valor da coluna atividade.bloqueio.
 * @param {string} turma - Código da turma.
 * @returns {boolean} true se a atividade está bloqueada para a turma.
 */
function bloqueioCitaTurma(bloqueio, turma) {
    if (!bloqueio || typeof bloqueio !== 'object') return false;
    if (Array.isArray(bloqueio)) return bloqueio.includes(turma);

    return Object.prototype.hasOwnProperty.call(bloqueio, turma);
}

/**
 * Ids das atividades liberadas na turma do aluno, lendo atividade e aula_turma.
 * @param {string} turma - Código da turma do aluno.
 * @returns {Promise<Set<number>>} Ids das atividades não bloqueadas.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function buscarLiberadasDoAluno(turma) {
    const codigo = encodeURIComponent(turma);
    const atividades = await sbGet(TABELA_ATIVIDADE_LIBERADAS,
        'select=id,aula_id,ativo,bloqueio');
    const aulasBloqueadas = await sbGet(TABELA_AULA_TURMA_LIBERADAS,
        'select=aula_id&turma_codigo=eq.' + codigo + '&bloqueio=eq.true');
    const idsAulasBloqueadas = new Set(aulasBloqueadas.map((linha) => Number(linha.aula_id)));
    const liberadas = atividades
        .filter((atividade) => atividade.ativo !== false
            && !bloqueioCitaTurma(atividade.bloqueio, turma)
            && !idsAulasBloqueadas.has(Number(atividade.aula_id)))
        .map((atividade) => Number(atividade.id));
    return new Set(liberadas);
}

/**
 * Ids das atividades liberadas na turma, conforme o perfil de quem vê o card.
 * @param {string} turma - Código da turma (do combo Turma ou a do aluno).
 * @param {boolean} ehProfessor - true para o perfil professor.
 * @returns {Promise<Set<number>>} Ids liberados; vazio se não houver turma.
 * @throws {Error} Se o banco recusar a leitura (o chamador mostra todas e avisa).
 */
async function buscarAtividadesLiberadasNaTurma(turma, ehProfessor) {
    if (!turma) return new Set();

    return ehProfessor ? buscarLiberadasDoProfessor(turma) : buscarLiberadasDoAluno(turma);
}
