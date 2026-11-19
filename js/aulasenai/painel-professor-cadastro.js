// Painel do professor: botão "➕ Cadastrar professor" (só para o Professor Administrador).
// Abre um formulário com nome, login (nome.sobrenome), curso, matérias e turmas. Ao salvar, chama a
// função do banco cadastrar_professor (database/2026-11-12-cadastrar-professor.sql), que cria a
// conta, vincula as turmas e libera as matérias nelas, numa transação só, e devolve a senha inicial
// uma única vez. A página não usa chave de administrador: quem manda é o JWT do administrador.
// As escolhas de turmas e matérias ficam guardadas quando se troca de curso (dá para escolher de
// vários cursos). Depende de: supabase-js v2 (CDN), js/supabase.js (obterClienteSupabase, sbGet).
// Regra: docs/regras/usuarios-turmas-paginas-professor.md

const ID_BOTAO_CADASTRAR_PROFESSOR = 'btnCadastrarProfessor';
const CLASSE_CADASTRO = 'cadastro-professor';
const DOMINIO_LOGIN_PROFESSOR = '@senai.local';
const RPC_CADASTRAR_PROFESSOR = 'cadastrar_professor';
const RPC_EH_ADMINISTRADOR = 'eh_professor_administrador';
const CODIGO_FUNCAO_AUSENTE = 'PGRST202';
const MSG_FUNCAO_AUSENTE = 'A função cadastrar_professor ainda não existe no banco. Aplique o SQL ' +
    'database/2026-11-12-cadastrar-professor.sql no SQL Editor do Supabase.';
const MSG_SEM_NOME = 'Informe o nome completo do professor.';
const MSG_SEM_LOGIN = 'Informe o login no formato nome.sobrenome.';
const MSG_SEM_TURMA = 'Escolha ao menos uma turma: é por ela que o professor enxerga o curso.';
const REGEX_LOGIN_PROFESSOR = /^[a-z0-9]+(\.[a-z0-9]+)+$/;

