/**
 * Página pública status.html: tabela de status das matérias (sem login).
 * Lê apenas o arquivo estático status-materias.json (gerado por
 * scripts/status-materias/gerar_status_materias_json.py), sem acessar banco.
 */

const ARQUIVO_DADOS = "status-materias.json";
const ID_SLIDES = "slides_chalkie";
const ROTULO_SLIDES = "Slides (Chalkie AI)";
const SLIDE_GERADO = "SLIDE-GERADO";
const SLIDE_FALTA = "FALTA-GERAR-SLIDE";
const SIMBOLO_OK = "✅";
const SIMBOLO_FALTA = "⬜";
const SIMBOLO_TRACO = "—";
const SITUACAO_TODAS = "";
const SITUACAO_COMPLETAS = "completas";
const SITUACAO_INCOMPLETAS = "incompletas";
const PREFIXO_FALTA = "falta:";
const SITUACAO_SLIDE_GERADO = "slide-gerado";
const SITUACAO_SLIDE_FALTA = "slide-falta";
const MENSAGEM_ERRO = "Não foi possível carregar status-materias.json.";

const estado = { dados: null };

/**
 * Busca um elemento da página pelo id.
 * @param {string} id - Id do elemento.
 * @returns {HTMLElement} Elemento encontrado.
 */
function elemento(id) {
  return document.getElementById(id);
}

/**
 * Cria um elemento com classe e texto.
 * @param {string} etiqueta - Nome da tag.
 * @param {string} classe - Classe CSS (pode ser vazia).
 * @param {string} texto - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criar(etiqueta, classe, texto) {
  const no = document.createElement(etiqueta);
  if (classe) no.className = classe;
  no.textContent = texto;
  return no;
}

/**
 * Diz se a matéria possui a peça (slides contam só quando SLIDE-GERADO).
 * @param {object} materia - Registro da matéria.
 * @param {string} idPeca - Id da peça.
 * @returns {boolean} true se a peça está completa.
 */
function pecaCompleta(materia, idPeca) {
  if (idPeca === ID_SLIDES) return materia.slides_chalkie === SLIDE_GERADO;
  return materia.pecas[idPeca] === true;
}

/**
 * Lista os ids das 15 peças (14 arquivos + slides).
 * @returns {string[]} Ids na ordem das colunas.
 */
function idsDasPecas() {
  return [...estado.dados.pecas.map((peca) => peca.id), ID_SLIDES];
}

/**
 * Conta quantas peças faltam em uma matéria.
 * @param {object} materia - Registro da matéria.
 * @returns {number} Quantidade de peças não completas.
 */
function contarFaltantes(materia) {
  return idsDasPecas().filter((id) => !pecaCompleta(materia, id)).length;
}

/**
 * Monta a célula da peça Slides (Chalkie AI).
 * @param {object} materia - Registro da matéria.
 * @returns {HTMLElement} Célula da tabela.
 */
function celulaSlides(materia) {
  const status = materia.slides_chalkie;
  if (status === null || status === undefined) return criar("td", "peca-traco", SIMBOLO_TRACO);
  if (status === SLIDE_GERADO) return criar("td", "peca-ok", SIMBOLO_OK);
  if (status === SLIDE_FALTA) return criar("td", "peca-falta", SIMBOLO_FALTA);
  return criar("td", "peca-aviso", status);
}

/**
 * Monta a célula da ementa, com o total de caracteres e a marca da faixa.
 * @param {object} materia - Registro da matéria.
 * @returns {HTMLElement} Célula da tabela.
 */
function celulaEmenta(materia) {
  if (!materia.pecas.ementa) return criar("td", "peca-falta", SIMBOLO_FALTA);
  const numero = materia.ementa_caracteres.toLocaleString("pt-BR");
  const classe = materia.ementa_na_faixa ? "peca-ok" : "peca-aviso";
  const [minimo, maximo] = estado.dados.faixa_ementa;
  const sufixo = materia.ementa_aceita ? " (aceita)" : "";
  const celula = criar("td", classe, `${SIMBOLO_OK} ${numero}${sufixo}`);
  celula.title = materia.ementa_aceita
    ? `Fora da faixa ${minimo}–${maximo}, aceita pelo usuário`
    : `Faixa esperada: ${minimo}–${maximo} caracteres`;
  return celula;
}

