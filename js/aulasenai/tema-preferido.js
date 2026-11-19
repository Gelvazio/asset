/**
 * Aplica o tema visual salvo pelo usuario no elemento raiz da pagina.
 * Carrega antes do corpo para evitar troca de cor visivel ao abrir.
 *
 * Le o tema de localStorage["tema"] e grava no atributo data-tema do
 * elemento html; quando nao ha tema salvo, o padrao e 'senai'.
 *
 * Na primeira entrada em uma pagina dentro de MATERIAIS/<curso>/ de um dos
 * cursos com tema inicial (ASSISTENTE-DE-OPERACOES-LOGISTICAS,
 * GESTAO-E-CONTROLE-MATERIAIS, OPERADOR-PRODUCAO-INDUSTRIAL,
 * RIO_DO_SUL_MAIS_TECH e TECNICO-INFORMATICA-INTERNET), grava e aplica o
 * tema 'senai'. A flag localStorage["tema-inicial-senai"] marca que
 * essa forca inicial ja aconteceu (uma unica vez por navegador); nas
 * visitas seguintes vale o tema salvo pelo usuario.
 */

(() => {
  const CHAVE_TEMA_PREFERIDO = 'tema';
  const TEMA_PADRAO_PREFERIDO = 'senai';
  const TEMA_INICIAL_CURSOS = 'senai';
  const CHAVE_FORCA_INICIAL = 'tema-inicial-senai';
  const CURSOS_TEMA_INICIAL = [
    'ASSISTENTE-DE-OPERACOES-LOGISTICAS',
    'GESTAO-E-CONTROLE-MATERIAIS',
    'OPERADOR-PRODUCAO-INDUSTRIAL',
    'RIO_DO_SUL_MAIS_TECH',
    'TECNICO-INFORMATICA-INTERNET',
  ];

  /**
   * Le o tema salvo no localStorage, com fallback para o tema padrao.
   * @returns {string} Nome do tema salvo ou o tema padrao.
   */
  function lerTemaSalvoPreferido() {
    try {
      return localStorage.getItem(CHAVE_TEMA_PREFERIDO) || TEMA_PADRAO_PREFERIDO;
    } catch (erro) {
      return TEMA_PADRAO_PREFERIDO;
    }
  }

  /**
   * Verifica se o caminho informado pertence a um dos cursos que recebem o
   * tema inicial.
   * @param {string} caminho - Caminho (pathname) da pagina atual.
   * @returns {boolean} true se o caminho estiver dentro de um desses cursos.
   */
  function cursoComTemaInicial(caminho) {
    return CURSOS_TEMA_INICIAL.some((curso) =>
      caminho.includes(`MATERIAIS/${curso}/`)
    );
  }

  /**
   * Verifica se a flag de tema inicial dos cursos ja foi gravada.
   * @returns {boolean} true se a flag ja existir no localStorage.
   */
  function flagTemaInicialJaGravada() {
    try {
      return localStorage.getItem(CHAVE_FORCA_INICIAL) !== null;
    } catch (erro) {
      return true;
    }
  }

  /**
   * Grava o tema inicial dos cursos como preferido e marca a flag de tema inicial.
   * @returns {void}
   */
  function gravarTemaInicialCursos() {
    try {
      localStorage.setItem(CHAVE_TEMA_PREFERIDO, TEMA_INICIAL_CURSOS);
      localStorage.setItem(CHAVE_FORCA_INICIAL, '1');
    } catch (erro) {
      // Sem acesso ao storage: segue sem persistir, mas aplica na pagina atual.
    }
  }

  /**
   * Decide qual tema deve ser aplicado na carga atual da pagina.
   * @returns {string} Nome do tema a aplicar.
   */
  function decidirTemaInicial() {
    const dentroDeCursoComTemaInicial = cursoComTemaInicial(location.pathname);
    if (dentroDeCursoComTemaInicial && !flagTemaInicialJaGravada()) {
      gravarTemaInicialCursos();
      return TEMA_INICIAL_CURSOS;
    }
    return lerTemaSalvoPreferido();
  }

  /**
   * Grava o nome do tema no atributo data-tema do elemento html.
   * @param {string} nomeTema - Nome do tema a aplicar.
   * @returns {void}
   */
  function aplicarTemaPreferido(nomeTema) {
    document.documentElement.dataset.tema = nomeTema;
  }

  aplicarTemaPreferido(decidirTemaInicial());
})();
