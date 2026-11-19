// Painel do professor: botão "🔗 Cursos Vinculados" (só para o Professor Administrador).
// Abre um modal que vincula um professor existente a um curso: marca as turmas do curso que o
// professor enxerga (turmaprofessor — é por elas que o curso aparece para ele) e as matérias do
// curso liberadas nessas turmas (turma_materia). Grava pelas funções do banco
// listar_professores e vincular_curso_professor
// (database/2026-11-14-cursos-vinculados-professor.sql), numa transação só e só para o
// Professor Administrador. O par turma×matéria é global: desmarcar matéria aqui NÃO remove o
// vínculo da turma — isso continua em turmas.html → 📚 Matérias. Desmarcar turma só tira o
// vínculo do professor, sem apagar a turma nem seus pares. Depende de: supabase-js v2 (CDN),
// js/supabase.js (obterClienteSupabase, sbGet).
// Regra: docs/regras/usuarios-turmas-paginas-professor.md

const ID_BOTAO_VINCULOS = 'btnCursosVinculados';
const CLASSE_VINCULOS = 'vinculos-professor';
const RPC_EH_ADMINISTRADOR_VINCULOS = 'eh_professor_administrador';
const RPC_LISTAR_PROFESSORES = 'listar_professores';
const RPC_VINCULAR_CURSO = 'vincular_curso_professor';
const CODIGO_FUNCAO_AUSENTE_VINCULOS = 'PGRST202';
const MSG_FUNCAO_AUSENTE_VINCULOS = 'As funções de vínculo ainda não existem no banco. Aplique ' +
    'o SQL database/2026-11-14-cursos-vinculados-professor.sql no SQL Editor do Supabase.';
const MSG_SEM_PROFESSOR_VINCULOS = 'Escolha o professor.';
const MSG_SEM_CURSO_VINCULOS = 'Escolha o curso.';
const MSG_SEM_TURMA_VINCULOS = 'Marque pelo menos 1 turma.';
const MSG_SEM_MATERIA_VINCULOS = 'Marque pelo menos 1 matéria.';
const NOTA_MATERIA_VINCULOS = 'O par turma×matéria é de toda a turma: desmarcar matéria não ' +
    'remove o vínculo dela com a turma (isso se faz em Turmas → 📚 Matérias).';

