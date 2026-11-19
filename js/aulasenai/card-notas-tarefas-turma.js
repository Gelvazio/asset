// Card "Notas e média" (só PROFESSOR): colunas "Tarefas OK" e "Tarefas Pendentes" por atividade,
// contadas na turma do combo TURMA (tarefa NOTAS-TAREFAS-OK-PENDENTES, pedido do usuário em
// 2026-11-09). Formato "entregues/total", ex.: "5/23" e "18/23".
// REGRA (o mesmo total nas duas colunas):
// - Turma = alunos do combo ALUNO: helper único alunosAtivosDaTurma (js/supabase.js), vínculo
//   turmaaluno da turma com desistente = false. Desistente nunca entra (nem no total nem no OK),
//   mesmo que tenha entregue antes de desistir (NOTAS-SEM-DESISTENTES).
// - Faltou = (a) falta_aluno no dia da atividade (atividade.data_atividade, senão
//   aulas.data_planejada, o mesmo dia do "Faltou?" do Progresso) ou (b) linha em
//   falta_entrega_atividade na tentativa atual (entrega "como está" com a observação amarela).
//   Quem faltou SAI do total e nunca conta como OK, mesmo com a entrega feita pela falta.
// - Total = alunos da turma - alunos que faltaram naquela atividade.
// - OK = alunos do total com a tentativa atual ENTREGUE: linha em entrega_atividade na tentativa
//   atual (maior tentativa liberada em liberacao_atividade, senão 1) ou, na Atividade Dinâmica,
//   entrega_dinamica.entregue = true. Em andamento ou só com respostas = pendente.
// - Pendentes = total - OK (não fizeram ou ainda estão fazendo).
// Leituras: um lote fixo por turma (6 consultas paginadas, nunca uma por atividade), com o JWT
// do professor (RLS: professor_pode_ver_aluno). Sem gabarito: só ids, tentativas e datas.
// Se falta_entrega_atividade ainda não existir no banco (migration 2026-11-09 não aplicada), a
// leitura falha em silêncio e só a falta por dia (falta_aluno) é descontada.
// Depende de js/supabase.js (sbGet).

const TAMANHO_PAGINA_TAREFAS = 1000;
const TABELA_ATIVIDADE_TAREFAS = 'atividade';
const TABELA_FALTA_DIA_TAREFAS = 'falta_aluno';
const TABELA_FALTA_ENTREGA_TAREFAS = 'falta_entrega_atividade';
const TABELA_ENTREGA_TAREFAS = 'entrega_atividade';
const TABELA_LIBERACAO_TAREFAS = 'liberacao_atividade';
const TABELA_DINAMICA_TAREFAS = 'entrega_dinamica';
const CLASSE_CELULA_TAREFAS = 'card-notas-media__tarefas';
const TENTATIVA_PADRAO_TAREFAS = 1;
const SEPARADOR_CHAVE_TAREFAS = '|';
const TEXTO_SEM_CONTAGEM_TAREFAS = '—';
const AVISO_SEM_FALTA_ENTREGA_TAREFAS = 'Tarefas OK/Pendentes: falta_entrega_atividade ' +
    'indisponível; só a falta do dia (falta_aluno) foi descontada.';

/**
 * Lê todas as linhas de uma consulta, de página em página (o banco devolve no máximo 1000).
 * @param {string} tabela - Nome da tabela.
 * @param {string} consulta - Query string sem limit/offset.
 * @returns {Promise<Object[]>} Todas as linhas.
 * @throws {Error} Se o banco responder com erro.
 */
async function lerTodasAsLinhasTarefas(tabela, consulta) {
    const linhas = [];
    for (let inicio = 0; ; inicio += TAMANHO_PAGINA_TAREFAS) {
        const pagina = await sbGet(tabela, consulta + '&limit=' + TAMANHO_PAGINA_TAREFAS +
            '&offset=' + inicio);
        linhas.push(...pagina);
        if (pagina.length < TAMANHO_PAGINA_TAREFAS) return linhas;
    }
}

