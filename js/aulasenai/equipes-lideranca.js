// ── Liderança das equipes: líder, vice-líder e permissões do aluno ──────────────────────────
// Parte do modal de equipes (assets/js/equipes-modal.js). Reúne o que é do papel de liderança:
//  - líder 👑 e vice-líder 🥈 (1 de cada por equipe; um integrante não é os dois);
//  - permissões do aluno líder/vice (usuario.pode_cadastrar_equipes / pode_editar_equipes),
//    definidas só pelo professor (RPC definir_permissoes_equipes_aluno);
//  - gravar e editar integrante com esses campos.
// Quem decide é o banco (RLS + RPC); aqui a tela só esconde o que o aluno não pode usar.
// Usa as funções e o estado do equipes-modal.js (carregado depois, usado só nos cliques).

const CAMPO_LIDER_EQUIPES = 'lider';
const CAMPO_VICE_EQUIPES = 'vice_lider';
const ROTULO_LIDER_EQUIPES = 'Líder da equipe';
const ROTULO_VICE_EQUIPES = 'Vice-líder da equipe';
const ROTULO_PODE_CADASTRAR_EQUIPES = 'Pode cadastrar equipes';
const ROTULO_PODE_EDITAR_EQUIPES = 'Pode editar equipes';
const ICONE_LIDER_EQUIPES = '👑';
const ICONE_VICE_EQUIPES = '🥈';
const TITULO_ICONE_LIDER_EQUIPES = 'Líder da equipe';
const TITULO_ICONE_VICE_EQUIPES = 'Vice-líder da equipe';
const SELETOR_PAPEIS_EQUIPES = '[data-lideranca="papeis"]';
const SELETOR_PERMISSOES_EQUIPES = '[data-lideranca="permissoes"]';
const PERMISSOES_PROFESSOR_EQUIPES = { cadastrar: true, editar: true };
const EXCLUSIVO_LIDERANCA_EQUIPES = {
  [CAMPO_LIDER_EQUIPES]: CAMPO_VICE_EQUIPES,
  [CAMPO_VICE_EQUIPES]: CAMPO_LIDER_EQUIPES,
};

/**
 * Diz se quem usa o modal é o professor (na visão de gestão, quem não é aluno líder).
 * @returns {boolean} Verdadeiro para o professor.
 */
function ehProfessorEquipes() {
  return !estadoEquipes.ehLider;
}

/**
 * @returns {boolean} Verdadeiro se pode cadastrar equipes (professor, ou aluno com permissão).
 */
function podeCadastrarEquipes() {
  return Boolean(estadoEquipes.permissoes?.cadastrar);
}

/**
 * @returns {boolean} Verdadeiro se pode editar equipes e integrantes.
 */
function podeEditarEquipes() {
  return Boolean(estadoEquipes.permissoes?.editar);
}

/**
 * @returns {boolean} Verdadeiro se pode adicionar integrante (cadastrar OU editar).
 */
function podeAdicionarIntegranteEquipes() {
  return podeCadastrarEquipes() || podeEditarEquipes();
}

/**
 * Lê as permissões do usuário e guarda em estadoEquipes.permissoes e estadoEquipes.ehLider.
 * Professor tem tudo; aluno usa usuario.pode_cadastrar_equipes / pode_editar_equipes.
 * @param {boolean} ehProfessor - Se o usuário é professor.
 * @returns {Promise<void>}
 */
async function carregarPermissoesUsuarioEquipes(ehProfessor) {
  const { repositorio, usuario } = estadoEquipes;
  estadoEquipes.permissoes = ehProfessor ? PERMISSOES_PROFESSOR_EQUIPES
    : await repositorio.lerPermissoesEquipes(usuario.id);
  estadoEquipes.ehLider = !ehProfessor && podeAdicionarIntegranteEquipes();
}

/**
 * Mostra ou esconde os botões "+ Nova equipe" e "+ Novo integrante" conforme as permissões.
 * @returns {void}
 */
function aplicarPermissoesEquipes() {
  elementosEquipes.botaoNovaEquipe.hidden = !podeCadastrarEquipes();
  elementosEquipes.botaoNovoIntegrante.hidden = !podeAdicionarIntegranteEquipes();
}

/**
 * Peso para ordenar: líder (2), vice-líder (1), demais (0).
 * @param {{lider?: boolean, vice_lider?: boolean}} membro - Integrante.
 * @returns {number} Peso.
 */
function pesoLiderancaEquipes(membro) {
  if (membro.lider) return 2;
  return membro.vice_lider ? 1 : 0;
}

/**
 * Ícone do integrante: 👑 líder, 🥈 vice-líder, vazio para os demais.
 * @param {{lider?: boolean, vice_lider?: boolean}} membro - Integrante.
 * @returns {string} Ícone ou texto vazio.
 */
