// Professor: dois botões de TURMA na tela de correção discursiva (bloco "Correção da turma", logo
// acima do "✅ Confirmar Correção" de finalizar-atividade-professor.js). Valem para TODOS os
// alunos da atividade (sem desistentes), não só para o aluno escolhido no combo.
// 1) "Confirmar como certa as meias certa" (CORRECAO-TURMA-DISCURSIVA.1): em cada aluno, na
//    tentativa mais recente, todo tópico RESPONDIDO que está como meia certa (nota do professor,
//    ou a da IA quando o professor ainda não corrigiu, maior que 0 e menor que os pontos) passa a
//    valer certo (nota_professor = pontos do tópico). Grava pelo mesmo upsert da correção manual
//    (correcao_discursiva, chave aluno/atividade/tentativa/item/tópico), uma chamada por aluno,
//    com a justificativa que o banco exige para mudar nota já confirmada. Certas, erradas e em
//    branco não mudam. Aluno com nota já gravada (tópicos travados) é PULADO e listado.
// 2) "Confirmar todas as correções" (CORRECAO-TURMA-DISCURSIVA.2): chama a RPC
//    recalcular_notas_gravadas_discursiva, que recalcula e regrava a nota de todos os alunos
//    entregues com a quantidade de questões de cada um (questoes_para_nota). Migração:
//    database/2026-11-11-recalcular-notas-gravadas-discursiva.sql (o professor aplica).
// Carregado por finalizar-atividade-professor.js. Depende de js/supabase.js, assets/js/popup.js.

const CLASSE_CORRECAO_TURMA = 'correcao-turma';
const TABELA_CORRECAO_TURMA = 'correcao_discursiva';
const CHAVE_CORRECAO_TURMA = 'aluno_id,atividade_id,tentativa,item,topico';
const RPC_RECALCULAR_TURMA = 'recalcular_notas_gravadas_discursiva';
const LINHAS_POR_PAGINA_TURMA = 1000;
const TAMANHO_LOTE_NOMES_TURMA = 50;
const TOLERANCIA_TURMA = 0.001;
const TEXTOS_CORRECAO_TURMA = {
    titulo: 'Correção da turma',
    explicacao: 'Estes botões valem para TODOS os alunos da atividade, não só para o aluno ' +
        'escolhido.',
    botaoMeias: 'Confirmar como certa as meias certa',
    botaoRecalcular: 'Confirmar todas as correções',
    lendo: '⏳ Lendo a turma...',
    tituloMeias: 'Meias certas → certas',
    tituloRecalcular: 'Confirmar todas as correções',
    nadaMeias: 'Nenhum aluno tem meia certa para converter.',
    justificativa: 'Meia certa confirmada como certa pelo botão da turma em ',
    motivoTravado: 'nota já gravada (tópicos travados)',
    confirmarRecalcular: 'Recalcular e regravar a nota de TODOS os alunos entregues desta ' +
        'atividade, com a quantidade de questões de cada um e as notas dos tópicos (certa, meia ' +
        'certa, errada)? Inclusive as notas já gravadas; a nota antiga fica no histórico.',
    semRpc: 'A função do banco ainda não foi aplicada. Rode no SQL Editor o arquivo ' +
        'database/2026-11-11-recalcular-notas-gravadas-discursiva.sql.',
};
const SITUACOES_RECALCULO_TURMA = {
    recalculada: 'recalculada', gravada: 'gravada agora', igual: 'sem mudança',
    correcao_incompleta: 'correção incompleta (não gravada)', outro_tipo: 'outro tipo de nota',
};

/**
 * Lê todas as linhas de uma tabela da atividade, de página em página.
 * @param {string} tabela - Tabela.
 * @param {string} colunas - Colunas do select.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Object[]>} Linhas.
 * @throws {Error} Se o banco recusar.
 */
async function lerTodasLinhasTurma(tabela, colunas, atividadeId) {
    const linhas = [];
    for (let inicio = 0; ; inicio += LINHAS_POR_PAGINA_TURMA) {
        const { data, error } = await obterClienteSupabase().from(tabela).select(colunas)
            .eq('atividade_id', atividadeId).order('aluno_id').order('tentativa')
            .order('item').order('topico')
            .range(inicio, inicio + LINHAS_POR_PAGINA_TURMA - 1);
        if (error) throw new Error(error.message);
        linhas.push(...data);
        if (data.length < LINHAS_POR_PAGINA_TURMA) return linhas;
    }
}

