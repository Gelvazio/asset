// ── Página recuperacao.html (professor) ───────────────────────────────────────────────────
// Confere login e perfil de professor, mostra os combos Curso e Matéria e a tabela dos alunos
// em recuperação. Só leitura. Dados: recuperacao-pagina-repositorio.js · regras:
// recuperacao-pagina-regras.js. Todo texto vai para a tela por textContent (nada de innerHTML).

const TEXTO_SEM_LOGIN_RC = 'Entre com a conta de professor para ver os alunos em recuperação.';
const TEXTO_SEM_PERMISSAO_RC = 'Acesso restrito ao professor.';
const TEXTO_ENTRAR_RC = 'Entrar';
const ROTA_LOGIN_RC = 'login.html';
const TEXTO_TODOS_CURSOS_RC = 'Todos os cursos';
const TEXTO_TODAS_MATERIAS_RC = 'Todas as matérias';
const TEXTO_TODAS_TURMAS_RC = 'Todas as turmas';
const TEXTO_VAZIO_RC = 'Nenhum aluno em recuperação para o filtro escolhido.';
const TEXTO_ERRO_RC = 'Erro ao carregar os alunos em recuperação: ';

const estadoRc = { linhas: [] };

/**
 * Atalho para document.getElementById.
 * @param {string} id - Id do elemento.
 * @returns {HTMLElement|null} Elemento.
 */
function elementoRc(id) {
    return document.getElementById(id);
}

/**
 * Cria um elemento com classe e texto (sempre por textContent).
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classe CSS ("" para nenhuma).
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoRc(tag, classe, texto = '') {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    elemento.textContent = texto;
    return elemento;
}

/**
 * Mostra o aviso de bloqueio (sem login ou sem permissão) e esconde o conteúdo.
 * @param {string} mensagem - Texto do aviso.
 * @param {boolean} comBotaoEntrar - true para incluir o link de login.
 */
function bloquearPaginaRc(mensagem, comBotaoEntrar) {
    const aviso = elementoRc('rcBloqueio');
    aviso.replaceChildren(criarElementoRc('p', '', mensagem));
    if (comBotaoEntrar) {
        const link = criarElementoRc('a', 'rc-botao', TEXTO_ENTRAR_RC);
        link.href = ROTA_LOGIN_RC;
        aviso.append(link);
    }
    aviso.hidden = false;
    elementoRc('rcConteudo').hidden = true;
}

/**
 * Preenche um combo com "todos" e as opções informadas, mantendo a escolha se ela ainda existir.
 * @param {HTMLSelectElement} combo - Combo a preencher.
 * @param {string} textoTodos - Texto da opção "todos".
 * @param {{valor: string, texto: string}[]} opcoes - Opções.
 */
function preencherComboRc(combo, textoTodos, opcoes) {
    const escolhido = combo.value;
    const todos = new Option(textoTodos, VALOR_TODOS_RC);
    combo.replaceChildren(todos, ...opcoes.map((opcao) => new Option(opcao.texto, opcao.valor)));
    combo.value = opcoes.some((opcao) => opcao.valor === escolhido) ? escolhido : VALOR_TODOS_RC;
}

/**
 * Lê os valores dos combos.
 * @returns {{curso: string, materia: string, turma: string}} Filtro atual.
 */
function lerFiltroRc() {
    return { curso: elementoRc('rcCurso').value, materia: elementoRc('rcMateria').value,
        turma: elementoRc('rcTurma').value };
}

/**
 * Refaz o combo de matérias só com as do curso escolhido.
 */
function atualizarComboMateriasRc() {
    const doCurso = filtrarLinhasRecuperacaoRc(estadoRc.linhas,
        { curso: elementoRc('rcCurso').value, materia: VALOR_TODOS_RC });
    preencherComboRc(elementoRc('rcMateria'), TEXTO_TODAS_MATERIAS_RC,
        listarOpcoesRc(doCurso, 'materiaId', 'materia'));
}

/**
 * Refaz o combo de turmas só com as do curso e da matéria escolhidos.
 */
function atualizarComboTurmasRc() {
    const doFiltro = filtrarLinhasRecuperacaoRc(estadoRc.linhas,
        { curso: elementoRc('rcCurso').value, materia: elementoRc('rcMateria').value });
    preencherComboRc(elementoRc('rcTurma'), TEXTO_TODAS_TURMAS_RC,
        listarOpcoesRc(doFiltro, 'turma', 'turma'));
}

/**
 * Cria a linha da tabela: nome do aluno e tipo da recuperação.
 * @param {Object} linha - Linha montada pelas regras.
 * @returns {HTMLTableRowElement} Linha pronta.
 */
function criarLinhaTabelaRc(linha) {
    const tr = document.createElement('tr');
    tr.className = linha.classeLinha;
    [linha.aluno, linha.tipoRecuperacao]
        .forEach((texto) => tr.append(criarElementoRc('td', '', texto)));
    return tr;
}

/**
 * Desenha a tabela e o resumo para o filtro escolhido.
 */
function desenharTabelaRc() {
    const linhas = filtrarLinhasRecuperacaoRc(estadoRc.linhas, lerFiltroRc());
    elementoRc('rcCorpoTabela').replaceChildren(...linhas.map(criarLinhaTabelaRc));
    elementoRc('rcResumo').textContent = linhas.length
        ? linhas.length + ' aluno(s) em recuperação' : TEXTO_VAZIO_RC;
}

/**
 * Liga os combos: curso refaz matérias e turmas, matéria refaz as turmas; toda troca redesenha.
 */
function ligarEventosRc() {
    elementoRc('rcCurso').addEventListener('change', () => {
        atualizarComboMateriasRc();
        atualizarComboTurmasRc();
        desenharTabelaRc();
    });
    elementoRc('rcMateria').addEventListener('change', () => {
        atualizarComboTurmasRc();
        desenharTabelaRc();
    });
    elementoRc('rcTurma').addEventListener('change', desenharTabelaRc);
}

/**
 * Carrega os dados, monta os combos e abre a página.
 * @param {Object} repositorio - Repositório da página.
 */
async function carregarDadosRc(repositorio) {
    estadoRc.linhas = montarLinhasRecuperacaoRc(await repositorio.carregarDados());
    preencherComboRc(elementoRc('rcCurso'), TEXTO_TODOS_CURSOS_RC,
        listarOpcoesRc(estadoRc.linhas, 'cursoId', 'curso'));
    atualizarComboMateriasRc();
    atualizarComboTurmasRc();
    ligarEventosRc();
    desenharTabelaRc();
    elementoRc('rcConteudo').hidden = false;
}

/**
 * Inicia a página: confere login e perfil de professor e carrega os dados.
 */
async function iniciarPaginaRc() {
    try {
        const repositorio = criarRepositorioRecuperacaoPagina(await obterClienteSupabase());
        const estaLogado = Boolean(await repositorio.usuarioLogado());
        if (!estaLogado) return bloquearPaginaRc(TEXTO_SEM_LOGIN_RC, true);

        const ehProfessor = await repositorio.ehProfessor();
        if (!ehProfessor) return bloquearPaginaRc(TEXTO_SEM_PERMISSAO_RC, false);

        await carregarDadosRc(repositorio);
    } catch (erro) {
        bloquearPaginaRc(TEXTO_ERRO_RC + (erro?.message || erro), false);
    }
}

window.addEventListener('load', iniciarPaginaRc);