function iconeLiderancaEquipes(membro) {
  if (membro.lider) return ICONE_LIDER_EQUIPES;
  return membro.vice_lider ? ICONE_VICE_EQUIPES : '';
}

/**
 * Cria o ícone de liderança (com dica ao passar o mouse) ou null se não for líder nem vice.
 * @param {{lider?: boolean, vice_lider?: boolean}} membro - Integrante.
 * @returns {HTMLSpanElement|null} Ícone com title, ou null.
 */
function criarIconeLiderancaEquipes(membro) {
  const icone = iconeLiderancaEquipes(membro);
  if (!icone) return null;

  const titulo = membro.lider ? TITULO_ICONE_LIDER_EQUIPES : TITULO_ICONE_VICE_EQUIPES;
  const elemento = criarElementoEquipes('span', 'equipes-lideranca__icone', icone + ' ');
  elemento.title = titulo;
  elemento.setAttribute('aria-label', titulo);
  return elemento;
}

/**
 * Cria um campo de marcar (checkbox) com rótulo.
 * @param {string} rotulo - Texto do rótulo.
 * @param {string} nome - Nome do campo no formulário.
 * @returns {HTMLLabelElement} Campo.
 */
function criarCaixaMarcarEquipes(rotulo, nome) {
  return criarCampoEquipes(rotulo, criarControleEquipes('input', nome, 'checkbox'));
}

/**
 * Cria os blocos do formulário do integrante: papéis (líder/vice) e permissões. Começam
 * escondidos; atualizarCamposLideranca decide quando aparecem.
 * @returns {HTMLDivElement[]} Bloco dos papéis e bloco das permissões.
 */
function criarCamposLiderancaEquipes() {
  const papeis = criarElementoEquipes('div', 'equipes-lideranca');
  papeis.dataset.lideranca = 'papeis';
  papeis.append(criarCaixaMarcarEquipes(ROTULO_LIDER_EQUIPES, CAMPO_LIDER_EQUIPES),
    criarCaixaMarcarEquipes(ROTULO_VICE_EQUIPES, CAMPO_VICE_EQUIPES));
  const permissoes = criarElementoEquipes('div', 'equipes-lideranca');
  permissoes.dataset.lideranca = 'permissoes';
  permissoes.append(criarCaixaMarcarEquipes(ROTULO_PODE_CADASTRAR_EQUIPES, 'pode_cadastrar'),
    criarCaixaMarcarEquipes(ROTULO_PODE_EDITAR_EQUIPES, 'pode_editar'));
  papeis.hidden = true;
  permissoes.hidden = true;
  return [papeis, permissoes];
}

/**
 * Mostra os papéis só ao professor e as permissões só quando líder ou vice está marcado.
 * @returns {void}
 */
function atualizarCamposLideranca() {
  const formulario = elementosEquipes.formularioMembro;
  const ehProfessor = ehProfessorEquipes();
  const temLideranca = formulario.lider.checked || formulario.vice_lider.checked;
  formulario.querySelector(SELETOR_PAPEIS_EQUIPES).hidden = !ehProfessor;
  formulario.querySelector(SELETOR_PERMISSOES_EQUIPES).hidden = !(ehProfessor && temLideranca);
}

/**
 * Marcar líder desmarca vice (e vice desmarca líder); depois refaz a visibilidade.
 * @param {Event} evento - Evento change do formulário do integrante.
 * @returns {void}
 */
function aoMudarLideranca(evento) {
  const alvo = evento.target;
  const outro = EXCLUSIVO_LIDERANCA_EQUIPES[alvo.name];
  if (!outro) return;

  if (alvo.checked) elementosEquipes.formularioMembro[outro].checked = false;
  atualizarCamposLideranca();
}

/**
 * Liga o evento de líder/vice ao formulário do integrante (uma vez).
 * @param {HTMLFormElement} formulario - Formulário do integrante.
 * @returns {void}
 */
function ligarEventosLideranca(formulario) {
  formulario.addEventListener('change', aoMudarLideranca);
}

/**
 * Tira a marca de líder (ou de vice) dos outros integrantes da equipe: só 1 de cada por equipe.
 * @param {number} equipeId - Id da equipe.
 * @param {number|null} membroId - Integrante que terá o papel.
 * @param {string} campo - 'lider' ou 'vice_lider'.
 * @returns {Promise<void>}
 */
async function desmarcarOutrosLideres(equipeId, membroId, campo) {
  const outros = estadoEquipes.membros.filter((membro) =>
    membro.equipe_id === equipeId && membro[campo] && membro.id !== membroId);
  for (const membro of outros) {
    await estadoEquipes.repositorio.alterarMembro(membro.id, { [campo]: false });
  }
}

