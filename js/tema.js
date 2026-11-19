// Troca o tema alterando o atributo data-tema do <html>.
// Guarda a escolha no localStorage quando disponível; sem ele, a página continua funcionando.
(function () {
  const CHAVE = "tema-site";
  const TEMAS = ["claro", "escuro"];

  function aplicarTema(tema) {
    if (!TEMAS.includes(tema)) return;
    document.documentElement.setAttribute("data-tema", tema);
  }

  function lerTemaSalvo() {
    try {
      return localStorage.getItem(CHAVE);
    } catch (erro) {
      return null;
    }
  }

  function salvarTema(tema) {
    try {
      localStorage.setItem(CHAVE, tema);
    } catch (erro) {
      // Armazenamento indisponível: o tema vale só nesta página.
    }
  }

  function alternarTema() {
    const atual = document.documentElement.getAttribute("data-tema");
    const proximo = atual === "escuro" ? "claro" : "escuro";
    aplicarTema(proximo);
    salvarTema(proximo);
  }

  aplicarTema(lerTemaSalvo() || "claro");

  document.addEventListener("DOMContentLoaded", function () {
    const botao = document.querySelector("[data-trocar-tema]");
    if (botao) botao.addEventListener("click", alternarTema);
  });
})();