/**
 * Lê o que o botão das meias certas precisa: tópicos, respostas, correções e notas gravadas.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Object>} {topicos, respostas, correcoes, gravadas}.
 * @throws {Error} Se o banco recusar.
 */
async function lerDadosMeiasTurma(atividadeId) {
    const [topicos, respostas, correcoes, gravadas] = await Promise.all([
        sbGet('topico_discursivo', 'select=item,topico,pontos&atividade_id=eq.' + atividadeId),
        lerTodasLinhasTurma('resposta_discursiva', 'aluno_id,tentativa,item,topico,texto',
            atividadeId),
        lerTodasLinhasTurma(TABELA_CORRECAO_TURMA,
            'aluno_id,tentativa,item,topico,nota_ia,nota_professor', atividadeId),
        sbGet('nota_gravada', 'select=aluno_id,tentativa&atividade_id=eq.' + atividadeId),
    ]);
    return { topicos, respostas, correcoes, gravadas };
}

/**
 * Nota que vale hoje no tópico: a do professor; sem ela, a da IA.
 * @param {Object|undefined} correcao - Linha de correcao_discursiva.
 * @returns {number|null} Nota, ou null sem nenhuma.
 */
function notaAtualDoTopicoTurma(correcao) {
    const temProfessor = correcao && correcao.nota_professor !== null &&
        correcao.nota_professor !== undefined;
    if (temProfessor) return Number(correcao.nota_professor);
    const temIa = correcao && correcao.nota_ia !== null && correcao.nota_ia !== undefined;
    return temIa ? Number(correcao.nota_ia) : null;
}

/**
 * Diz se a nota é meia certa: maior que zero e menor que os pontos do tópico.
 * @param {number|null} nota - Nota atual.
 * @param {number} pontos - Pontos do tópico.
 * @returns {boolean} true se meia certa.
 */
function ehMeiaCertaTurma(nota, pontos) {
    return nota !== null && pontos > 0 && nota > TOLERANCIA_TURMA &&
        nota < pontos - TOLERANCIA_TURMA;
}

/**
 * Tentativa mais recente de cada aluno (pelas respostas).
 * @param {Object[]} respostas - Linhas de resposta_discursiva.
 * @returns {Map<string, number>} Aluno → tentativa.
 */
function tentativaAtualPorAlunoTurma(respostas) {
    const tentativas = new Map();
    respostas.forEach((linha) => {
        const atual = tentativas.get(linha.aluno_id);
        if (atual === undefined || linha.tentativa > atual) {
            tentativas.set(linha.aluno_id, linha.tentativa);
        }
    });
    return tentativas;
}

/**
 * Monta as linhas a gravar de um aluno (só as meias certas respondidas da tentativa atual).
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno e tentativa.
 * @param {Object} dados - Resultado de lerDadosMeiasTurma.
 * @param {{atividadeId: number, pontos: Map, correcoes: Map, justificativa: string}} base - Mapas
 *     prontos e a justificativa.
 * @returns {Object[]} Linhas de correcao_discursiva.
 */
function linhasMeiasDoAlunoTurma(aluno, dados, base) {
    const chave = (linha) => linha.aluno_id + '|' + linha.tentativa + '|' + linha.item + '|' +
        linha.topico;
    return dados.respostas.filter((linha) => linha.aluno_id === aluno.alunoId &&
        linha.tentativa === aluno.tentativa && (linha.texto || '').trim())
        .map((linha) => ({ linha, pontos: base.pontos.get(linha.item + '|' + linha.topico) || 0,
            nota: notaAtualDoTopicoTurma(base.correcoes.get(chave(linha))) }))
        .filter(({ nota, pontos }) => ehMeiaCertaTurma(nota, pontos))
        .map(({ linha, pontos }) => ({ aluno_id: aluno.alunoId, atividade_id: base.atividadeId,
            tentativa: aluno.tentativa, item: linha.item, topico: linha.topico,
            nota_professor: pontos, justificativa_mudanca: base.justificativa }));
}

