/**
 * progresso-dinamica-pagina.js
 *
 * Mostra o quadro de progresso da turma nas páginas da Atividade Dinâmica,
 * somente para o professor (tarefa PROGRESSO-DINAMICA, 2026-11-09).
 *
 * Depende de (carregados antes por <script> estático):
 *  - nota-dinamica-repositorio.js (ehProfessorDinamica, lerAtividadeDaDinamica)
 *  - progresso-turma-global.js (window.montarProgressoDaTurma)
 */
(function () {
    'use strict';

    const TIPO_PROGRESSO_DINAMICA = 'dinamica';

    /**
     * Monta o quadro de progresso da turma para a dinâmica da página.
     * Não faz nada para o aluno ou quando a dinâmica não está cadastrada.
     * Erros são apenas avisados no console, sem quebrar a página.
     * @returns {Promise<void>}
     */
    async function abrirProgressoDaDinamica() {
        try {
            if (!(await ehProfessorDinamica())) return;

            const atividade = await lerAtividadeDaDinamica();
            if (!atividade) return;

            await window.montarProgressoDaTurma(atividade.id, TIPO_PROGRESSO_DINAMICA);
        } catch (erro) {
            console.warn('Progresso da turma:', erro.message);
        }
    }

    document.addEventListener('DOMContentLoaded', abrirProgressoDaDinamica);
})();
