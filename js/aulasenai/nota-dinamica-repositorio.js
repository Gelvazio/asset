// Atividade Dinâmica (tarefa #381): acesso ao banco para a nota do professor (tabela nota_dinamica).
// Só leitura/gravação pelo RLS: o professor grava alunos que pode ver; o aluno lê só a própria nota.
// Depende de js/supabase.js (SUPABASE, sbH, sbGet). Regra: docs/regras/atividade-dinamica.md

const PERFIL_PROFESSOR_DINAMICA = 'PROFESSOR';
const TABELA_NOTA_DINAMICA = 'nota_dinamica';
const RPC_CONFIRMAR_NOTA_DINAMICA = 'confirmar_nota_dinamica';
const PREFIXO_PAGINA_DINAMICA = '/MATERIAIS/';
const SEM_NOME_ALUNO_DINAMICA = 'Aluno sem nome';
// O aluno pede só as colunas do professor: nunca nota_ia, criterios_ia nem motivo_ia (sugestão
// da IA).
const COLUNAS_ALUNO_NOTA_DINAMICA =
    'aluno_id,atividade_id,nota,criterios,formato,grupo,comentario,confirmada_em';
const TABELA_PEDIDO_IA_DINAMICA = 'pedido_correcao_ia';
const ESTADO_PENDENTE_IA_DINAMICA = 'PENDENTE';
const HTTP_CONFLITO_DINAMICA = 409;
const FORMATOS_DINAMICA = [
    { valor: 'INDIVIDUAL', texto: 'Individual' },
    { valor: 'DUPLA', texto: 'Em duplas' },
    { valor: 'GRUPO', texto: 'Em grupos' },
    { valor: 'TURMA', texto: 'Turma toda' },
];

/**
 * Caminho desta página no formato de atividade.pagina: a partir de /MATERIAIS/ e com .html.
 * @returns {string} Caminho da página.
 */
function obterPaginaDaDinamica() {
    const caminho = decodeURIComponent(location.pathname);
    const inicio = caminho.indexOf(PREFIXO_PAGINA_DINAMICA);
    return inicio >= 0 ? caminho.slice(inicio) : caminho;
}

/**
 * Diz se o usuário logado é PROFESSOR.
 * @returns {Promise<boolean>} true se o perfil da sessão é PROFESSOR.
 */
async function ehProfessorDinamica() {
    const { data } = await obterClienteSupabase().auth.getSession();
    return data?.session?.user?.app_metadata?.perfil === PERFIL_PROFESSOR_DINAMICA;
}

/**
 * Id do aluno logado.
 * @returns {Promise<string|null>} Id (auth.users) ou null sem sessão.
 */
async function lerAlunoLogadoDinamica() {
    const { data } = await obterClienteSupabase().auth.getSession();
    return data?.session?.user?.id || null;
}

/**
 * Lê o registro da atividade desta página (id e curso da aula).
 * @returns {Promise<{id: number, cursoId: number|null}|null>} Atividade ou null se não cadastrada.
 * @throws {Error} Se o banco recusar.
 */
async function lerAtividadeDaDinamica() {
    const pagina = obterPaginaDaDinamica().replace(/_/g, '\\_');
    const [atividade] = await sbGet('atividade',
        'select=id,aulas(curso_id,materia(curso_id))&pagina=ilike.' + encodeURIComponent(pagina));
    if (!atividade) return null;

    const aula = atividade.aulas;
    return { id: atividade.id, cursoId: aula?.curso_id || aula?.materia?.curso_id || null };
}

/**
 * Turmas do curso (a favorita primeiro).
 * @param {number|null} cursoId - Id do curso.
 * @returns {Promise<{codigo: string, nome: string, favorito: boolean}[]>} Turmas.
 * @throws {Error} Se o banco recusar.
 */
async function lerTurmasDaDinamica(cursoId) {
    if (!cursoId) return [];

    const turmas = await sbGet('turma',
        'select=codigo,nome,favorito&curso_id=eq.' + cursoId + '&order=nome');
    return turmas.sort((a, b) => Number(b.favorito === true) - Number(a.favorito === true));
}

/**
 * Alunos da turma (sem desistentes), em ordem alfabética.
 * @param {string} turmaCodigo - Código da turma.
 * @returns {Promise<{id: string, nome: string}[]>} Alunos.
 * @throws {Error} Se o banco recusar.
 */
