// ── Regras da página recuperacao.html (funções puras, sem DOM nem banco) ──────────────────
// Junta os dados crus do repositório em linhas da tabela (uma por aluno × tipo de
// recuperação), monta as opções dos combos Curso e Matéria e filtra as linhas.

const VALOR_TODOS_RC = '';
const TEXTO_SEM_NOME_RC = '(sem nome)';
const TEXTO_SEM_CURSO_RC = '(sem curso)';
const TEXTO_SEM_MATERIA_RC = '(sem matéria)';
const LOCALE_RC = 'pt-BR';
// Tipo da recuperação (tipo_avaliacao da atividade de recuperação): texto da tabela, ordem das
// linhas e classe do fundo (verde claro na objetiva; amarelo claro na prática e nas atividades).
const TIPOS_RECUPERACAO_RC = {
    3: { rotulo: 'Recuperação Prova Objetiva', ordem: 1, classe: 'rc-linha--verde' },
    4: { rotulo: 'Recuperação Prova Prática', ordem: 2, classe: 'rc-linha--amarela' },
    1: { rotulo: 'Recuperação Atividades', ordem: 3, classe: 'rc-linha--amarela' },
};
const TIPO_PADRAO_RC = { rotulo: 'Recuperação', ordem: 9, classe: 'rc-linha--amarela' };

/**
 * Cria um mapa id → linha.
 * @param {Object[]} linhas - Linhas com o campo id.
 * @returns {Map<number|string, Object>} Mapa por id.
 */
function mapearPorIdRc(linhas) {
    return new Map(linhas.map((linha) => [linha.id, linha]));
}

/**
 * Monta uma linha da tabela: um aluno em uma atividade de recuperação.
 * @param {Object} registro - Linha de aluno_recuperacao.
 * @param {Object} contexto - Mapas e conjuntos de apoio (ver montarLinhasRecuperacaoRc).
 * @returns {Object} Linha da tabela.
 */
function montarLinhaRc(registro, contexto) {
    const idRecuperacao = registro.atividade_recuperacao_id;
    const recuperacao = contexto.atividades.get(idRecuperacao);
    const aula = contexto.aulas.get(recuperacao?.aula_id);
    const tipo = TIPOS_RECUPERACAO_RC[recuperacao?.tipo_avaliacao] || TIPO_PADRAO_RC;
    return {
        alunoId: registro.aluno_id,
        aluno: contexto.usuarios.get(registro.aluno_id)?.nome_completo || TEXTO_SEM_NOME_RC,
        turma: contexto.alunos.get(registro.aluno_id)?.turma_codigo || '',
        cursoId: aula?.curso_id ?? null,
        curso: contexto.cursos.get(aula?.curso_id)?.nome_completo || TEXTO_SEM_CURSO_RC,
        materiaId: aula?.materia_id ?? null,
        materia: contexto.materias.get(aula?.materia_id)?.descricao || TEXTO_SEM_MATERIA_RC,
        recuperacaoId: idRecuperacao,
        tipoRecuperacao: tipo.rotulo,
        ordemTipo: tipo.ordem,
        classeLinha: tipo.classe,
    };
}

/**
 * Monta as linhas da tabela: um registro por aluno em cada atividade de recuperação.
 * @param {Object} dados - Listas cruas lidas pelo repositório.
 * @returns {Object[]} Linhas x e atividade.
 */
function montarLinhasRecuperacaoRc(dados) {
    const contexto = {
        atividades: mapearPorIdRc(dados.atividades), aulas: mapearPorIdRc(dados.aulas),
        cursos: mapearPorIdRc(dados.cursos), materias: mapearPorIdRc(dados.materias),
        usuarios: mapearPorIdRc(dados.usuarios), alunos: mapearPorIdRc(dados.alunos),
    };
    const comparar = (a, b) => a.curso.localeCompare(b.curso, LOCALE_RC)
        || a.materia.localeCompare(b.materia, LOCALE_RC)
        || a.ordemTipo - b.ordemTipo || a.aluno.localeCompare(b.aluno, LOCALE_RC);
    return dados.alunosRecuperacao.map((registro) => montarLinhaRc(registro, contexto))
        .sort(comparar);
}

/**
 * Opções únicas (valor e texto) de um campo das linhas, em ordem alfabética.
 * @param {Object[]} linhas - Linhas da tabela.
 * @param {string} campoId - Campo com o id (ex.: 'cursoId').
 * @param {string} campoTexto - Campo com o nome (ex.: 'curso').
 * @returns {{valor: string, texto: string}[]} Opções.
 */
function listarOpcoesRc(linhas, campoId, campoTexto) {
    const opcoes = new Map();
    linhas.forEach((linha) => opcoes.set(String(linha[campoId]), linha[campoTexto]));
    return [...opcoes].map(([valor, texto]) => ({ valor, texto }))
        .sort((a, b) => a.texto.localeCompare(b.texto, LOCALE_RC));
}

/**
 * Filtra as linhas pelo curso, matéria e turma escolhidos ("" ou ausente = todos).
 * @param {Object[]} linhas - Linhas da tabela.
 * @param {{curso: string, materia: string, turma?: string}} filtro - Valores dos combos.
 * @returns {Object[]} Linhas que passam no filtro.
 */
function filtrarLinhasRecuperacaoRc(linhas, filtro) {
    return linhas.filter((linha) => {
        const passaCurso = !filtro.curso || String(linha.cursoId) === filtro.curso;
        const passaMateria = !filtro.materia || String(linha.materiaId) === filtro.materia;
        const passaTurma = !filtro.turma || linha.turma === filtro.turma;
        return passaCurso && passaMateria && passaTurma;
    });
}