/**
 * Chave "aluno|atividade" usada nos mapas da contagem.
 * @param {string} alunoId - Id do aluno.
 * @param {number|string} atividadeId - Id da atividade.
 * @returns {string} Chave.
 */
function chaveTarefas(alunoId, atividadeId) {
    return String(alunoId) + SEPARADOR_CHAVE_TAREFAS + String(atividadeId);
}

/**
 * Dia de cada atividade (data_atividade, senão a data planejada da aula), como no "Faltou?".
 * @param {number[]} atividadeIds - Ids das atividades.
 * @returns {Promise<Map<number, string>>} Dia AAAA-MM-DD por atividade (sem dia, fica fora).
 */
async function lerDiasDasAtividadesTarefas(atividadeIds) {
    const linhas = await lerTodasAsLinhasTarefas(TABELA_ATIVIDADE_TAREFAS,
        'select=id,data_atividade,aulas(data_planejada)&id=in.(' + atividadeIds.join(',') + ')');
    const dias = new Map();
    linhas.forEach((linha) => {
        const dia = linha.data_atividade || linha.aulas?.data_planejada || null;
        if (dia) dias.set(Number(linha.id), String(dia).slice(0, 10));
    });
    return dias;
}

/**
 * Faltas por dia dos alunos da turma nos dias das atividades.
 * @param {string} filtroAlunos - Filtro "aluno_id=in.(...)".
 * @param {Map<number, string>} dias - Dia por atividade.
 * @returns {Promise<Set<string>>} Chaves "aluno|dia" com falta.
 */
async function lerFaltasPorDiaTarefas(filtroAlunos, dias) {
    const unicos = [...new Set(dias.values())];
    if (!unicos.length) return new Set();

    const linhas = await lerTodasAsLinhasTarefas(TABELA_FALTA_DIA_TAREFAS,
        'select=aluno_id,data&' + filtroAlunos + '&data=in.(' + unicos.join(',') + ')');
    return new Set(linhas.map((linha) =>
        String(linha.aluno_id) + SEPARADOR_CHAVE_TAREFAS + String(linha.data).slice(0, 10)));
}

/**
 * Lê a falta registrada como entrega (migration 2026-11-09); sem a tabela, devolve null.
 * @param {string} filtro - Filtro de alunos e atividades.
 * @returns {Promise<Object[]|null>} Linhas (aluno_id, atividade_id, tentativa) ou null.
 */
async function lerFaltaEntregaTarefas(filtro) {
    try {
        return await lerTodasAsLinhasTarefas(TABELA_FALTA_ENTREGA_TAREFAS,
            'select=aluno_id,atividade_id,tentativa&' + filtro);
    } catch (erro) {
        console.warn(AVISO_SEM_FALTA_ENTREGA_TAREFAS, erro.message);
        return null;
    }
}

/**
 * Lê, num lote só para a turma, entregas, tentativas liberadas, dinâmicas e faltas.
 * @param {string[]} alunoIds - Ids dos alunos da turma.
 * @param {number[]} atividadeIds - Ids das atividades do índice.
 * @returns {Promise<Object>} Linhas brutas de cada tabela.
 * @throws {Error} Se a leitura das entregas ou das tentativas falhar.
 */