async function lerAlunosDaDinamica(turmaCodigo) {
    if (!turmaCodigo) return [];

    // Helper único (js/supabase.js): só vínculos ativos da turma (NOTAS-SEM-DESISTENTES).
    const alunos = await alunosAtivosDaTurma(turmaCodigo, 'id,nome');
    return alunos.map((aluno) => ({ id: aluno.id, nome: aluno.nome || SEM_NOME_ALUNO_DINAMICA }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Notas já lançadas desta atividade. O professor recebe a linha inteira (com a sugestão da IA,
 * se a migration 2026-11-09-dinamica-correcao-ia.sql já foi aplicada); o aluno, só as colunas
 * do professor e só a nota confirmada.
 * @param {number} atividadeId - Id da atividade.
 * @param {string} [alunoId] - Se informado (tela do aluno), só a nota confirmada deste aluno.
 * @returns {Promise<Object[]>} Linhas de nota_dinamica.
 * @throws {Error} Se o banco recusar.
 */
async function lerNotasDaDinamica(atividadeId, alunoId) {
    const colunas = alunoId ? COLUNAS_ALUNO_NOTA_DINAMICA : '*';
    const filtroAluno = alunoId ? '&aluno_id=eq.' + alunoId + '&confirmada_em=not.is.null' : '';
    return sbGet(TABELA_NOTA_DINAMICA,
        'select=' + colunas + '&atividade_id=eq.' + atividadeId + filtroAluno);
}

/**
 * Estado do último pedido de correção por IA desta atividade (tabela pedido_correcao_ia,
 * a mesma da Prática; quem corrige é a IA pelo comando /corrigir-ia-dinamica).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<string|null>} PENDENTE, CONCLUIDO ou null se nunca pediu.
 * @throws {Error} Se o banco recusar.
 */
async function lerUltimoPedidoIaDaDinamica(atividadeId) {
    const linhas = await sbGet(TABELA_PEDIDO_IA_DINAMICA, 'select=estado&atividade_id=eq.' +
        atividadeId + '&order=solicitado_em.desc&limit=1');
    return linhas[0]?.estado || null;
}

/**
 * Grava um pedido PENDENTE de correção por IA (o índice único do banco barra o pedido repetido).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<boolean>} true se gravou; false se já havia um pedido pendente.
 * @throws {Error} Se o banco recusar por outro motivo.
 */
async function pedirCorrecaoIaDaDinamica(atividadeId) {
    const ultimo = await lerUltimoPedidoIaDaDinamica(atividadeId);
    if (ultimo === ESTADO_PENDENTE_IA_DINAMICA) return false;

    const resposta = await fetch(SUPABASE.URL + '/rest/v1/' + TABELA_PEDIDO_IA_DINAMICA, {
        method: 'POST',
        headers: { ...(await sbH()), Prefer: 'return=minimal' },
        body: JSON.stringify({ atividade_id: atividadeId }),
    });
    if (resposta.status === HTTP_CONFLITO_DINAMICA) return false;
    if (!resposta.ok) throw new Error(await resposta.text());
    return true;
}

/**
 * Confirma a nota do aluno: a nota é gravada e nunca mais muda (RPC confirmar_nota_dinamica).
 * @param {number} atividadeId - Id da atividade.
 * @param {string} alunoId - Id do aluno.
 * @returns {Promise<{ok: boolean, motivo: string}>} Resposta da RPC.
 * @throws {Error} Se o banco recusar.
 */
async function confirmarNotaDaDinamica(atividadeId, alunoId) {
    const resposta = await fetch(SUPABASE.URL + '/rest/v1/rpc/' + RPC_CONFIRMAR_NOTA_DINAMICA, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify({ p_atividade: atividadeId, p_aluno: alunoId }),
    });
    if (!resposta.ok) throw new Error(await resposta.text());
    return resposta.json();
}

/**
 * Grava (insere ou atualiza) a nota de um aluno.
 * Nunca envia as colunas da IA (nota_ia, criterios_ia, motivo_ia, nota_ia_em): elas ficam como
 * a IA gravou.
 * @param {{aluno_id: string, atividade_id: number, nota: number, criterios: Object[],
 *   formato: string|null, grupo: string|null, comentario: string|null}} registro - Nota.
 * @returns {Promise<Object[]>} Linha gravada.
 * @throws {Error} Se o banco recusar.
 */
async function gravarNotaDaDinamica(registro) {
    const url = SUPABASE.URL + '/rest/v1/' + TABELA_NOTA_DINAMICA +
        '?on_conflict=aluno_id,atividade_id';
    const resposta = await fetch(url, {
        method: 'POST',
        headers: { ...(await sbH()), Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(registro),
    });
    if (!resposta.ok) throw new Error(await resposta.text());
    return resposta.json();
}

/**
 * Critérios de nota gravados no atributo data-criterios da página.
 * @returns {{nome: string, pontos: number}[]} Critérios (a soma é 10).
 */
function lerCriteriosDaDinamica() {
    try {
        return JSON.parse(document.body.dataset.criterios || '[]');
    } catch (erro) {
        return [];
    }
}
