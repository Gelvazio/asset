// ── Repositório da página recuperacao.html ───────────────────────────────────────────────
// Lê do banco o que a página precisa: papel do usuário e, em poucas consultas, os vínculos de
// recuperação com as atividades, aulas, cursos, matérias, alunos e entregas. Só leitura; o
// cliente do Supabase é injetado (JWT do usuário logado; RLS: só o professor lê tudo isso).
// Depende de js/supabase.js (obterClienteSupabase). Regras da tela: recuperacao-pagina-regras.js

const PERFIL_PROFESSOR_RC = 'PROFESSOR';

/**
 * Lança o erro do Supabase, se houver, e devolve os dados.
 * @param {{data: any, error: Object|null}} resposta - Resposta do supabase-js.
 * @returns {any[]} Dados da resposta.
 * @throws {Error} Erro devolvido pelo banco.
 */
function dadosOuErroRc(resposta) {
    if (resposta.error) throw resposta.error;
    return resposta.data || [];
}

/**
 * Lista única de ids, sem vazios.
 * @param {(number|string|null|undefined)[]} ids - Ids possivelmente repetidos.
 * @returns {(number|string)[]} Ids únicos.
 */
function idsUnicosRc(ids) {
    return [...new Set(ids.filter((id) => id !== null && id !== undefined))];
}

/**
 * Lê uma tabela inteira (ou filtrada por uma lista de ids).
 * @param {Object} cliente - Cliente do Supabase.
 * @param {{tabela: string, colunas: string, coluna?: string, ids?: any[]}} consulta - Consulta.
 * @returns {Promise<any[]>} Linhas lidas (vazio se a lista de ids vier vazia).
 */
async function lerTabelaRc(cliente, { tabela, colunas, coluna, ids }) {
    if (ids && !ids.length) return [];

    const base = cliente.from(tabela).select(colunas);
    return dadosOuErroRc(await (ids ? base.in(coluna, ids) : base));
}

/**
 * Lê os dados de apoio das atividades de recuperação (aulas, cursos, matérias).
 * @param {Object} cliente - Cliente do Supabase.
 * @param {Object[]} atividades - Atividades (recuperação e original).
 * @returns {Promise<{aulas: Object[], cursos: Object[], materias: Object[]}>} Listas cruas.
 */
async function lerContextoDasAtividadesRc(cliente, atividades) {
    const aulas = await lerTabelaRc(cliente, { tabela: 'aulas',
        colunas: 'id,numero,titulo,curso_id,materia_id', coluna: 'id',
        ids: idsUnicosRc(atividades.map((atividade) => atividade.aula_id)) });
    const [cursos, materias] = await Promise.all([
        lerTabelaRc(cliente, { tabela: 'curso', colunas: 'id,nome_completo', coluna: 'id',
            ids: idsUnicosRc(aulas.map((aula) => aula.curso_id)) }),
        lerTabelaRc(cliente, { tabela: 'materia', colunas: 'id,descricao', coluna: 'id',
            ids: idsUnicosRc(aulas.map((aula) => aula.materia_id)) })]);
    return { aulas, cursos, materias };
}

/**
 * Lê os alunos em recuperação (nome, turma) e as entregas das atividades de recuperação.
 * @param {Object} cliente - Cliente do Supabase.
 * @param {Object[]} alunosRecuperacao - Linhas de aluno_recuperacao.
 * @param {number[]} idsRecuperacao - Ids das atividades de recuperação.
 * @returns {Promise<{usuarios: Object[], alunos: Object[], entregas: Object[]}>} Listas cruas.
 */
async function lerAlunosEEntregasRc(cliente, alunosRecuperacao, idsRecuperacao) {
    const idsAlunos = idsUnicosRc(alunosRecuperacao.map((linha) => linha.aluno_id));
    const [usuarios, alunos, entregas] = await Promise.all([
        lerTabelaRc(cliente, { tabela: 'usuario', colunas: 'id,nome_completo', coluna: 'id',
            ids: idsAlunos }),
        lerTabelaRc(cliente, { tabela: 'aluno', colunas: 'id,turma_codigo', coluna: 'id',
            ids: idsAlunos }),
        lerTabelaRc(cliente, { tabela: 'entrega_atividade', colunas: 'aluno_id,atividade_id',
            coluna: 'atividade_id', ids: idsRecuperacao })]);
    return { usuarios, alunos, entregas };
}

/**
 * Cria o repositório da página com o cliente do Supabase injetado.
 * @param {Object} cliente - Cliente do Supabase (supabase-js).
 * @returns {Object} Funções de acesso aos dados.
 */
function criarRepositorioRecuperacaoPagina(cliente) {
    return {
        /** @returns {Promise<Object|null>} Usuário logado ou null. */
        async usuarioLogado() {
            const { data } = await cliente.auth.getSession();
            return data?.session?.user || null;
        },

        /** @returns {Promise<boolean>} Se o usuário logado é professor (pelo token). */
        async ehProfessor() {
            const { data } = await cliente.auth.getSession();
            return data?.session?.user?.app_metadata?.perfil === PERFIL_PROFESSOR_RC;
        },

        /**
         * Lê os vínculos de recuperação e tudo o que a tabela mostra.
         * @returns {Promise<Object>} Listas cruas: vinculos, alunosRecuperacao, atividades, aulas,
         *     cursos, materias, usuarios, alunos e entregas.
         */
        async carregarDados() {
            const [vinculos, alunosRecuperacao] = await Promise.all([
                lerTabelaRc(cliente, { tabela: 'atividade_recuperacao',
                    colunas: 'atividade_recuperacao_id,atividade_original_id' }),
                lerTabelaRc(cliente, { tabela: 'aluno_recuperacao',
                    colunas: 'atividade_recuperacao_id,aluno_id' })]);
            const idsRecuperacao = idsUnicosRc(vinculos.map((v) => v.atividade_recuperacao_id));
            const idsOriginais = vinculos.map((v) => v.atividade_original_id);
            const atividades = await lerTabelaRc(cliente, { tabela: 'atividade',
                colunas: 'id,nome_atividade,aula_id,tipo_avaliacao', coluna: 'id',
                ids: idsUnicosRc([...idsRecuperacao, ...idsOriginais]) });
            const contexto = await lerContextoDasAtividadesRc(cliente, atividades);
            const pessoas = await lerAlunosEEntregasRc(cliente, alunosRecuperacao, idsRecuperacao);
            return { vinculos, alunosRecuperacao, atividades, ...contexto, ...pessoas };
        },
    };
}