async function lerDadosDaTurmaTarefas(alunoIds, atividadeIds) {
    const filtroAlunos = 'aluno_id=in.(' + alunoIds.join(',') + ')';
    const filtro = filtroAlunos + '&atividade_id=in.(' + atividadeIds.join(',') + ')';
    const leituraDias = lerDiasDasAtividadesTarefas(atividadeIds);
    const [entregas, liberacoes, dinamicas, faltaEntrega, dias] = await Promise.all([
        lerTodasAsLinhasTarefas(TABELA_ENTREGA_TAREFAS,
            'select=aluno_id,atividade_id,tentativa&' + filtro),
        lerTodasAsLinhasTarefas(TABELA_LIBERACAO_TAREFAS,
            'select=aluno_id,atividade_id,tentativa&' + filtro),
        lerTodasAsLinhasTarefas(TABELA_DINAMICA_TAREFAS,
            'select=aluno_id,atividade_id&' + filtro + '&entregue=is.true').catch(() => []),
        lerFaltaEntregaTarefas(filtro),
        leituraDias,
    ]);
    const faltasDia = await lerFaltasPorDiaTarefas(filtroAlunos, dias);
    return { entregas, liberacoes, dinamicas, faltaEntrega, dias, faltasDia };
}

/**
 * Tentativa atual de cada aluno x atividade: a maior liberada (sem liberação, a 1).
 * @param {Object[]} liberacoes - Linhas de liberacao_atividade.
 * @returns {Map<string, number>} Tentativa por chave "aluno|atividade".
 */
function mapearTentativasTarefas(liberacoes) {
    const tentativas = new Map();
    liberacoes.forEach((linha) => {
        const chave = chaveTarefas(linha.aluno_id, linha.atividade_id);
        tentativas.set(chave, Math.max(tentativas.get(chave) || 0, Number(linha.tentativa)));
    });
    return tentativas;
}

/**
 * Chaves "aluno|atividade" das linhas que estão na tentativa atual do aluno.
 * @param {Object[]} linhas - Linhas com aluno_id, atividade_id e tentativa.
 * @param {Map<string, number>} tentativas - Tentativa atual por chave.
 * @returns {Set<string>} Chaves na tentativa atual.
 */
function chavesNaTentativaAtualTarefas(linhas, tentativas) {
    const chaves = new Set();
    linhas.forEach((linha) => {
        const chave = chaveTarefas(linha.aluno_id, linha.atividade_id);
        const atual = tentativas.get(chave) || TENTATIVA_PADRAO_TAREFAS;
        if (Number(linha.tentativa) === atual) chaves.add(chave);
    });
    return chaves;
}

/**
 * Conta OK e total de uma atividade, tirando do total quem faltou.
 * @param {number} atividadeId - Id da atividade.
 * @param {string[]} alunoIds - Ids dos alunos da turma.
 * @param {{entregues: Set<string>, faltou: Function}} regras - Entregues e teste de falta.
 * @returns {{ok: number, total: number, okIds: string[], pendentesIds: string[]}} Contagem e
 *     os ids de cada grupo (os mesmos alunos da lista do botão "Ver").
 */
function contarAtividadeTarefas(atividadeId, alunoIds, regras) {
    const okIds = [];
    const pendentesIds = [];
    alunoIds.forEach((alunoId) => {
        if (regras.faltou(alunoId, atividadeId)) return;
        const entregou = regras.entregues.has(chaveTarefas(alunoId, atividadeId));
        (entregou ? okIds : pendentesIds).push(String(alunoId));
    });
    const ok = okIds.length;
    return { ok, total: ok + pendentesIds.length, okIds, pendentesIds };
}

/**
 * Monta a função que diz se o aluno faltou na atividade (falta do dia ou entrega por falta).
 * @param {Object} dados - Saída de lerDadosDaTurmaTarefas.
 * @param {Map<string, number>} tentativas - Tentativa atual por chave.
 * @returns {Function} (alunoId, atividadeId) => boolean.
 */
function criarTesteDeFaltaTarefas(dados, tentativas) {
    const porEntrega = chavesNaTentativaAtualTarefas(dados.faltaEntrega || [], tentativas);
    return (alunoId, atividadeId) => {
        const dia = dados.dias.get(Number(atividadeId));
        const faltouNoDia = Boolean(dia) &&
            dados.faltasDia.has(String(alunoId) + SEPARADOR_CHAVE_TAREFAS + dia);
        return faltouNoDia || porEntrega.has(chaveTarefas(alunoId, atividadeId));
    };
}

