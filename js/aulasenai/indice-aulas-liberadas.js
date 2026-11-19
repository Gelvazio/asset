// Chave ON/OFF "Apenas Aulas Liberadas" no ATIVIDADES/index.html (#546): ligada, esconde da
// grade os cards de aula bloqueados na turma escolhida no combo (.bloqueada do aluno,
// .aula--bloqueada-professor e .aula--oculta-para-aluno, as classes que o
// indice-aula-bloqueio.js pinta). Desligada, todos voltam; a escolha fica no navegador.
// Reage à turma do combo (turma-indice-alterada), à favorita (turma-favorita-alterada) e às
// trocas de bloqueio/refeitura dos cards (aula-bloqueio-alterado). Carregado pelo
// iniciarCrudAtividades (atividades-crud-modal.js), só para o professor: para o aluno a
// aula bloqueada já sai da grade por conta própria.

const CHAVE_APENAS_LIBERADAS = 'indice-aulas:apenas-liberadas';
const ROTULO_APENAS_LIBERADAS = 'Apenas Aulas Liberadas';
const CLASSE_BARRA_LIBERADAS = 'apenas-liberadas';
const CLASSE_CHAVE_LIBERADAS = 'interruptor-aula';
const CLASSE_OCULTA_LIBERADAS = 'aula--oculta-filtro-liberadas';
const SELETOR_RESUMO_LIBERADAS = '.resumo';
const SELETOR_GRADE_LIBERADAS = 'section.grade';
const SELETOR_CARDS_LIBERADAS = 'article.aula';
const CLASSES_AULA_BLOQUEADA_LIBERADAS = ['bloqueada', 'aula--bloqueada-professor',
    'aula--oculta-para-aluno'];
const EVENTOS_REFILTRO_LIBERADAS = ['turma-indice-alterada', 'turma-favorita-alterada',
    'aula-bloqueio-alterado'];

/**
 * Lê no navegador se a chave estava ligada.
 * @returns {boolean} true = só aulas liberadas.
 */
function lerApenasLiberadas() {
    return localStorage.getItem(CHAVE_APENAS_LIBERADAS) === '1';
}

/**
 * Grava a posição da chave no navegador.
 * @param {boolean} ligado - Nova posição.
 */
function gravarApenasLiberadas(ligado) {
    localStorage.setItem(CHAVE_APENAS_LIBERADAS, ligado ? '1' : '0');
}

/**
 * Diz se o card da aula está bloqueado na turma atual (qualquer uma das classes de bloqueio).
 * @param {HTMLElement} card - article.aula da grade.
 * @returns {boolean} true se bloqueada.
 */
function aulaBloqueadaNoCard(card) {
    return CLASSES_AULA_BLOQUEADA_LIBERADAS
        .some((classe) => card.classList.contains(classe));
}

/**
 * Esconde (chave ON) os cards de aula bloqueados ou mostra todos (chave OFF).
 */
function aplicarFiltroApenasLiberadas() {
    const ligado = lerApenasLiberadas();
    document.querySelectorAll(SELETOR_CARDS_LIBERADAS).forEach((card) => {
        card.classList.toggle(CLASSE_OCULTA_LIBERADAS, ligado && aulaBloqueadaNoCard(card));
    });
}

/**
 * Liga/desliga a chave: grava a posição e refiltra a grade.
 * @param {HTMLInputElement} campo - Checkbox da chave.
 */
function alternarApenasLiberadas(campo) {
    gravarApenasLiberadas(campo.checked);
    aplicarFiltroApenasLiberadas();
}

/**
 * Monta a barra "Apenas Aulas Liberadas" + chave ON/OFF logo após o resumo do índice
 * (ou antes da grade, se não houver resumo). Reaproveita o visual interruptor-aula.
 * @returns {HTMLElement|null} A barra, ou null se a página não é um índice de atividades.
 */
function montarBarraApenasLiberadas() {
    const grade = document.querySelector(SELETOR_GRADE_LIBERADAS);
    if (!grade || document.querySelector('.' + CLASSE_BARRA_LIBERADAS)) return null;

    const barra = document.createElement('div');
    barra.className = CLASSE_BARRA_LIBERADAS;
    const rotulo = document.createElement('span');
    rotulo.className = CLASSE_BARRA_LIBERADAS + '__rotulo';
    rotulo.textContent = ROTULO_APENAS_LIBERADAS;
    const chave = document.createElement('label');
    chave.className = CLASSE_CHAVE_LIBERADAS;
    const campo = document.createElement('input');
    campo.type = 'checkbox';
    campo.checked = lerApenasLiberadas();
    campo.addEventListener('change', () => alternarApenasLiberadas(campo));
    const trilho = document.createElement('span');
    trilho.className = CLASSE_CHAVE_LIBERADAS + '__chave';
    chave.append(campo, trilho);
    barra.append(rotulo, chave);

    const resumo = document.querySelector(SELETOR_RESUMO_LIBERADAS);
    (resumo || grade).insertAdjacentElement(resumo ? 'afterend' : 'beforebegin', barra);
    return barra;
}

/**
 * Liga a chave na página: monta a barra, filtra e refiltra a cada troca de turma ou
 * refeitura dos cards. O observador cobre montagem assíncrona e mudanças de classe que
 * não passam pelos eventos.
 */
function iniciarApenasLiberadas() {
    if (!montarBarraApenasLiberadas()) return;
    aplicarFiltroApenasLiberadas();
    EVENTOS_REFILTRO_LIBERADAS.forEach((evento) =>
        document.addEventListener(evento, aplicarFiltroApenasLiberadas));
    const grade = document.querySelector(SELETOR_GRADE_LIBERADAS);
    new MutationObserver(aplicarFiltroApenasLiberadas).observe(grade,
        { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

iniciarApenasLiberadas();
