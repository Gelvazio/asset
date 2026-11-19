// Configurações do professor (header, js/header-usuario.js): monta sob demanda os modais do
// botão ⚙ e do botão 🎨 TEMA. montarModalConfig(idModal, titulo) é a base comum (fundo, caixa
// role=dialog aria-modal, título, botão Fechar, Esc, clique fora, guarda anti-duplicata).
// abrirConfigProfessor(apoio) abre o modal ⚙ Configurações, hoje só com o campo "Turma
// favorita" (o campo Tema saiu dele, decisão do usuário): reaproveita assets/js/turma-favorita.js
// (RPC definir_turma_favorita, uma só no sistema); nada novo é gravado no banco.
// abrirModalTema() abre o modal pequeno "🎨 Tema", só com o seletor de tema (criarBlocoTema) em
// caixa estreita (classe config-professor__caixa--tema); exportado em window.abrirModalTema.
// O tema fica só no navegador (localStorage, chave "tema", constante CHAVE_TEMA, lista
// TEMAS_VALIDOS com os 11 temas) e vale na hora em <html data-tema> (lerTemaSalvo/aplicarTema).
// Depende de: js/supabase.js (sbGet, sbH, SUPABASE), carregado pelo header.

const CHAVE_TEMA = "tema";
const TEMA_PADRAO = "senai";
const TEMAS_VALIDOS = [
  "escuro", "roxo", "tech", "youtube", "futurista",
  "profissional", "rosa", "lilas", "violeta", "laranja", "senai",
];
const ID_MODAL_CONFIG = "config-professor";
const CLASSE_MODAL_CONFIG = "config-professor";
const ROTA_TURMA_FAVORITA_JS = "turma-favorita.js";
const ROTA_PERMISSOES_JS = "../assets/js/config-permissoes.js";
const SELETOR_SCRIPT_TURMA_FAVORITA = 'script[src$="js/turma-favorita.js"]';
const FILTRO_TURMAS_CONFIG = "select=codigo,nome&order=codigo";
const TEXTO_TITULO_CONFIG = "⚙ Configurações";
const ID_MODAL_TEMA = "modal-tema";
const TEXTO_TITULO_TEMA = "🎨 Tema";
const CLASSE_CAIXA_TEMA = CLASSE_MODAL_CONFIG + "__caixa--tema";
const TEXTO_FECHAR_CONFIG = "Fechar";
const TEXTO_TEMA_CONFIG = "Tema";
const TEXTO_TURMA_CONFIG = "Turma favorita";
const TEXTO_SEM_TURMA_CONFIG = "Escolha uma turma";
const MSG_ERRO_TURMAS_CONFIG = "Não foi possível carregar as turmas.";

/**
 * Lê o tema salvo no navegador, caindo no padrão se não houver ou for inválido.
 * @returns {string} Nome de um dos TEMAS_VALIDOS.
 */
function lerTemaSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    return TEMAS_VALIDOS.includes(salvo) ? salvo : TEMA_PADRAO;
  } catch (erro) {
    return TEMA_PADRAO;
  }
}

/**
 * Aplica o tema no <html> e guarda a escolha no navegador.
 * @param {string} nomeTema - Um dos TEMAS_VALIDOS.
 * @returns {boolean} true se aplicou, false se o nome é inválido.
 */
function aplicarTema(nomeTema) {
  if (!TEMAS_VALIDOS.includes(nomeTema)) return false;

  document.documentElement.dataset.tema = nomeTema;
  try {
    localStorage.setItem(CHAVE_TEMA, nomeTema);
  } catch (erro) {
    console.warn("Não foi possível guardar o tema:", erro);
  }
  return true;
}

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classe CSS.
 * @param {string} texto - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoConfig(tag, classe, texto) {
  const elemento = document.createElement(tag);
  elemento.className = classe;
  elemento.textContent = texto;
  return elemento;
}

/**
 * Monta o bloco "Tema": rótulo e seletor com os 10 temas, aplicando ao escolher.
 * @returns {HTMLElement} Bloco do tema.
 */