/**
 * Contagem de Tarefas OK / Pendentes de cada atividade na turma (só professor).
 * @param {string[]} alunoIds - Ids dos alunos da turma (sem desistentes).
 * @param {number[]} atividadeIds - Ids das atividades do índice.
 * @returns {Promise<{porAtividade: Map<number, {ok: number, total: number}>,
 *     semFaltaEntrega: boolean}>} Contagem por atividade e se a falta por entrega ficou de fora.
 * @throws {Error} Se a leitura das entregas ou das tentativas falhar.
 */
async function contarTarefasDaTurma(alunoIds, atividadeIds) {
    const porAtividade = new Map();
    if (!alunoIds.length || !atividadeIds.length) {
        return { porAtividade, semFaltaEntrega: false };
    }
    const dados = await lerDadosDaTurmaTarefas(alunoIds, atividadeIds);
    const tentativas = mapearTentativasTarefas(dados.liberacoes);
    const entregues = chavesNaTentativaAtualTarefas(dados.entregas, tentativas);
    dados.dinamicas.forEach((linha) =>
        entregues.add(chaveTarefas(linha.aluno_id, linha.atividade_id)));
    const regras = { entregues, faltou: criarTesteDeFaltaTarefas(dados, tentativas) };
    atividadeIds.forEach((id) =>
        porAtividade.set(Number(id), contarAtividadeTarefas(id, alunoIds, regras)));
    return { porAtividade, semFaltaEntrega: dados.faltaEntrega === null };
}

/**
 * Textos das colunas "Tarefas OK" e "Tarefas Pendentes" de uma atividade.
 * @param {{ok: number, total: number}|undefined} contagem - Contagem da atividade.
 * @returns {{ok: string, pendentes: string}} Ex.: {ok: "5/23", pendentes: "18/23"}; sem
 *     contagem, "—" nas duas.
 */
function textosTarefasTurma(contagem) {
    if (!contagem) return { ok: TEXTO_SEM_CONTAGEM_TAREFAS, pendentes: TEXTO_SEM_CONTAGEM_TAREFAS };

    const { ok, total } = contagem;
    return { ok: ok + '/' + total, pendentes: (total - ok) + '/' + total };
}

/**
 * Contagem por página do índice para a turma; em falha, mapa vazio (as colunas mostram "—").
 * @param {{id: string}[]} alunos - Alunos da turma (sem desistentes).
 * @param {Map<string, {id: number}>} idsPorPagina - Id da atividade por página.
 * @returns {Promise<Map<string, {ok: number, total: number}>>} Contagem por página.
 */
async function contarTarefasPorPaginaTurma(alunos, idsPorPagina) {
    const porPagina = new Map();
    try {
        const atividadeIds = [...idsPorPagina.values()].map((dados) => dados.id);
        const alunoIds = alunos.map((aluno) => String(aluno.id));
        const { porAtividade } = await contarTarefasDaTurma(alunoIds, atividadeIds);
        idsPorPagina.forEach((dados, pagina) =>
            porPagina.set(pagina, porAtividade.get(Number(dados.id))));
    } catch (erro) {
        console.warn('Tarefas OK/Pendentes indisponíveis:', erro.message);
    }
    return porPagina;
}

/**
 * Células "Tarefas OK" e "Tarefas Pendentes" de uma linha da tabela.
 * @param {{ok: number, total: number}|undefined} contagem - Contagem da atividade.
 * @returns {HTMLTableCellElement[]} As duas células, nessa ordem.
 */
function criarCelulasTarefasTurma(contagem) {
    const textos = textosTarefasTurma(contagem);
    return [textos.ok, textos.pendentes].map((texto) => {
        const celula = document.createElement('td');
        celula.className = CLASSE_CELULA_TAREFAS;
        celula.textContent = texto;
        return celula;
    });
}
