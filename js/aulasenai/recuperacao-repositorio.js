// Repositório da atividade de RECUPERAÇÃO (liga 1 recuperação a 1 prova original e lista os
// alunos em recuperação). Sem acesso ao DOM: o cliente Supabase é injetado (JWT do usuário
// logado vai junto, pela sessão do supabase-js; RLS e as RPC conferem o perfil no banco).
// Orientação: docs/ORIENTACAO_JS_RECUPERACAO.md

const TIPO_ATIVIDADE_SALA = 1;
const TIPO_PROVA_OBJETIVA = 3;
const TIPO_PROVA_PRATICA = 4;
const ROTULO_ATIVIDADE_SALA = 'Atividade de sala';
const ROTULO_PROVA_OBJETIVA = 'Prova objetiva';
const ROTULO_PROVA_PRATICA = 'Prova prática';
const ROTULOS_TIPO_PROVA = {
    [TIPO_ATIVIDADE_SALA]: ROTULO_ATIVIDADE_SALA,
    [TIPO_PROVA_OBJETIVA]: ROTULO_PROVA_OBJETIVA,
    [TIPO_PROVA_PRATICA]: ROTULO_PROVA_PRATICA,
};

const TABELA_ATIVIDADE_RECUPERACAO = 'atividade_recuperacao';
const TABELA_ALUNO_RECUPERACAO = 'aluno_recuperacao';
const RPC_DEFINIR_RECUPERACAO = 'definir_recuperacao';
const RPC_LER_RECUPERACAO = 'ler_recuperacao';
const RPC_LISTAR_PROVAS = 'listar_provas_para_recuperacao';
const RPC_LISTAR_ALUNOS = 'listar_alunos_para_recuperacao';

const MSG_SEM_CLIENTE = 'Conexão com o banco indisponível.';
const MSG_FALHA_PROVAS = 'Não foi possível listar as provas originais.';
const MSG_FALHA_LER = 'Não foi possível ler a recuperação desta atividade.';
const MSG_FALHA_ALUNOS = 'Não foi possível listar os alunos.';
const MSG_FALHA_GRAVAR = 'Não foi possível gravar a recuperação.';
const MSG_FALHA_CONSULTAR = 'Não foi possível consultar as recuperações.';

/**
 * Cria o repositório da recuperação com o cliente Supabase injetado.
 * @param {Object} clienteSupabase - Cliente supabase-js (com a sessão do usuário logado).
 * @returns {Object} Métodos assíncronos do repositório.
 * @throws {Error} Se o cliente não for informado.
 */