function criarBlocoTema() {
  const bloco = criarElementoConfig("label", CLASSE_MODAL_CONFIG + "__campo", "");
  const seletor = criarElementoConfig("select", CLASSE_MODAL_CONFIG + "__seletor", "");
  TEMAS_VALIDOS.forEach((tema) => seletor.append(new Option(tema, tema)));
  seletor.value = document.documentElement.dataset.tema || lerTemaSalvo();
  seletor.addEventListener("change", () => aplicarTema(seletor.value));
  bloco.append(criarElementoConfig("span", CLASSE_MODAL_CONFIG + "__rotulo", TEXTO_TEMA_CONFIG));
  bloco.append(seletor);
  return bloco;
}

/**
 * Garante que turma-favorita.js esteja carregado, sem declarar suas constantes duas vezes.
 * @param {Function} carregarScript - Carrega um script pela URL (função do header).
 * @param {Function} resolverRota - Resolve um caminho relativo a js/ (função do header).
 * @returns {Promise<void>}
 */
async function garantirTurmaFavorita(carregarScript, resolverRota) {
  const jaCarregado = typeof buscarTurmaFavorita === "function"
    || Boolean(document.querySelector(SELETOR_SCRIPT_TURMA_FAVORITA));
  if (jaCarregado) return;

  await carregarScript(resolverRota("../assets/js/" + ROTA_TURMA_FAVORITA_JS));
}

/**
 * Preenche o seletor de turmas com as turmas do banco e marca a favorita.
 * @param {HTMLSelectElement} seletor - Seletor de turmas.
 * @param {string} favorita - Código da turma favorita (vazio se não houver).
 * @returns {Promise<void>}
 */
async function preencherTurmas(seletor, favorita) {
  const turmas = await sbGet("turma", FILTRO_TURMAS_CONFIG);
  seletor.append(new Option(TEXTO_SEM_TURMA_CONFIG, ""));
  turmas.forEach(({ codigo, nome }) => seletor.append(new Option(nome || codigo, codigo)));
  seletor.value = favorita;
}

/**
 * Monta o bloco "Turma favorita": escolhe a turma e marca/desmarca como favorita.
 * @param {{carregarScript: Function, resolverRota: Function}} apoio - Funções do header.
 * @returns {Promise<HTMLElement>} Bloco da turma favorita.
 */
async function criarBlocoTurmaFavorita(apoio) {
  const bloco = criarElementoConfig("div", CLASSE_MODAL_CONFIG + "__campo", "");
  bloco.append(criarElementoConfig("span", CLASSE_MODAL_CONFIG + "__rotulo", TEXTO_TURMA_CONFIG));
  try {
    await garantirTurmaFavorita(apoio.carregarScript, apoio.resolverRota);
    const seletor = criarElementoConfig("select", CLASSE_MODAL_CONFIG + "__seletor", "");
    let favorita = await buscarTurmaFavorita();
    await preencherTurmas(seletor, favorita);
    const botao = criarBotaoFavorita(CLASSE_MODAL_CONFIG + "__botao", async () => {
      const alvo = favorita === seletor.value ? "" : seletor.value;
      await definirTurmaFavorita(alvo).catch((erro) => alert(erro.message));
      favorita = await buscarTurmaFavorita();
      atualizarBotaoFavorita(botao, Boolean(seletor.value) && favorita === seletor.value);
    });
    seletor.addEventListener("change", () => {
      atualizarBotaoFavorita(botao, Boolean(seletor.value) && favorita === seletor.value);
    });
    atualizarBotaoFavorita(botao, Boolean(favorita) && favorita === seletor.value);
    bloco.append(seletor, botao);
  } catch (erro) {
    console.warn(MSG_ERRO_TURMAS_CONFIG, erro);
    bloco.append(criarElementoConfig("p", CLASSE_MODAL_CONFIG + "__erro", MSG_ERRO_TURMAS_CONFIG));
  }
  return bloco;
}

/**
 * Fecha o modal de configurações e tira o ouvinte da tecla Esc.
 * @param {HTMLElement} fundo - Fundo (overlay) do modal.
 * @param {Function} aoTeclar - Ouvinte de teclado a remover.
 */