/**
 * Monta a célula de uma peça comum (existe ou não).
 * @param {object} materia - Registro da matéria.
 * @param {string} idPeca - Id da peça.
 * @returns {HTMLElement} Célula da tabela.
 */
function celulaPeca(materia, idPeca) {
  if (idPeca === ID_SLIDES) return celulaSlides(materia);
  if (idPeca === "ementa") return celulaEmenta(materia);
  const existe = materia.pecas[idPeca] === true;
  return criar("td", existe ? "peca-ok" : "peca-falta", existe ? SIMBOLO_OK : SIMBOLO_FALTA);
}

/**
 * Monta a linha da tabela de uma matéria.
 * @param {object} materia - Registro da matéria.
 * @returns {HTMLElement} Linha da tabela.
 */
function linhaMateria(materia) {
  const linha = document.createElement("tr");
  const nome = criar("td", "status-nome", materia.materia);
  nome.appendChild(criar("span", "status-curso-nome", materia.curso));
  linha.appendChild(nome);
  idsDasPecas().forEach((id) => linha.appendChild(celulaPeca(materia, id)));
  const faltam = contarFaltantes(materia);
  const classe = faltam === 0 ? "status-faltam status-faltam--completo" : "status-faltam";
  linha.appendChild(criar("td", classe, String(faltam)));
  return linha;
}

/**
 * Desenha o cabeçalho da tabela com uma coluna por peça.
 */
function desenharCabecalho() {
  const linha = document.createElement("tr");
  linha.appendChild(criar("th", "status-nome", "Matéria"));
  estado.dados.pecas.forEach((peca) => {
    const coluna = criar("th", "", peca.rotulo);
    coluna.title = peca.arquivo;
    linha.appendChild(coluna);
  });
  linha.appendChild(criar("th", "", ROTULO_SLIDES));
  linha.appendChild(criar("th", "", "Faltam"));
  elemento("status-cabecalho").replaceChildren(linha);
}

/**
 * Preenche o select de situação (todas, completas, incompletas, falta peça, slides).
 */
function preencherSituacoes() {
  const select = elemento("filtro-situacao");
  const opcoes = [
    [SITUACAO_TODAS, "Todas"],
    [SITUACAO_COMPLETAS, "Completas (15 peças)"],
    [SITUACAO_INCOMPLETAS, "Incompletas"],
    [SITUACAO_SLIDE_FALTA, "Falta gerar slide"],
    [SITUACAO_SLIDE_GERADO, "Slide gerado"],
    ...estado.dados.pecas.map((peca) => [PREFIXO_FALTA + peca.id, `Falta: ${peca.rotulo}`]),
  ];
  select.replaceChildren(...opcoes.map(([valor, rotulo]) => new Option(rotulo, valor)));
}

/**
 * Preenche o select de cursos com os cursos presentes nos dados.
 */
function preencherCursos() {
  const cursos = [...new Set(estado.dados.materias.map((m) => m.curso))].sort();
  const select = elemento("filtro-curso");
  cursos.forEach((curso) => select.appendChild(new Option(curso, curso)));
}

/**
 * Aplica o filtro de situação a uma matéria.
 * @param {object} materia - Registro da matéria.
 * @param {string} situacao - Valor do select de situação.
 * @returns {boolean} true se a matéria passa no filtro.
 */
function passaSituacao(materia, situacao) {
  if (situacao === SITUACAO_TODAS) return true;
  if (situacao === SITUACAO_COMPLETAS) return contarFaltantes(materia) === 0;
  if (situacao === SITUACAO_INCOMPLETAS) return contarFaltantes(materia) > 0;
  if (situacao === SITUACAO_SLIDE_GERADO) return materia.slides_chalkie === SLIDE_GERADO;
  if (situacao === SITUACAO_SLIDE_FALTA) return materia.slides_chalkie === SLIDE_FALTA;
  return !pecaCompleta(materia, situacao.slice(PREFIXO_FALTA.length));
}