const estadoCadastro = {
    turmasEscolhidas: new Set(),
    materiasEscolhidas: new Set(),
    cursos: [],
    turmas: [],
    materias: [],
    cursoAtual: '',
};

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoCadastro(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

/**
 * Diz se o usuário logado é o Professor Administrador (RPC do banco).
 * @returns {Promise<boolean>} true se for o administrador.
 */
async function ehAdministradorCadastro() {
    const cliente = obterClienteSupabase();
    if (!cliente) return false;
    const { data, error } = await cliente.rpc(RPC_EH_ADMINISTRADOR);
    return !error && data === true;
}

/**
 * Lê do banco os cursos, as turmas e as matérias (o RLS do administrador vê tudo).
 * @returns {Promise<void>} Resolve quando o estado foi preenchido.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function carregarOpcoesCadastro() {
    const [cursos, turmas, materias] = await Promise.all([
        sbGet('curso', 'select=id,nome_completo&order=nome_completo'),
        sbGet('turma', 'select=codigo,nome,curso_id&order=nome'),
        sbGet('materia', 'select=id,descricao,curso_id&order=descricao'),
    ]);
    Object.assign(estadoCadastro, { cursos, turmas, materias });
}

/**
 * Cria uma chave ON/OFF (caixa de marcar com visual de chave) para um item da lista.
 * @param {{texto: string, marcado: boolean, aoMudar: function(boolean): void}} dados - Item.
 * @returns {HTMLLabelElement} Chave pronta.
 */
function criarChaveCadastro(dados) {
    const rotulo = criarElementoCadastro('label', CLASSE_CADASTRO + '__chave');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = dados.marcado;
    caixa.addEventListener('change', () => dados.aoMudar(caixa.checked));
    rotulo.append(caixa, criarElementoCadastro('span', '', dados.texto));
    return rotulo;
}

/**
 * Monta a lista de chaves de um grupo (turmas ou matérias) do curso escolhido.
 * @param {{itens: Object[], escolhidos: Set, chave: string, texto: string, aoMudar: Function}} dados
 *     Itens do curso, conjunto de marcados, campo do id, campo do texto e aviso de mudança.
 * @returns {HTMLElement} Lista pronta.
 */
function montarListaCadastro(dados) {
    const lista = criarElementoCadastro('div', CLASSE_CADASTRO + '__lista');
    if (!dados.itens.length) {
        lista.appendChild(criarElementoCadastro('p', CLASSE_CADASTRO + '__vazio', 'Nada neste curso.'));
        return lista;
    }
    dados.itens.forEach((item) => lista.appendChild(criarChaveCadastro({
        texto: item[dados.texto], marcado: dados.escolhidos.has(item[dados.chave]),
        aoMudar: (ligado) => {
            if (ligado) dados.escolhidos.add(item[dados.chave]);
            else dados.escolhidos.delete(item[dados.chave]);
            dados.aoMudar();
        } })));
    return lista;
}

/**
 * Atualiza o resumo "N turma(s) e M matéria(s) escolhidas".
 * @param {HTMLElement} resumo - Elemento do resumo.
 */
function atualizarResumoCadastro(resumo) {
    resumo.textContent = estadoCadastro.turmasEscolhidas.size + ' turma(s) e ' +
        estadoCadastro.materiasEscolhidas.size + ' matéria(s) escolhida(s) no total.';
}

/**
 * Redesenha as listas de turmas e matérias do curso escolhido.
 * @param {{turmas: HTMLElement, materias: HTMLElement, resumo: HTMLElement}} area - Elementos.
 */
function desenharListasCadastro(area) {
    const doCurso = (item) => String(item.curso_id) === estadoCadastro.cursoAtual;
    const aoMudar = () => atualizarResumoCadastro(area.resumo);
    area.turmas.replaceChildren(montarListaCadastro({ itens: estadoCadastro.turmas.filter(doCurso),
        escolhidos: estadoCadastro.turmasEscolhidas, chave: 'codigo', texto: 'nome', aoMudar }));
    area.materias.replaceChildren(montarListaCadastro({
        itens: estadoCadastro.materias.filter(doCurso), escolhidos: estadoCadastro.materiasEscolhidas,
        chave: 'id', texto: 'descricao', aoMudar }));
    atualizarResumoCadastro(area.resumo);
}

/**
 * Valida os campos antes de chamar o banco.
 * @param {{nome: string, login: string}} dados - Campos digitados.
 * @returns {string} Mensagem de erro, ou '' se estiver tudo certo.
 */
function validarCamposCadastro(dados) {
    if (dados.nome.trim().length < 3) return MSG_SEM_NOME;
    if (!REGEX_LOGIN_PROFESSOR.test(dados.login)) return MSG_SEM_LOGIN;
    if (!estadoCadastro.turmasEscolhidas.size) return MSG_SEM_TURMA;
    return '';
}

/**
 * Chama a função do banco e devolve o e-mail e a senha inicial.
 * @param {{nome: string, login: string}} dados - Campos digitados.
 * @returns {Promise<{email: string, senha: string}>} Conta criada.
 * @throws {Error} Com a mensagem do banco (login repetido, sem permissão etc.).
 */
async function chamarCadastroProfessor(dados) {
    const { data, error } = await obterClienteSupabase().rpc(RPC_CADASTRAR_PROFESSOR, {
        p_nome: dados.nome, p_login: dados.login,
        p_turmas: [...estadoCadastro.turmasEscolhidas],
        p_materias: [...estadoCadastro.materiasEscolhidas] });
    if (error) throw new Error(error.code === CODIGO_FUNCAO_AUSENTE ? MSG_FUNCAO_AUSENTE
        : error.message);
    return Array.isArray(data) ? data[0] : data;
}

/**
 * Mostra o resultado: login e senha inicial (aparecem só agora) com botões de copiar.
 * @param {HTMLElement} caixa - Caixa do formulário (é trocada pelo resultado).
 * @param {{email: string, senha: string}} conta - Conta criada.
 */
function mostrarResultadoCadastro(caixa, conta) {
    const resultado = criarElementoCadastro('div', CLASSE_CADASTRO + '__resultado');
    resultado.append(
        criarElementoCadastro('h3', '', '✅ Professor cadastrado'),
        criarElementoCadastro('p', '', 'Login: ' + conta.email.replace(DOMINIO_LOGIN_PROFESSOR, '')),
        criarElementoCadastro('p', '', 'Senha inicial: ' + conta.senha),
        criarElementoCadastro('p', CLASSE_CADASTRO + '__aviso',
            'Anote agora: a senha não aparece de novo.'));
    const copiar = criarElementoCadastro('button', 'painel-botao', '📋 Copiar login e senha');
    copiar.type = 'button';
    copiar.addEventListener('click', () => navigator.clipboard.writeText(
        'Login: ' + conta.email.replace(DOMINIO_LOGIN_PROFESSOR, '') + ' Senha: ' + conta.senha));
    const fechar = criarElementoCadastro('button', 'painel-botao painel-botao--claro', 'Fechar');
    fechar.type = 'button';
    fechar.addEventListener('click', () => caixa.closest('.' + CLASSE_CADASTRO).remove());
    resultado.append(copiar, fechar);
    caixa.replaceChildren(resultado);
}

/**
 * Envia o formulário: valida, chama o banco e mostra o resultado ou o erro.
 * @param {{caixa: HTMLElement, nome: HTMLInputElement, login: HTMLInputElement,
 *     erro: HTMLElement, botao: HTMLButtonElement}} campos - Elementos do formulário.
 */
async function enviarCadastroProfessor(campos) {
    const dados = { nome: campos.nome.value, login: campos.login.value.trim().toLowerCase() };
    const problema = validarCamposCadastro(dados);
    campos.erro.textContent = problema;
    if (problema) return;
    campos.botao.disabled = true;
    try {
        mostrarResultadoCadastro(campos.caixa, await chamarCadastroProfessor(dados));
    } catch (erro) {
        campos.erro.textContent = 'Não foi possível cadastrar: ' + erro.message;
        campos.botao.disabled = false;
    }
}

/**
 * Cria um campo de texto com rótulo.
 * @param {string} rotulo - Texto do rótulo.
 * @param {string} dica - Texto de exemplo (placeholder).
 * @returns {{rotulo: HTMLLabelElement, campo: HTMLInputElement}} Rótulo e campo.
 */
function criarCampoTextoCadastro(rotulo, dica) {
    const elemento = criarElementoCadastro('label', CLASSE_CADASTRO + '__campo', rotulo);
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.placeholder = dica;
    campo.autocomplete = 'off';
    elemento.appendChild(campo);
    return { rotulo: elemento, campo };
}

/**
 * Monta o combo de cursos.
 * @returns {HTMLSelectElement} Combo preenchido com os cursos.
 */
function criarComboCursoCadastro() {
    const combo = document.createElement('select');
    combo.appendChild(new Option('— Escolha o curso —', ''));
    estadoCadastro.cursos.forEach((curso) => combo.appendChild(
        new Option(curso.nome_completo, String(curso.id))));
    return combo;
}

/**
 * Monta o formulário completo dentro da caixa.
 * @param {HTMLElement} caixa - Caixa da janela.
 */
function montarFormularioCadastro(caixa) {
    const nome = criarCampoTextoCadastro('Nome completo', 'Ex.: Maria da Silva');
    const login = criarCampoTextoCadastro('Login (nome.sobrenome)', 'maria.silva');
    login.rotulo.appendChild(criarElementoCadastro('small', '', DOMINIO_LOGIN_PROFESSOR));
    const combo = criarComboCursoCadastro();
    const area = { turmas: criarElementoCadastro('div'), materias: criarElementoCadastro('div'),
        resumo: criarElementoCadastro('p', CLASSE_CADASTRO + '__resumo') };
    combo.addEventListener('change', () => {
        estadoCadastro.cursoAtual = combo.value;
        desenharListasCadastro(area);
    });
    const erro = criarElementoCadastro('p', CLASSE_CADASTRO + '__erro');
    const botao = criarElementoCadastro('button', 'painel-botao', 'Cadastrar professor');
    botao.type = 'button';
    botao.addEventListener('click', () => enviarCadastroProfessor({
        caixa, nome: nome.campo, login: login.campo, erro, botao }));
    atualizarResumoCadastro(area.resumo);
    caixa.append(criarElementoCadastro('h2', '', '➕ Cadastrar professor'), nome.rotulo,
        login.rotulo, criarElementoCadastro('label', CLASSE_CADASTRO + '__campo', 'Curso'), combo,
        criarElementoCadastro('h3', '', 'Turmas do curso'), area.turmas,
        criarElementoCadastro('h3', '', 'Matérias do curso'), area.materias, area.resumo, erro,
        botao);
}

/**
 * Abre a janela do cadastro (carrega os cursos, turmas e matérias antes).
 */
async function abrirCadastroProfessor() {
    estadoCadastro.turmasEscolhidas.clear();
    estadoCadastro.materiasEscolhidas.clear();
    estadoCadastro.cursoAtual = '';
    const fundo = criarElementoCadastro('div', CLASSE_CADASTRO);
    const caixa = criarElementoCadastro('div', CLASSE_CADASTRO + '__caixa');
    const sair = criarElementoCadastro('button', CLASSE_CADASTRO + '__sair', '✕');
    sair.type = 'button';
    sair.setAttribute('aria-label', 'Fechar');
    sair.addEventListener('click', () => fundo.remove());
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    try {
        await carregarOpcoesCadastro();
        montarFormularioCadastro(caixa);
    } catch (erro) {
        caixa.appendChild(criarElementoCadastro('p', CLASSE_CADASTRO + '__erro',
            'Não foi possível carregar cursos, turmas e matérias: ' + erro.message));
    }
    caixa.prepend(sair);
}

/**
 * Mostra o botão do cadastro só para o Professor Administrador.
 */
async function prepararCadastroProfessor() {
    const botao = document.getElementById(ID_BOTAO_CADASTRAR_PROFESSOR);
    if (!botao) return;
    botao.hidden = !(await ehAdministradorCadastro());
    if (!botao.dataset.ligado) {
        botao.dataset.ligado = 'sim';
        botao.addEventListener('click', abrirCadastroProfessor);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    prepararCadastroProfessor();
    obterClienteSupabase()?.auth.onAuthStateChange(() => prepararCadastroProfessor());
});
