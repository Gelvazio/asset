// Bloco "Permissões por usuário e tela" do modal ⚙ Configurações (config-professor.js).
// Só o Professor Administrador o vê: escolhe um professor e liga/desliga o acesso a cada tela do
// menu. Grava pela função definir_permissao_tela (database/2026-11-13-permissao-tela-usuario.sql),
// que confere o administrador no banco; esconder o bloco aqui é só conveniência.
// Sem linha na tabela vale a regra padrão da tela (tela.padrao_admin): o ON/OFF mostra o acesso
// efetivo. Plano: docs/permissao-tela-usuario.md.
// Depende de: js/supabase.js (sbGet, sbH, SUPABASE) e config-professor.js (classes do modal).

const TEXTO_TITULO_PERMISSOES = "Permissões por usuário e tela";
const TEXTO_ESCOLHA_PROFESSOR = "Escolha um professor";
const MSG_ERRO_PERMISSOES = "Não foi possível carregar as permissões.";
const MSG_ERRO_GRAVAR_PERMISSAO = "Não foi possível gravar a permissão.";
const CLASSE_BASE_PERMISSOES = "config-professor";
const ROTA_RPC_PERMISSOES = "/rest/v1/rpc/";

/**
 * Chama uma função do banco com o JWT do usuário logado.
 * @param {string} nome - Nome da função (RPC).
 * @param {Object} corpo - Parâmetros da função.
 * @returns {Promise<*>} Resposta em JSON (null se vazia).
 * @throws {Error} Se o banco recusar.
 */
async function chamarRpcPermissoes(nome, corpo) {
  const resposta = await fetch(SUPABASE.URL + ROTA_RPC_PERMISSOES + nome, {
    method: "POST", headers: await sbH(), body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(nome + ": " + (await resposta.text()));

  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classe CSS.
 * @param {string} texto - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoPermissoes(tag, classe, texto) {
  const elemento = document.createElement(tag);
  elemento.className = classe;
  elemento.textContent = texto;
  return elemento;
}

/**
 * Cria a linha de uma tela: ON/OFF com o acesso efetivo; ao mudar grava e, se falhar, volta.
 * @param {{codigo: string, nome: string}} tela - Tela.
 * @param {string} usuarioId - Professor escolhido.
 * @param {boolean} ligado - Acesso efetivo atual.
 * @returns {HTMLLabelElement} Linha da tela.
 */
function criarLinhaTelaPermissao(tela, usuarioId, ligado) {
  const linha = criarElementoPermissoes("label", CLASSE_BASE_PERMISSOES + "__campo", "");
  const caixa = document.createElement("input");
  caixa.type = "checkbox";
  caixa.checked = ligado;
  caixa.addEventListener("change", async () => {
    const novo = caixa.checked;
    caixa.disabled = true;
    try {
      await chamarRpcPermissoes("definir_permissao_tela",
        { p_usuario: usuarioId, p_tela: tela.codigo, p_permitido: novo });
    } catch (erro) {
      caixa.checked = !novo;
      console.warn(MSG_ERRO_GRAVAR_PERMISSAO, erro);
      alert(MSG_ERRO_GRAVAR_PERMISSAO);
    }
    caixa.disabled = false;
  });
  linha.append(caixa, document.createTextNode(" " + tela.nome));
  return linha;
}

/**
 * Mostra as telas do professor escolhido, cada uma com o acesso efetivo.
 * @param {HTMLElement} lista - Onde as linhas entram.
 * @param {Object[]} telas - Telas (codigo, nome, padrao_admin).
 * @param {string} usuarioId - Professor escolhido (vazio = limpa a lista).
 * @returns {Promise<void>}
 */
async function mostrarTelasDoProfessor(lista, telas, usuarioId) {
  lista.replaceChildren();
  if (!usuarioId) return;

  const linhas = await sbGet("usuario_tela_permissao",
    "select=tela,permitido&usuario_id=eq." + encodeURIComponent(usuarioId));
  const explicitas = new Map(linhas.map((linha) => [linha.tela, linha.permitido]));
  telas.forEach((tela) => {
    const efetivo = explicitas.has(tela.codigo) ? explicitas.get(tela.codigo) : !tela.padrao_admin;
    lista.append(criarLinhaTelaPermissao(tela, usuarioId, efetivo));
  });
}

/**
 * Monta o bloco de permissões, ou devolve null se o usuário não for administrador.
 * @returns {Promise<HTMLElement|null>} Bloco para o modal, ou null (sem bloco).
 */
async function criarBlocoPermissoes() {
  try {
    if ((await chamarRpcPermissoes("eh_professor_administrador", {})) !== true) return null;

    const [professores, telas] = await Promise.all([
      chamarRpcPermissoes("listar_professores_permissao", {}),
      sbGet("tela", "select=codigo,nome,padrao_admin&order=nome"),
    ]);
    const bloco = criarElementoPermissoes("div", CLASSE_BASE_PERMISSOES + "__campo", "");
    const seletor = criarElementoPermissoes("select", CLASSE_BASE_PERMISSOES + "__seletor", "");
    const lista = criarElementoPermissoes("div", "", "");
    seletor.append(new Option(TEXTO_ESCOLHA_PROFESSOR, ""));
    professores.forEach((professor) => seletor.append(new Option(professor.nome, professor.id)));
    seletor.addEventListener("change", () => {
      mostrarTelasDoProfessor(lista, telas, seletor.value).catch((erro) => {
        console.warn(MSG_ERRO_PERMISSOES, erro);
      });
    });
    bloco.append(criarElementoPermissoes("span", CLASSE_BASE_PERMISSOES + "__rotulo",
      TEXTO_TITULO_PERMISSOES), seletor, lista);
    return bloco;
  } catch (erro) {
    console.warn(MSG_ERRO_PERMISSOES, erro);
    return null;
  }
}

window.criarBlocoPermissoes = criarBlocoPermissoes;