/**
 * Planeja o botão das meias certas: alunos a gravar e alunos travados (nota já gravada).
 * @param {Object} dados - Resultado de lerDadosMeiasTurma.
 * @param {number} atividadeId - Id da atividade.
 * @returns {{aGravar: Object[], travados: Object[]}} Plano (só alunos com meia certa).
 */
function planejarMeiasTurma(dados, atividadeId) {
    const base = { atividadeId,
        justificativa: TEXTOS_CORRECAO_TURMA.justificativa + new Date().toISOString(),
        pontos: new Map(dados.topicos.map((t) => [t.item + '|' + t.topico, Number(t.pontos)])),
        correcoes: new Map(dados.correcoes.map((c) => [c.aluno_id + '|' + c.tentativa + '|' +
            c.item + '|' + c.topico, c])) };
    const gravadas = new Set(dados.gravadas.map((g) => g.aluno_id + '|' + g.tentativa));
    const plano = { aGravar: [], travados: [] };
    tentativaAtualPorAlunoTurma(dados.respostas).forEach((tentativa, alunoId) => {
        const aluno = { alunoId, tentativa };
        const linhas = linhasMeiasDoAlunoTurma(aluno, dados, base);
        if (!linhas.length) return;
        if (gravadas.has(alunoId + '|' + tentativa)) plano.travados.push({ ...aluno, linhas });
        else plano.aGravar.push({ ...aluno, linhas });
    });
    return plano;
}

/**
 * Tira os desistentes do plano e põe o nome de cada aluno.
 * @param {{aGravar: Object[], travados: Object[]}} plano - Plano.
 * @returns {Promise<{aGravar: Object[], travados: Object[]}>} Plano só com alunos ativos.
 * @throws {Error} Se o banco recusar.
 */
async function completarPlanoTurma(plano) {
    const todos = [...plano.aGravar, ...plano.travados];
    const ids = [...new Set(todos.map((aluno) => aluno.alunoId))];
    const ativos = new Set((await filtrarDesistentes(ids.map((id) => ({ aluno_id: id }))))
        .map((linha) => linha.aluno_id));
    const nomes = new Map();
    for (let i = 0; i < ids.length; i += TAMANHO_LOTE_NOMES_TURMA) {
        const lote = ids.slice(i, i + TAMANHO_LOTE_NOMES_TURMA);
        (await sbGet('aluno', 'select=id,nome&id=in.(' + lote.join(',') + ')'))
            .forEach((linha) => nomes.set(linha.id, linha.nome));
    }
    const completar = (lista) => lista.filter((aluno) => ativos.has(aluno.alunoId))
        .map((aluno) => ({ ...aluno, nome: nomes.get(aluno.alunoId) || aluno.alunoId }));
    return { aGravar: completar(plano.aGravar), travados: completar(plano.travados) };
}

/**
 * Texto do confirm das meias certas.
 * @param {{aGravar: Object[], travados: Object[]}} plano - Plano completo.
 * @returns {string} Mensagem.
 */
function textoConfirmarMeiasTurma(plano) {
    const topicos = plano.aGravar.reduce((soma, aluno) => soma + aluno.linhas.length, 0);
    const pulados = plano.travados.length ? '\n\nSerão pulados ' + plano.travados.length +
        ' aluno(s) com nota já gravada (tópicos travados): ' +
        plano.travados.map((aluno) => aluno.nome).join(', ') + '.' : '';
    return plano.aGravar.length + ' aluno(s) e ' + topicos + ' tópico(s) meia certa vão ' +
        'passar a valer certo (nota cheia). Certas, erradas e em branco não mudam.' + pulados +
        '\n\nConfirmar?';
}

/**
 * Grava as meias certas aluno a aluno (uma chamada por aluno; a falha de um não para os outros).
 * @param {Object[]} aGravar - Alunos com as linhas.
 * @returns {Promise<{gravados: Object[], falhas: Object[]}>} Resultado.
 */
async function gravarMeiasTurma(aGravar) {
    const resultado = { gravados: [], falhas: [] };
    for (const aluno of aGravar) {
        const { error } = await obterClienteSupabase().from(TABELA_CORRECAO_TURMA)
            .upsert(aluno.linhas, { onConflict: CHAVE_CORRECAO_TURMA });
        if (error) resultado.falhas.push({ ...aluno, motivo: error.message });
        else resultado.gravados.push(aluno);
    }
    return resultado;
}