function criarRecuperacaoRepositorio(clienteSupabase) {
    if (!clienteSupabase) throw new Error(MSG_SEM_CLIENTE);

    /**
     * Chama uma RPC e devolve o conteúdo ou lança erro em português.
     * @param {Object} chamada - { nome, parametros, mensagemErro }.
     * @returns {Promise<*>} Dados devolvidos pela RPC.
     * @throws {Error} Se o banco devolver erro.
     */
    async function chamarRpc({ nome, parametros, mensagemErro }) {
        const { data, error } = await clienteSupabase.rpc(nome, parametros);
        if (error) throw new Error(mensagemErro);

        return data;
    }

    /**
     * Lê uma coluna de uma tabela e devolve só os valores (sem repetição).
     * @param {Object} consulta - { tabela, coluna }.
     * @returns {Promise<number[]>} Valores da coluna.
     * @throws {Error} Se o banco devolver erro.
     */
    async function lerColuna({ tabela, coluna }) {
        const { data, error } = await clienteSupabase.from(tabela).select(coluna);
        if (error) throw new Error(MSG_FALHA_CONSULTAR);

        const valores = (data || []).map((linha) => linha[coluna]);
        return [...new Set(valores)];
    }

    /**
     * Lista as provas originais (objetiva tipo 3 e prática tipo 4) que podem ser ligadas.
     * @param {number} idRecuperacao - Id da atividade de recuperação.
     * @returns {Promise<{id: number, nome: string, tipo: number, aulaId: number,
     *   pagina: string}[]>} Provas candidatas.
     */
    async function listarProvasCandidatas(idRecuperacao) {
        const linhas = await chamarRpc({
            nome: RPC_LISTAR_PROVAS,
            parametros: { p_recuperacao: idRecuperacao },
            mensagemErro: MSG_FALHA_PROVAS,
        });
        return (linhas || []).map((linha) => ({
            id: linha.id,
            nome: linha.nome_atividade,
            tipo: linha.tipo_avaliacao,
            aulaId: linha.aula_id,
            pagina: linha.pagina,
        }));
    }

    /**
     * Lê a prova original e os alunos já ligados a uma recuperação.
     * @param {number} idRecuperacao - Id da atividade de recuperação.
     * @returns {Promise<{originalId: (number|null), alunoIds: string[]}>} Vínculo atual.
     */
    async function lerRecuperacao(idRecuperacao) {
        const dados = await chamarRpc({
            nome: RPC_LER_RECUPERACAO,
            parametros: { p_recuperacao: idRecuperacao },
            mensagemErro: MSG_FALHA_LER,
        });
        return {
            originalId: dados?.original_id ?? null,
            alunoIds: dados?.alunos || [],
        };
    }

    /**
     * Lista os alunos que podem ser colocados em recuperação.
     * @param {number} idRecuperacao - Id da atividade de recuperação.
     * @returns {Promise<{id: string, nome: string, turmaCodigo: string}[]>} Alunos elegíveis.
     */
    async function listarAlunosElegiveis(idRecuperacao) {
        const linhas = await chamarRpc({
            nome: RPC_LISTAR_ALUNOS,
            parametros: { p_recuperacao: idRecuperacao },
            mensagemErro: MSG_FALHA_ALUNOS,
        });
        return (linhas || []).map((linha) => ({
            id: linha.id,
            nome: linha.nome,
            turmaCodigo: linha.turma_codigo,
        }));
    }

    /**
     * Grava a prova original e os alunos da recuperação (idOriginal null remove o vínculo).
     * @param {Object} dados - { idRecuperacao, idOriginal, alunoIds }.
     * @returns {Promise<{originalId: (number|null), alunoIds: string[]}>} Vínculo gravado.
     * @throws {Error} Com o motivo devolvido pela RPC quando ok = false.
     */
    async function gravarRecuperacao({ idRecuperacao, idOriginal, alunoIds }) {
        const resposta = await chamarRpc({
            nome: RPC_DEFINIR_RECUPERACAO,
            parametros: {
                p_recuperacao: idRecuperacao,
                p_original: idOriginal ?? null,
                p_alunos: alunoIds || [],
            },
            mensagemErro: MSG_FALHA_GRAVAR,
        });
        if (!resposta?.ok) {
            throw new Error(resposta?.motivo || MSG_FALHA_GRAVAR);
        }

        return {
            originalId: resposta.original_id ?? null,
            alunoIds: resposta.alunos || [],
        };
    }

    /**
     * Indica se a atividade é uma recuperação (existe linha em atividade_recuperacao).
     * @param {number} idAtividade - Id da atividade.
     * @returns {Promise<boolean>} true se for recuperação.
     * @throws {Error} Se o banco devolver erro.
     */
    async function ehRecuperacao(idAtividade) {
        const { data, error } = await clienteSupabase
            .from(TABELA_ATIVIDADE_RECUPERACAO)
            .select('atividade_recuperacao_id')
            .eq('atividade_recuperacao_id', idAtividade)
            .limit(1);
        if (error) throw new Error(MSG_FALHA_CONSULTAR);

        return (data || []).length > 0;
    }

    /**
     * Ids das atividades de recuperação em que o aluno logado está (RLS: só as dele).
     * @returns {Promise<number[]>} Ids das atividades de recuperação do aluno.
     */
    async function idsRecuperacaoDoAluno() {
        return lerColuna({
            tabela: TABELA_ALUNO_RECUPERACAO,
            coluna: 'atividade_recuperacao_id',
        });
    }

    /**
     * Ids de todas as atividades de recuperação visíveis ao usuário (professor vê todas).
     * @returns {Promise<number[]>} Ids das atividades de recuperação.
     */
    async function idsTodasRecuperacoes() {
        return lerColuna({
            tabela: TABELA_ATIVIDADE_RECUPERACAO,
            coluna: 'atividade_recuperacao_id',
        });
    }

    return {
        listarProvasCandidatas,
        lerRecuperacao,
        listarAlunosElegiveis,
        gravarRecuperacao,
        ehRecuperacao,
        idsRecuperacaoDoAluno,
        idsTodasRecuperacoes,
    };
}

if (typeof window !== 'undefined') {
    window.criarRecuperacaoRepositorio = criarRecuperacaoRepositorio;
    window.TIPO_ATIVIDADE_SALA = TIPO_ATIVIDADE_SALA;
    window.TIPO_PROVA_OBJETIVA = TIPO_PROVA_OBJETIVA;
    window.TIPO_PROVA_PRATICA = TIPO_PROVA_PRATICA;
    window.ROTULOS_TIPO_PROVA = ROTULOS_TIPO_PROVA;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        criarRecuperacaoRepositorio,
        TIPO_ATIVIDADE_SALA,
        TIPO_PROVA_OBJETIVA,
        TIPO_PROVA_PRATICA,
        ROTULO_ATIVIDADE_SALA,
        ROTULO_PROVA_OBJETIVA,
        ROTULO_PROVA_PRATICA,
        ROTULOS_TIPO_PROVA,
    };
}
