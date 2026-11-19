// Card "Notas e média" (só PROFESSOR): botão "👁 Ver" ao lado do número nas colunas "Tarefas OK"
// e "Tarefas Pendentes" (tarefa NOTAS-LISTA-ALUNOS-TAREFAS, pedido do usuário em 2026-11-09).
// O de Tarefas OK lista quem entregou a atividade; o de Tarefas Pendentes, quem ainda não
// entregou (não fez ou está fazendo). As listas usam EXATAMENTE os ids da contagem
// (contarAtividadeTarefas em card-notas-tarefas-turma.js: okIds e pendentesIds), então valem as
// mesmas regras: só alunos ativos da turma (sem desistentes) e sem quem faltou. Nenhuma consulta
// extra: os nomes vêm dos alunos já carregados no card. Ordem: nome (pt-BR).
// Abre no popup reutilizável (popup.js, carregado pelo garantirPopupCrud de
// atividades-crud-modal.js se ainda não estiver na página). Sem alunos: "Nenhum aluno".

const CLASSE_BOTAO_VER_TAREFAS = 'card-notas-media__ver-botao btn';
const ROTULO_BOTAO_VER_TAREFAS = '👁 Ver';
const MSG_NENHUM_ALUNO_TAREFAS = 'Nenhum aluno';
const GRUPOS_LISTA_TAREFAS = {
    ok: { campo: 'okIds', titulo: 'Tarefas OK', dica: 'Ver quem entregou esta atividade' },
    pendentes: { campo: 'pendentesIds', titulo: 'Tarefas Pendentes',
        dica: 'Ver quem ainda não entregou (não fez ou está fazendo)' },
};

/**
 * Nomes dos alunos de uma lista de ids, em ordem alfabética.
 * @param {string[]} ids - Ids da contagem (okIds ou pendentesIds).
 * @param {Object[]} alunos - Alunos carregados no card (id, nome).
 * @returns {string[]} Nomes ordenados.
 */
function nomesDosAlunosTarefas(ids, alunos) {
    const porId = new Map(alunos.map((aluno) => [String(aluno.id), aluno.nome || '']));
    return ids.map((id) => porId.get(String(id)) || '')
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Texto do popup: um aluno por linha, numerado; sem alunos, "Nenhum aluno".
 * @param {string[]} nomes - Nomes ordenados.
 * @returns {string} Texto com quebras de linha.
 */
function textoListaAlunosTarefas(nomes) {
    if (!nomes.length) return MSG_NENHUM_ALUNO_TAREFAS;

    return nomes.map((nome, indice) => (indice + 1) + '. ' + nome).join('\n');
}

/**
 * Abre o popup com a lista de um grupo (OK ou Pendentes) da atividade.
 * @param {string} grupo - "ok" ou "pendentes".
 * @param {Object} contagem - Contagem da atividade (okIds, pendentesIds).
 * @param {{atividade: string, turma: string, alunos: Object[]}} contexto - Nomes e alunos.
 */
async function abrirListaAlunosTarefas(grupo, contagem, contexto) {
    const dados = GRUPOS_LISTA_TAREFAS[grupo];
    if (typeof mostrarPopup !== 'function' && typeof garantirPopupCrud === 'function') {
        await garantirPopupCrud();
    }
    if (typeof mostrarPopup !== 'function') {
        console.warn('Lista de alunos indisponível: popup.js não carregou.');
        return;
    }
    const nomes = nomesDosAlunosTarefas(contagem[dados.campo] || [], contexto.alunos || []);
    const titulo = dados.titulo + ' (' + nomes.length + ') — ' + contexto.atividade + ' — ' +
        contexto.turma;
    await mostrarPopup(textoListaAlunosTarefas(nomes), { tipo: 'info', titulo });
}

/**
 * Botão "👁 Ver" de um grupo; sem contagem (ou sem a lista de ids), fica desabilitado.
 * @param {string} grupo - "ok" ou "pendentes".
 * @param {Object|undefined} contagem - Contagem da atividade.
 * @param {Object} contexto - Nomes da atividade e da turma e os alunos do card.
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoVerTarefas(grupo, contagem, contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_VER_TAREFAS;
    botao.textContent = ROTULO_BOTAO_VER_TAREFAS;
    botao.title = GRUPOS_LISTA_TAREFAS[grupo].dica;
    botao.disabled = !contagem || !Array.isArray(contagem[GRUPOS_LISTA_TAREFAS[grupo].campo]);
    botao.addEventListener('click', () => abrirListaAlunosTarefas(grupo, contagem, contexto));
    return botao;
}

/**
 * Põe o botão "👁 Ver" ao lado do número nas células Tarefas OK e Tarefas Pendentes.
 * @param {HTMLTableCellElement[]} celulas - As duas células (OK, Pendentes), nessa ordem.
 * @param {Object|undefined} contagem - Contagem da atividade.
 * @param {Object} contexto - Nomes da atividade e da turma e os alunos do card.
 */
function ligarListaAlunosTarefas(celulas, contagem, contexto) {
    ['ok', 'pendentes'].forEach((grupo, indice) => {
        if (celulas[indice]) celulas[indice].append(criarBotaoVerTarefas(grupo, contagem, contexto));
    });
}
