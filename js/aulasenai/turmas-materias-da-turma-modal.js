// Modal "📚 Matérias" de cada linha da consulta de turmas.html: mostra as matérias vinculadas à
// turma (🗑️ = desvincular) e vincula uma matéria que ainda não está na turma. Grava na tabela
// turma_materia (RLS: só o Professor Administrador), a mesma do botão 📚 Matérias do cabeçalho.
// Depende de estadoTp e das funções de assets/js/turmas-professor-pagina.js,
// assets/js/turmas-professor-modais.js (abrirModalTp), assets/js/turmas-materias-modal.js
// (descreverMateriaTp, mensagemErroTurmaMateriaTp) e de popup.js.

const TEXTO_ESCOLHA_MATERIA_DA_TURMA_TP = "Escolha a matéria";
const TEXTO_TODAS_MATERIAS_NA_TURMA_TP = "Todas as matérias já estão nesta turma";
const TEXTO_SEM_MATERIA_NA_TURMA_TP = "Nenhuma matéria vinculada a esta turma.";

let turmaDasMateriasTp = null;

/**
 * Vínculos turma × matéria de uma turma.
 * @param {string} turmaCodigo - Código da turma.
 * @returns {Object[]} Vínculos da turma.
 */
function vinculosMateriasDaTurmaTp(turmaCodigo) {
  return estadoTp.turmasMaterias.filter((vinculo) => vinculo.turma_codigo === turmaCodigo);
}

/**
 * Descreve a matéria de um vínculo pelo id.
 * @param {number} materiaId - Id da matéria.
 * @returns {string} Texto da matéria.
 */
function descreverMateriaPeloIdTp(materiaId) {
  const materia = estadoTp.materias.find((item) => item.id === materiaId);
  return materia ? descreverMateriaTp(materia) : String(materiaId);
}

/**
 * Cria a linha de uma matéria vinculada à turma, com 🗑️.
 * @param {Object} vinculo - Linha da turma_materia.
 * @returns {HTMLLIElement} Linha.
 */
function criarItemMateriaDaTurmaTp(vinculo) {
  const item = criarElementoTp("li", "tp-professor");
  item.append(criarElementoTp("span", "", descreverMateriaPeloIdTp(vinculo.materia_id)),
    criarBotaoTp({ texto: "🗑️", classe: "tp-botao-icone", titulo: "Desvincular matéria",
      aoClicar: () => desvincularMateriaDaTurmaTp(vinculo) }));
  return item;
}

/** Redesenha as matérias vinculadas e as disponíveis da turma aberta. */
function atualizarModalMateriasDaTurmaTp() {
  const vinculos = vinculosMateriasDaTurmaTp(turmaDasMateriasTp.codigo);
  const lista = elementoTp("tpMateriasDaTurma");
  lista.replaceChildren(...vinculos.map(criarItemMateriaDaTurmaTp));
  if (!vinculos.length) {
    lista.append(criarElementoTp("li", "tp-detalhe", TEXTO_SEM_MATERIA_NA_TURMA_TP));
  }
  const vinculadas = new Set(vinculos.map((vinculo) => vinculo.materia_id));
  const disponiveis = estadoTp.materias.filter((materia) => !vinculadas.has(materia.id));
  const opcoes = disponiveis.map((materia) => (
    { valor: String(materia.id), texto: descreverMateriaTp(materia) }));
  const textoVazio = disponiveis.length
    ? TEXTO_ESCOLHA_MATERIA_DA_TURMA_TP : TEXTO_TODAS_MATERIAS_NA_TURMA_TP;
  preencherSelectTp(elementoTp("tpNovaMateriaDaTurma"), opcoes, textoVazio);
  elementoTp("tpNovaMateriaDaTurma").disabled = !disponiveis.length;
  elementoTp("tpVincularMateriaDaTurma").disabled = !disponiveis.length;
}

/**
 * Abre o modal com as matérias da turma da linha.
 * @param {Object} turma - Linha da tabela turma.
 */
function abrirModalMateriasDaTurmaTp(turma) {
  turmaDasMateriasTp = turma;
  elementoTp("tpTituloMateriasTurma").textContent = "📚 Matérias — " + descreverTurmaTp(turma);
  atualizarModalMateriasDaTurmaTp();
  abrirModalTp(elementoTp("tpModalMateriasTurma"));
}

/** Recarrega os vínculos turma × matéria e redesenha o modal e a consulta (contagem). */
async function recarregarMateriasDaTurmaTp() {
  estadoTp.turmasMaterias = await estadoTp.repositorio.listarTurmasMaterias();
  atualizarModalMateriasDaTurmaTp();
  desenharTurmasTp();
}

/**
 * Vincula a matéria escolhida à turma aberta (o modal continua aberto).
 * @param {SubmitEvent} evento - Envio do formulário.
 * @returns {Promise<void>}
 */
async function vincularMateriaNaTurmaTp(evento) {
  evento.preventDefault();
  const materiaId = Number(elementoTp("tpNovaMateriaDaTurma").value);
  if (!materiaId) {
    await mostrarPopup("Escolha a matéria.", { tipo: "aviso" });
    return;
  }

  try {
    await estadoTp.repositorio.criarTurmaMateria(
      { turma_codigo: turmaDasMateriasTp.codigo, materia_id: materiaId });
  } catch (erro) {
    await mostrarPopup(mensagemErroTurmaMateriaTp(erro),
      { tipo: "erro", titulo: "Vínculo não gravado" });
    return;
  }
  await recarregarMateriasDaTurmaTp();
  await mostrarPopup("Matéria vinculada à turma.", { tipo: "sucesso" });
}

/**
 * Desvincula uma matéria da turma depois da confirmação.
 * @param {Object} vinculo - Linha da turma_materia.
 * @returns {Promise<void>}
 */
async function desvincularMateriaDaTurmaTp(vinculo) {
  const confirmou = await confirmarPopup(
    "Tirar a matéria " + descreverMateriaPeloIdTp(vinculo.materia_id) + " desta turma?",
    { tipo: "pergunta", titulo: "Desvincular matéria" });
  if (!confirmou) return;
  try {
    await estadoTp.repositorio.excluirTurmaMateria(vinculo.id);
  } catch (erro) {
    await mostrarPopup(mensagemErroTurmaMateriaTp(erro),
      { tipo: "erro", titulo: "Vínculo não removido" });
    return;
  }
  await recarregarMateriasDaTurmaTp();
  await mostrarPopup("Matéria desvinculada da turma.", { tipo: "sucesso" });
}

/** Liga o formulário do modal de matérias da turma. */
function ligarEventosMateriasDaTurmaTp() {
  elementoTp("tpFormularioMateriasTurma")
    .addEventListener("submit", vincularMateriaNaTurmaTp);
}