function fecharModalConfig(fundo, aoTeclar) {
  document.removeEventListener("keydown", aoTeclar);
  fundo.remove();
}

/**
 * Monta a base comum de um modal de configuração: fundo (overlay), caixa, título e botão
 * Fechar, com fechamento por Esc, clique fora e clique no botão. Já prende o fundo ao
 * document.body. Se já existir um modal com o mesmo id, não monta outro.
 * @param {string} idModal - Id a dar ao fundo do modal (usado na guarda anti-duplicata).
 * @param {string} titulo - Texto do título (h2) do modal.
 * @returns {{fundo: HTMLElement, caixa: HTMLElement, fechar: HTMLElement}|null} Elementos do
 *   modal, ou null se já havia um modal com esse id aberto.
 */
function montarModalConfig(idModal, titulo) {
  if (document.getElementById(idModal)) return null;

  const fundo = criarElementoConfig("div", CLASSE_MODAL_CONFIG + "__fundo", "");
  fundo.id = idModal;
  const caixa = criarElementoConfig("div", CLASSE_MODAL_CONFIG + "__caixa", "");
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  const aoTeclar = (evento) => {
    if (evento.key === "Escape") fecharModalConfig(fundo, aoTeclar);
  };
  const fechar = criarElementoConfig("button", CLASSE_MODAL_CONFIG + "__botao", TEXTO_FECHAR_CONFIG);
  fechar.type = "button";
  fechar.addEventListener("click", () => fecharModalConfig(fundo, aoTeclar));
  fundo.addEventListener("click", (evento) => {
    if (evento.target === fundo) fecharModalConfig(fundo, aoTeclar);
  });
  document.addEventListener("keydown", aoTeclar);
  caixa.append(criarElementoConfig("h2", CLASSE_MODAL_CONFIG + "__titulo", titulo));
  fundo.append(caixa);
  document.body.append(fundo);
  return { fundo, caixa, fechar };
}

/**
 * Abre o modal de configurações do professor (só a turma favorita; o tema saiu para o modal
 * 🎨 Tema do botão TEMA). Se já estiver aberto, não abre outro.
 * @param {{carregarScript: Function, resolverRota: Function}} apoio - Funções do header, para
 *   carregar turma-favorita.js e achar a pasta js/.
 * @returns {Promise<void>}
 */
async function abrirConfigProfessor(apoio) {
  const modal = montarModalConfig(ID_MODAL_CONFIG, TEXTO_TITULO_CONFIG);
  if (!modal) return;

  const { caixa, fechar } = modal;
  caixa.append(await criarBlocoTurmaFavorita(apoio));
  const permissoes = await criarBlocoPermissoesConfig(apoio);
  if (permissoes) caixa.append(permissoes);
  caixa.append(fechar);
}

/**
 * Carrega config-permissoes.js (uma vez) e monta o bloco de permissões, que só existe para o
 * Professor Administrador.
 * @param {{carregarScript: Function, resolverRota: Function}} apoio - Funções do header.
 * @returns {Promise<HTMLElement|null>} Bloco, ou null (não é administrador ou falhou).
 */
async function criarBlocoPermissoesConfig(apoio) {
  try {
    if (typeof window.criarBlocoPermissoes !== "function") {
      await apoio.carregarScript(apoio.resolverRota(ROTA_PERMISSOES_JS));
    }
    return await window.criarBlocoPermissoes();
  } catch (erro) {
    console.warn("Permissões por tela indisponíveis:", erro);
    return null;
  }
}

/**
 * Abre o modal pequeno só com o campo "Tema", para o botão 🎨 TEMA do header. Se já estiver
 * aberto, não abre outro.
 * @returns {void}
 */
function abrirModalTema() {
  const modal = montarModalConfig(ID_MODAL_TEMA, TEXTO_TITULO_TEMA);
  if (!modal) return;

  const { caixa, fechar } = modal;
  caixa.classList.add(CLASSE_CAIXA_TEMA);
  caixa.append(criarBlocoTema(), fechar);
}

window.abrirConfigProfessor = abrirConfigProfessor;
window.abrirModalTema = abrirModalTema;