/**
 * Mostra o resumo do botão das meias certas.
 * @param {{gravados: Object[], falhas: Object[]}} resultado - Gravação.
 * @param {Object[]} travados - Alunos pulados.
 */
async function mostrarResultadoMeiasTurma(resultado, travados) {
    const topicos = resultado.gravados.reduce((soma, aluno) => soma + aluno.linhas.length, 0);
    const linhas = ['✅ ' + resultado.gravados.length + ' aluno(s), ' + topicos +
        ' tópico(s) convertidos em certa.'];
    if (travados.length) {
        linhas.push('⏭️ Pulados (' + TEXTOS_CORRECAO_TURMA.motivoTravado + '): ' +
            travados.map((aluno) => aluno.nome).join(', ') + '.');
    }
    resultado.falhas.forEach((aluno) => linhas.push('❌ ' + aluno.nome + ': ' + aluno.motivo));
    linhas.push('Quem ainda não tem a correção confirmada: clique em Confirmar Correção.');
    await mostrarPopup(linhas.join('\n'), { tipo: resultado.falhas.length ? 'aviso' : 'sucesso',
        titulo: TEXTOS_CORRECAO_TURMA.tituloMeias });
}

/**
 * Fluxo do botão "Confirmar como certa as meias certa".
 * @param {{atividadeId: number}} contexto - Atividade.
 * @returns {Promise<boolean>} true se gravou algo.
 */
async function executarMeiasTurma(contexto) {
    const dados = await lerDadosMeiasTurma(contexto.atividadeId);
    const plano = await completarPlanoTurma(planejarMeiasTurma(dados, contexto.atividadeId));
    if (!plano.aGravar.length) {
        const pulados = plano.travados.length ? ' Pulados (' +
            TEXTOS_CORRECAO_TURMA.motivoTravado + '): ' +
            plano.travados.map((aluno) => aluno.nome).join(', ') + '.' : '';
        await mostrarPopup(TEXTOS_CORRECAO_TURMA.nadaMeias + pulados,
            { tipo: 'aviso', titulo: TEXTOS_CORRECAO_TURMA.tituloMeias });
        return false;
    }
    const aceitou = await confirmarPopup(textoConfirmarMeiasTurma(plano),
        { titulo: TEXTOS_CORRECAO_TURMA.tituloMeias, textoConfirmar: 'Confirmar' });
    if (!aceitou) return false;
    const resultado = await gravarMeiasTurma(plano.aGravar);
    await mostrarResultadoMeiasTurma(resultado, plano.travados);
    return resultado.gravados.length > 0;
}

/**
 * Formata uma nota com duas casas (ou "—").
 * @param {number|null} nota - Nota.
 * @returns {string} Texto.
 */