const estadoVinculos = {
    professores: [],
    cursos: [],
    turmas: [],
    materias: [],
    turmasProfessor: [],
    turmaMateria: [],
    professorAtual: '',
    cursoAtual: '',
    turmasEscolhidas: new Set(),
    materiasEscolhidas: new Set(),
};

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoVinculos(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

/**
 * Diz se o usuário logado é o Professor Administrador (RPC do banco).
 * @returns {Promise<boolean>} true se for o administrador.
 */
async function ehAdministradorVinculos() {
    const cliente = obterClienteSupabase();
    if (!cliente) return false;
    const { data, error } = await cliente.rpc(RPC_EH_ADMINISTRADOR_VINCULOS);
    return !error && data === true;
}

/**
 * Lê do banco professores (RPC), cursos, turmas, matérias e os vínculos atuais.
 * @returns {Promise<void>} Resolve quando o estado foi preenchido.
 * @throws {Error} Com mensagem amigável se as funções ainda não existirem no banco.
 */
async function carregarDadosVinculos() {
    const cliente = obterClienteSupabase();
    const [professores, cursos, turmas, materias, turmasProfessor, turmaMateria] =
        await Promise.all([
            cliente.rpc(RPC_LISTAR_PROFESSORES).then(({ data, error }) => {
                if (error) throw new Error(error.code === CODIGO_FUNCAO_AUSENTE_VINCULOS
                    ? MSG_FUNCAO_AUSENTE_VINCULOS : error.message);
                return data;
            }),
            sbGet('curso', 'select=id,nome_completo&order=nome_completo'),
            sbGet('turma', 'select=codigo,nome,curso_id&order=nome'),
            sbGet('materia', 'select=id,descricao,curso_id&order=descricao'),
            sbGet('turmaprofessor', 'select=turma_codigo,professor_id'),
            sbGet('turma_materia', 'select=turma_codigo,materia_id'),
        ]);
    Object.assign(estadoVinculos, { professores, cursos, turmas, materias,
        turmasProfessor, turmaMateria });
}

/**
 * Recarrega só os vínculos (depois de salvar, para o resumo refletir o banco).
 * @returns {Promise<void>} Resolve quando os vínculos foram atualizados.
 */
async function recarregarVinculos() {
    const [turmasProfessor, turmaMateria] = await Promise.all([
        sbGet('turmaprofessor', 'select=turma_codigo,professor_id'),
        sbGet('turma_materia', 'select=turma_codigo,materia_id'),
    ]);
    estadoVinculos.turmasProfessor = turmasProfessor;
    estadoVinculos.turmaMateria = turmaMateria;
}

/**
 * Turmas do professor atual dentro do curso atual (códigos).
 * @returns {Set<string>} Códigos das turmas vinculadas ao professor no curso.
 */
function turmasDoProfessorNoCurso() {
    const turmasDoCurso = new Set(estadoVinculos.turmas
        .filter((t) => String(t.curso_id) === estadoVinculos.cursoAtual)
        .map((t) => t.codigo));
    return new Set(estadoVinculos.turmasProfessor
        .filter((v) => v.professor_id === estadoVinculos.professorAtual
            && turmasDoCurso.has(v.turma_codigo))
        .map((v) => v.turma_codigo));
}

/**
 * Matérias do curso atual já ligadas a alguma turma marcada (turma_materia).
 * @returns {Set<number>} Ids das matérias liberadas nas turmas marcadas.
 */
function materiasLiberadasNasMarcadas() {
    return new Set(estadoVinculos.turmaMateria
        .filter((v) => estadoVinculos.turmasEscolhidas.has(v.turma_codigo))
        .map((v) => v.materia_id));
}

/**
 * Cria uma chave ON/OFF (caixa de marcar com visual de chave) para um item da lista.
 * @param {{texto: string, marcado: boolean, aoMudar: function(boolean): void}} dados - Item.
 * @returns {HTMLLabelElement} Chave pronta.
 */
function criarChaveVinculos(dados) {
    const rotulo = criarElementoVinculos('label', CLASSE_VINCULOS + '__chave');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = dados.marcado;
    caixa.addEventListener('change', () => dados.aoMudar(caixa.checked));
    rotulo.append(caixa, criarElementoVinculos('span', '', dados.texto));
    return rotulo;
}

/**
 * Monta a lista de chaves de um grupo (turmas ou matérias) do curso escolhido.
 * @param {{itens: Object[], escolhidos: Set, chave: string, texto: string, aoMudar: Function}} dados
 *     Itens do curso, conjunto de marcados, campo do id, campo do texto e aviso de mudança.
 * @returns {HTMLElement} Lista pronta.
 */
function montarListaVinculos(dados) {
    const lista = criarElementoVinculos('div', CLASSE_VINCULOS + '__lista');
    if (!dados.itens.length) {
        lista.appendChild(criarElementoVinculos('p', CLASSE_VINCULOS + '__vazio',
            'Nada neste curso.'));
        return lista;
    }
    dados.itens.forEach((item) => lista.appendChild(criarChaveVinculos({
        texto: item[dados.texto], marcado: dados.escolhidos.has(item[dados.chave]),
        aoMudar: (ligado) => {
            if (ligado) dados.escolhidos.add(item[dados.chave]);
            else dados.escolhidos.delete(item[dados.chave]);
            dados.aoMudar();
        } })));
    return lista;
}

/**
 * Texto com os vínculos atuais do professor escolhido ("Curso: turma A, turma B · ...").
 * @returns {string} Resumo dos vínculos, ou aviso de que não há nenhum.
 */
function textoVinculosAtuais() {
    const turmasDoProfessor = new Set(estadoVinculos.turmasProfessor
        .filter((v) => v.professor_id === estadoVinculos.professorAtual)
        .map((v) => v.turma_codigo));
    if (!turmasDoProfessor.size) return 'Nenhuma turma vinculada ainda.';
    const porCurso = new Map();
    estadoVinculos.turmas
        .filter((t) => turmasDoProfessor.has(t.codigo))
        .forEach((t) => {
            const nomeCurso = (estadoVinculos.cursos.find((c) => String(c.id) === String(t.curso_id))
                || {}).nome_completo || 'Curso ' + t.curso_id;
            if (!porCurso.has(nomeCurso)) porCurso.set(nomeCurso, []);
            porCurso.get(nomeCurso).push(t.nome || t.codigo);
        });
    return [...porCurso.entries()]
        .map(([curso, turmas]) => curso + ': ' + turmas.join(', ')).join(' · ');
}

/**
 * Redesenha as listas de turmas e matérias do curso escolhido e o resumo de vínculos.
 * @param {{turmas: HTMLElement, materias: HTMLElement, resumo: HTMLElement,
 *     atual: HTMLElement}} area - Elementos do modal.
 */
function desenharVinculos(area) {
    area.atual.textContent = 'Vínculos atuais — ' + textoVinculosAtuais();
    const doCurso = (item) => String(item.curso_id) === estadoVinculos.cursoAtual;
    const aoMudar = () => {
        area.resumo.textContent = estadoVinculos.turmasEscolhidas.size + ' turma(s) e ' +
            estadoVinculos.materiasEscolhidas.size + ' matéria(s) marcada(s).';
    };
    area.turmas.replaceChildren(montarListaVinculos({
        itens: estadoVinculos.turmas.filter(doCurso), escolhidos: estadoVinculos.turmasEscolhidas,
        chave: 'codigo', texto: 'nome', aoMudar }));
    area.materias.replaceChildren(montarListaVinculos({
        itens: estadoVinculos.materias.filter(doCurso),
        escolhidos: estadoVinculos.materiasEscolhidas, chave: 'id', texto: 'descricao', aoMudar }));
    aoMudar();
}

/**
 * Prepara os conjuntos marcados ao trocar professor ou curso: turmas já vinculadas ao
 * professor no curso e matérias já liberadas nessas turmas.
 */
function prepararEscolhasVinculos() {
    estadoVinculos.turmasEscolhidas = turmasDoProfessorNoCurso();
    estadoVinculos.materiasEscolhidas = materiasLiberadasNasMarcadas();
}

/**
 * Valida as escolhas antes de chamar o banco: professor, curso e pelo menos 1 turma e
 * 1 matéria marcadas (tarefa #544 — gravar zerado confundia e zerava o vínculo).
 * @returns {string} Mensagem de erro, ou '' se estiver tudo certo.
 */
function validarEscolhasVinculos() {
    if (!estadoVinculos.professorAtual) return MSG_SEM_PROFESSOR_VINCULOS;
    if (!estadoVinculos.cursoAtual) return MSG_SEM_CURSO_VINCULOS;
    if (!estadoVinculos.turmasEscolhidas.size) return MSG_SEM_TURMA_VINCULOS;
    if (!estadoVinculos.materiasEscolhidas.size) return MSG_SEM_MATERIA_VINCULOS;
    return '';
}

/**
 * Chama a função do banco e devolve as contagens de vínculos aplicadas.
 * @returns {Promise<{turmas_vinculadas: number, materias_liberadas: number}>} Resultado.
 * @throws {Error} Com a mensagem do banco (sem permissão, entidade fora do curso etc.).
 */
async function chamarVinculoCurso() {
    const { data, error } = await obterClienteSupabase().rpc(RPC_VINCULAR_CURSO, {
        p_professor: estadoVinculos.professorAtual, p_curso: Number(estadoVinculos.cursoAtual),
        p_turmas: [...estadoVinculos.turmasEscolhidas],
        p_materias: [...estadoVinculos.materiasEscolhidas] });
    if (error) throw new Error(error.code === CODIGO_FUNCAO_AUSENTE_VINCULOS
        ? MSG_FUNCAO_AUSENTE_VINCULOS : error.message);
    return Array.isArray(data) ? data[0] : data;
}

/**
 * Envia o vínculo: valida, chama o banco, recarrega os vínculos e mostra o resultado.
 * @param {{area: Object, erro: HTMLElement, botao: HTMLButtonElement}} campos - Elementos.
 */
async function enviarVinculos(campos) {
    const problema = validarEscolhasVinculos();
    campos.erro.textContent = problema;
    if (problema) return;
    campos.botao.disabled = true;
    try {
        const resultado = await chamarVinculoCurso();
        await recarregarVinculos();
        prepararEscolhasVinculos();
        desenharVinculos(campos.area);
        campos.erro.textContent = '';
        campos.area.resultado.textContent = '✅ Vínculos salvos: ' +
            resultado.turmas_vinculadas + ' turma(s) vinculada(s) e ' +
            resultado.materias_liberadas + ' matéria(s) liberada(s) neste curso.';
    } catch (erro) {
        campos.erro.textContent = 'Não foi possível vincular: ' + erro.message;
    } finally {
        campos.botao.disabled = false;
    }
}

/**
 * Monta um combo de opções com rótulo.
 * @param {string} rotulo - Texto do rótulo.
 * @param {string} vazio - Texto da opção inicial vazia.
 * @returns {{rotulo: HTMLLabelElement, campo: HTMLSelectElement}} Rótulo e combo.
 */
function criarComboVinculos(rotulo, vazio) {
    const elemento = criarElementoVinculos('label', CLASSE_VINCULOS + '__campo', rotulo);
    const campo = document.createElement('select');
    campo.appendChild(new Option(vazio, ''));
    elemento.appendChild(campo);
    return { rotulo: elemento, campo };
}

/**
 * Monta o formulário completo dentro da caixa.
 * @param {HTMLElement} caixa - Caixa da janela.
 */
function montarFormularioVinculos(caixa) {
    const professor = criarComboVinculos('Professor', '— Escolha o professor —');
    estadoVinculos.professores.forEach((p) => professor.campo.appendChild(
        new Option(p.nome_completo + (p.login_usuario ? ' (' + p.login_usuario + ')' : ''), p.id)));
    const curso = criarComboVinculos('Curso', '— Escolha o curso —');
    estadoVinculos.cursos.forEach((c) => curso.campo.appendChild(
        new Option(c.nome_completo, String(c.id))));
    const area = { turmas: criarElementoVinculos('div'), materias: criarElementoVinculos('div'),
        resumo: criarElementoVinculos('p', CLASSE_VINCULOS + '__resumo'),
        atual: criarElementoVinculos('p', CLASSE_VINCULOS + '__atual'),
        resultado: criarElementoVinculos('p', CLASSE_VINCULOS + '__resultado') };
    professor.campo.addEventListener('change', () => {
        estadoVinculos.professorAtual = professor.campo.value;
        prepararEscolhasVinculos();
        desenharVinculos(area);
    });
    curso.campo.addEventListener('change', () => {
        estadoVinculos.cursoAtual = curso.campo.value;
        prepararEscolhasVinculos();
        desenharVinculos(area);
    });
    const erro = criarElementoVinculos('p', CLASSE_VINCULOS + '__erro');
    const botao = criarElementoVinculos('button', 'painel-botao', '💾 Salvar vínculos');
    botao.type = 'button';
    botao.addEventListener('click', () => enviarVinculos({ area, erro, botao }));
    caixa.append(criarElementoVinculos('h2', '', '🔗 Cursos Vinculados'), professor.rotulo,
        area.atual, curso.rotulo, criarElementoVinculos('h3', '', 'Turmas do curso'), area.turmas,
        criarElementoVinculos('h3', '', 'Matérias liberadas nas turmas marcadas'), area.materias,
        criarElementoVinculos('small', CLASSE_VINCULOS + '__nota', NOTA_MATERIA_VINCULOS),
        area.resumo, area.resultado, erro, botao);
    desenharVinculos(area);
}

/**
 * Abre a janela de vínculos (carrega professores, cursos, turmas, matérias e vínculos antes).
 * @param {string} [professorId] - Professor já pré-selecionado no combo (painel chama pela linha).
 */
async function abrirVinculos(professorId) {
    estadoVinculos.professorAtual = professorId || '';
    estadoVinculos.cursoAtual = '';
    estadoVinculos.turmasEscolhidas = new Set();
    estadoVinculos.materiasEscolhidas = new Set();
    const fundo = criarElementoVinculos('div', CLASSE_VINCULOS);
    const caixa = criarElementoVinculos('div', CLASSE_VINCULOS + '__caixa');
    const sair = criarElementoVinculos('button', CLASSE_VINCULOS + '__sair', '✕');
    sair.type = 'button';
    sair.setAttribute('aria-label', 'Fechar');
    sair.addEventListener('click', () => fundo.remove());
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    try {
        await carregarDadosVinculos();
        montarFormularioVinculos(caixa);
        if (professorId) {
            const combo = caixa.querySelector('select');
            combo.value = professorId;
            combo.dispatchEvent(new Event('change'));
        }
    } catch (erro) {
        caixa.appendChild(criarElementoVinculos('p', CLASSE_VINCULOS + '__erro',
            'Não foi possível carregar professores, cursos e vínculos: ' + erro.message));
    }
    caixa.prepend(sair);
}

/** Abre o modal de vínculos já com um professor pré-selecionado (chamado pelo painel). */
window.abrirVinculosProfessor = (professorId) => abrirVinculos(professorId);

/**
 * Mostra o botão de vínculos só para o Professor Administrador.
 */
async function prepararVinculos() {
    const botao = document.getElementById(ID_BOTAO_VINCULOS);
    if (!botao) return;
    botao.hidden = !(await ehAdministradorVinculos());
    if (!botao.dataset.ligado) {
        botao.dataset.ligado = 'sim';
        botao.addEventListener('click', abrirVinculos);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    prepararVinculos();
    obterClienteSupabase()?.auth.onAuthStateChange(() => prepararVinculos());
});