/**
 * Lê os campos do formulário do integrante. Líder e vice só vão para o banco quando quem salva
 * é o professor (o aluno nem vê esses campos e o banco os recusaria).
 * @param {HTMLFormElement} formulario - Formulário do integrante.
 * @returns {Object} Campos prontos para gravar.
 */
function lerCamposMembroEquipes(formulario) {
  const campos = { equipe_id: Number(formulario.equipe_id.value),
    aluno_id: formulario.aluno_id.value, papel: formulario.papel.value.trim() || null,
    tarefas: formulario.tarefas.value.trim() || null };
  if (!ehProfessorEquipes()) return campos;

  campos.lider = formulario.lider.checked;
  campos.vice_lider = formulario.vice_lider.checked;
  return campos;
}

/**
 * Grava as permissões do aluno líder/vice (só professor, depois de gravar o integrante).
 * @param {Object} campos - Campos do integrante já gravado.
 * @returns {Promise<void>}
 */
async function gravarPermissoesMembroEquipes(campos) {
  const temLideranca = campos.lider || campos.vice_lider;
  if (!ehProfessorEquipes() || !temLideranca) return;

  const formulario = elementosEquipes.formularioMembro;
  await estadoEquipes.repositorio.definirPermissoesEquipes(campos.aluno_id,
    formulario.pode_cadastrar.checked, formulario.pode_editar.checked);
}

/**
 * Grava o integrante (cria ou altera), garante 1 líder e 1 vice por equipe e grava as
 * permissões do líder/vice.
 * @param {Object} campos - Campos do integrante.
 * @param {number|null} id - Id do integrante em edição (null = novo).
 * @returns {Promise<void>}
 */
async function gravarMembroEquipes(campos, id) {
  const repositorio = estadoEquipes.repositorio;
  if (campos.lider) await desmarcarOutrosLideres(campos.equipe_id, id, CAMPO_LIDER_EQUIPES);
  if (campos.vice_lider) await desmarcarOutrosLideres(campos.equipe_id, id, CAMPO_VICE_EQUIPES);
  if (id) await repositorio.alterarMembro(id, campos);
  else await repositorio.criarMembro(campos);
  await gravarPermissoesMembroEquipes(campos);
}

/**
 * Grava o integrante do formulário (adiciona ou altera).
 * @returns {Promise<void>}
 */
async function salvarMembro() {
  const formulario = elementosEquipes.formularioMembro;
  const campos = lerCamposMembroEquipes(formulario);
  const temDados = Boolean(campos.equipe_id && campos.aluno_id);
  if (!temDados) return void await mostrarPopup(MSG_MEMBRO_OBRIGATORIO, { tipo: 'aviso' });

  const id = estadoEquipes.editandoMembroId;
  const gravou = await executarGravacaoEquipes(() => gravarMembroEquipes(campos, id));
  if (!gravou) return;
  limparFormularioMembro();
  fecharJanelasEquipes();
}

/**
 * Carrega as permissões atuais do aluno líder/vice no formulário (professor).
 * @param {string} alunoId - Id do aluno do integrante em edição.
 * @returns {Promise<void>}
 */
async function carregarPermissoesMembroEquipes(alunoId) {
  const permissoes = await estadoEquipes.repositorio.lerPermissoesEquipes(alunoId);
  const formulario = elementosEquipes.formularioMembro;
  if (formulario.aluno_id.value !== alunoId) return;

  formulario.pode_cadastrar.checked = permissoes.cadastrar;
  formulario.pode_editar.checked = permissoes.editar;
}

/**
 * Carrega um integrante no formulário para edição (inclusive trocar de equipe).
 * @param {number} id - Id do integrante.
 * @returns {Promise<void>}
 */
async function editarMembro(id) {
  const membro = estadoEquipes.membros.find((item) => item.id === id);
  if (!membro) return;

  const formulario = elementosEquipes.formularioMembro;
  estadoEquipes.editandoMembroId = id;
  atualizarSelectsMembro();
  formulario.equipe_id.value = String(membro.equipe_id);
  formulario.aluno_id.value = membro.aluno_id;
  formulario.papel.value = membro.papel || '';
  formulario.tarefas.value = membro.tarefas || '';
  formulario.lider.checked = Boolean(membro.lider);
  formulario.vice_lider.checked = Boolean(membro.vice_lider);
  formulario.pode_cadastrar.checked = false;
  formulario.pode_editar.checked = false;
  atualizarCamposLideranca();
  abrirJanelaEquipes(elementosEquipes.janelaMembro, formulario.papel);
  const temLideranca = membro.lider || membro.vice_lider;
  if (ehProfessorEquipes() && temLideranca) await carregarPermissoesMembroEquipes(membro.aluno_id);
}