/**
 * Lista as matérias que passam em todos os filtros.
 * @returns {object[]} Matérias filtradas.
 */
function materiasFiltradas() {
  const curso = elemento("filtro-curso").value;
  const texto = elemento("filtro-materia").value.trim().toLowerCase();
  const situacao = elemento("filtro-situacao").value;
  return estado.dados.materias.filter((materia) => {
    const passaCurso = !curso || materia.curso === curso;
    const passaTexto = !texto || materia.materia.toLowerCase().includes(texto);
    return passaCurso && passaTexto && passaSituacao(materia, situacao);
  });
}

/**
 * Cria o cartão de progresso de um curso.
 * @param {string} curso - Nome do curso.
 * @param {object[]} materias - Matérias do curso.
 * @returns {HTMLElement} Cartão com contagem e barra.
 */
function cartaoCurso(curso, materias) {
  const total = materias.length * idsDasPecas().length;
  const faltantes = materias.reduce((soma, m) => soma + contarFaltantes(m), 0);
  const completas = materias.filter((m) => contarFaltantes(m) === 0).length;
  const item = criar("div", "status-curso-item", "");
  item.appendChild(criar("strong", "", curso));
  item.appendChild(criar("span", "", `${materias.length} matérias · ${completas} completas`));
  const barra = document.createElement("progress");
  barra.max = total;
  barra.value = total - faltantes;
  barra.setAttribute("aria-label", `Progresso de ${curso}`);
  item.appendChild(barra);
  item.appendChild(criar("span", "", `${total - faltantes}/${total} peças`));
  return item;
}

/**
 * Redesenha os cartões de progresso por curso (respeitando o filtro de curso).
 */
function desenharCursos() {
  const curso = elemento("filtro-curso").value;
  const porCurso = new Map();
  estado.dados.materias
    .filter((materia) => !curso || materia.curso === curso)
    .forEach((materia) => {
      if (!porCurso.has(materia.curso)) porCurso.set(materia.curso, []);
      porCurso.get(materia.curso).push(materia);
    });
  const cartoes = [...porCurso].map(([nome, lista]) => cartaoCurso(nome, lista));
  elemento("status-cursos").replaceChildren(...cartoes);
}

/**
 * Redesenha cursos e tabela conforme os filtros atuais.
 */
function atualizar() {
  const lista = materiasFiltradas();
  elemento("status-corpo").replaceChildren(...lista.map(linhaMateria));
  elemento("status-contagem").textContent = `(${lista.length} de ${estado.dados.materias.length})`;
  desenharCursos();
}

/**
 * Liga os filtros ao redesenho.
 */
function ligarFiltros() {
  ["filtro-curso", "filtro-situacao"].forEach((id) => {
    elemento(id).addEventListener("change", atualizar);
  });
  elemento("filtro-materia").addEventListener("input", atualizar);
}

/**
 * Carrega o JSON, monta filtros e tabela.
 * @returns {Promise<void>}
 */
async function iniciar() {
  try {
    const resposta = await fetch(ARQUIVO_DADOS, { cache: "no-cache" });
    if (!resposta.ok) throw new Error(String(resposta.status));
    estado.dados = await resposta.json();
  } catch (erro) {
    const aviso = elemento("status-erro");
    aviso.textContent = MENSAGEM_ERRO;
    aviso.hidden = false;
    elemento("status-geracao").textContent = "Telemetria indisponível.";
    return;
  }
  elemento("status-geracao").textContent = `Gerado em ${estado.dados.gerado_em} (Brasília)`;
  preencherCursos();
  preencherSituacoes();
  desenharCabecalho();
  ligarFiltros();
  atualizar();
}

iniciar();