function formatarNotaTurma(nota) {
    if (nota === null || nota === undefined) return '—';
    return Number(nota).toLocaleString('pt-BR',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Mostra o resumo do recálculo: quantos alunos e quais notas mudaram.
 * @param {Object[]} linhas - Retorno da RPC.
 */
async function mostrarResultadoRecalculoTurma(linhas) {
    const mudaram = linhas.filter((l) => l.situacao === 'recalculada' || l.situacao === 'gravada');
    const contagem = {};
    linhas.forEach((l) => { contagem[l.situacao] = (contagem[l.situacao] || 0) + 1; });
    const resumo = Object.entries(contagem).map(([situacao, total]) =>
        total + ' ' + (SITUACOES_RECALCULO_TURMA[situacao] || situacao)).join(' · ');
    const detalhes = mudaram.map((l) => '• ' + (l.nome || l.aluno_id) + ': ' +
        formatarNotaTurma(l.nota_antiga) + ' → ' + formatarNotaTurma(l.nota_nova) +
        ' (questões na nota: ' + (l.quantidade_antiga ?? '—') + ' → ' + l.quantidade_nova + ')');
    const texto = linhas.length + ' aluno(s) recalculados: ' + resumo + '.' +
        (detalhes.length ? '\n\nNotas que mudaram:\n' + detalhes.join('\n') : '');
    await mostrarPopup(texto, { tipo: 'sucesso', titulo: TEXTOS_CORRECAO_TURMA.tituloRecalcular });
}

/**
 * Fluxo do botão "Confirmar todas as correções" (RPC do banco).
 * @param {{atividadeId: number}} contexto - Atividade.
 * @returns {Promise<boolean>} true se a RPC rodou.
 */
async function executarRecalculoTurma(contexto) {
    const aceitou = await confirmarPopup(TEXTOS_CORRECAO_TURMA.confirmarRecalcular,
        { titulo: TEXTOS_CORRECAO_TURMA.tituloRecalcular, textoConfirmar: 'Recalcular' });
    if (!aceitou) return false;
    const { data, error } = await obterClienteSupabase()
        .rpc(RPC_RECALCULAR_TURMA, { p_atividade: contexto.atividadeId });
    if (error) {
        const semFuncao = error.code === 'PGRST202' || /Could not find the function/i
            .test(error.message || '');
        throw new Error(semFuncao ? TEXTOS_CORRECAO_TURMA.semRpc : error.message);
    }
    await mostrarResultadoRecalculoTurma(data || []);
    return true;
}

/**
 * Roda um fluxo com o botão desligado; no fim, atualiza a tela do aluno escolhido.
 * @param {HTMLButtonElement} botao - Botão clicado.
 * @param {{fluxo: Function, titulo: string, contexto: Object}} acao - Fluxo e contexto.
 */
async function rodarAcaoTurma(botao, acao) {
    const rotulo = botao.textContent;
    botao.disabled = true;
    botao.textContent = TEXTOS_CORRECAO_TURMA.lendo;
    try {
        const mudou = await acao.fluxo(acao.contexto);
        if (mudou) await acao.contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup('Não foi possível concluir: ' + erro.message,
            { tipo: 'erro', titulo: acao.titulo });
    } finally {
        botao.disabled = false;
        botao.textContent = rotulo;
    }
}

/**
 * Cria um botão do bloco da turma.
 * @param {string} texto - Rótulo.
 * @param {Function} aoClicar - Ação.
 * @returns {HTMLButtonElement} Botão.
 */
function criarBotaoTurma(texto, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_CORRECAO_TURMA + '__botao';
    botao.textContent = texto;
    botao.addEventListener('click', () => aoClicar(botao));
    return botao;
}

/**
 * Põe o bloco "Correção da turma" antes do elemento indicado (troca o anterior, se houver).
 * @param {{atividadeId: number, antesDe: HTMLElement, aoMudar: Function}} contexto - Atividade,
 *     onde pôr e o que fazer depois de gravar (atualizar a tela do aluno escolhido).
 */
function mostrarCorrecaoTurma(contexto) {
    document.querySelectorAll('.' + CLASSE_CORRECAO_TURMA).forEach((bloco) => bloco.remove());
    if (!contexto.atividadeId || !contexto.antesDe?.parentNode) return;
    const bloco = document.createElement('section');
    bloco.className = 'aula-card ' + CLASSE_CORRECAO_TURMA;
    const titulo = document.createElement('h3');
    titulo.textContent = TEXTOS_CORRECAO_TURMA.titulo;
    const explicacao = document.createElement('p');
    explicacao.className = CLASSE_CORRECAO_TURMA + '__explicacao';
    explicacao.textContent = TEXTOS_CORRECAO_TURMA.explicacao;
    const botoes = document.createElement('div');
    botoes.className = CLASSE_CORRECAO_TURMA + '__botoes';
    botoes.append(
        criarBotaoTurma(TEXTOS_CORRECAO_TURMA.botaoMeias, (botao) => rodarAcaoTurma(botao,
            { fluxo: executarMeiasTurma, titulo: TEXTOS_CORRECAO_TURMA.tituloMeias, contexto })),
        criarBotaoTurma(TEXTOS_CORRECAO_TURMA.botaoRecalcular, (botao) => rodarAcaoTurma(botao,
            { fluxo: executarRecalculoTurma, titulo: TEXTOS_CORRECAO_TURMA.tituloRecalcular,
                contexto })));
    bloco.append(titulo, explicacao, botoes);
    contexto.antesDe.parentNode.insertBefore(bloco, contexto.antesDe);
}

window.mostrarCorrecaoTurma = mostrarCorrecaoTurma;
