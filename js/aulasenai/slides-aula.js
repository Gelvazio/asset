/**
 * Navegação dos slides HTML das aulas (assets/css/slides-aula.css).
 * Teclas: setas, espaço, PageUp/PageDown, Home, End e F (tela cheia). Botões Anterior/Próximo.
 * Cada slide é <section class="slide">; o slide visível recebe a classe slide--ativo.
 */
(function () {
  "use strict";

  const CLASSE_SLIDE = "slide";
  const CLASSE_ATIVO = "slide--ativo";
  const TECLAS_AVANCAR = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"];
  const TECLAS_VOLTAR = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"];

  const slides = Array.from(document.querySelectorAll("." + CLASSE_SLIDE));
  const contador = document.getElementById("slide-contador");
  let indiceAtual = 0;

  /**
   * Lê o número do slide pelo hash da URL (#3 abre o slide 3).
   * @returns {number} Índice válido do slide (0 se o hash não existir).
   */
  function lerIndiceDoHash() {
    const numero = parseInt(window.location.hash.replace("#", ""), 10);
    const hashValido = Number.isInteger(numero) && numero >= 1 && numero <= slides.length;
    return hashValido ? numero - 1 : 0;
  }

  /**
   * Mostra o slide do índice informado e atualiza contador e hash.
   * @param {number} indice - Índice (0 a total - 1) do slide a mostrar.
   * @returns {void}
   */
  function mostrar(indice) {
    if (slides.length === 0) return;
    indiceAtual = Math.min(Math.max(indice, 0), slides.length - 1);
    slides.forEach(function (slide, posicao) {
      slide.classList.toggle(CLASSE_ATIVO, posicao === indiceAtual);
    });
    if (contador) contador.textContent = indiceAtual + 1 + " / " + slides.length;
    history.replaceState(null, "", "#" + (indiceAtual + 1));
  }

  /**
   * Alterna a tela cheia da página.
   * @returns {void}
   */
  function alternarTelaCheia() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    document.documentElement.requestFullscreen();
  }

  /**
   * Trata as teclas de navegação.
   * @param {KeyboardEvent} evento - Evento de teclado.
   * @returns {void}
   */
  function aoPressionarTecla(evento) {
    if (TECLAS_AVANCAR.includes(evento.key)) mostrar(indiceAtual + 1);
    else if (TECLAS_VOLTAR.includes(evento.key)) mostrar(indiceAtual - 1);
    else if (evento.key === "Home") mostrar(0);
    else if (evento.key === "End") mostrar(slides.length - 1);
    else if (evento.key.toLowerCase() === "f") alternarTelaCheia();
    else return;
    evento.preventDefault();
  }

  document.addEventListener("keydown", aoPressionarTecla);
  const anterior = document.getElementById("slide-anterior");
  const proximo = document.getElementById("slide-proximo");
  if (anterior) anterior.addEventListener("click", function () { mostrar(indiceAtual - 1); });
  if (proximo) proximo.addEventListener("click", function () { mostrar(indiceAtual + 1); });
  mostrar(lerIndiceDoHash());
})();
