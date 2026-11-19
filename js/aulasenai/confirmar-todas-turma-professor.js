/**
 * Professor: botão "✅ CONFIRMAR TODAS (TURMA)" no painel do Progresso da turma das discursivas
 * (progresso-turma-global.js). Num clique, regera a nota confirmada pelo professor de TODOS os
 * alunos que já entregaram a atividade na turma escolhida, sempre ficando a MAIOR nota:
 * `correcao_discursiva.nota_professor` = MAIOR(nota_ia, nota_professor já gravada); no empate,
 * fica a do professor (nada é gravado).
 * - Entram só os alunos entregues; quem não entregou fica de fora.
 * - Aluno com questão sem nota da IA é PULADO (sem derrubar os outros).
 * - Aluno com suspeita de cópia pendente (90% ou mais) é PULADO.
 * - Só contam as questões que entram na nota do aluno (da 1 até "Quantidade Mínima").
 * - A gravação é por aluno, em lotes pequenos, com upsert na chave
 *   'aluno_id,atividade_id,tentativa,item,topico'; a falha de um não derruba os outros.
 * - Mudar nota já confirmada exige justificativa nova (trigger correcao_discursiva_validar):
 *   cada linha leva justificativa_mudanca com a data/hora da regeração.
 * - Um popup resume o que será gravado antes; no fim, outro popup mostra quantos foram
 *   confirmados e a lista dos pulados com o motivo.
 * Nível turma do "Confirmar Todas" (o nível por aluno fica em confirmar-todas-professor.js, que
 * este arquivo NÃO usa: a leitura e a regra da maior nota são próprias).
 * Tarefa CONFIRMAR-TODAS-MAIOR-NOTA.2, pedido do usuário em 2026-11-09.
 * Depende de js/supabase.js e assets/js/popup.js. Regra: docs/regras/atividades.md
 */

const TABELA_CORRECAO_TURMA_PROFESSOR = 'correcao_discursiva';
const TABELA_TOPICOS_TURMA_PROFESSOR = 'topico_discursivo';
const TABELA_SUSPEITA_TURMA_PROFESSOR = 'suspeita_copia_discursiva';
const CHAVE_CORRECAO_TURMA_PROFESSOR = 'aluno_id,atividade_id,tentativa,item,topico';
const SEMELHANCA_MINIMA_TURMA_PROFESSOR = 0.9;
const CLASSE_BOTAO_TURMA_PROFESSOR = 'progresso-turma__confirmar-toda-correcao-ia';
const CLASSE_EXTRA_BOTAO_TURMA_PROFESSOR = 'progresso-turma__confirmar-todas-turma';
const TEXTO_BOTAO_TURMA_PROFESSOR = '✅ CONFIRMAR TODAS (TURMA)';
const DICA_BOTAO_TURMA_PROFESSOR = 'Regera a nota do professor de todos os alunos entregues da ' +
    'turma, ficando sempre a MAIOR nota (da IA ou a já confirmada).';
const TITULO_TURMA_PROFESSOR = 'Confirmar Todas (turma)';
const TEXTO_CONFIRMAR_POPUP_TURMA_PROFESSOR = 'Confirmar a turma';
const TEXTO_LENDO_TURMA_PROFESSOR = '⏳ Lendo a turma...';
const MSG_SEM_ALUNOS_TURMA_PROFESSOR = 'Nenhum aluno da turma entregou a atividade ainda.';
const MSG_NADA_TURMA_PROFESSOR = 'Nenhum aluno tem nota a regerar agora: todos já estão com a ' +
    'maior nota, ou ficaram de fora.';
const MSG_REGRA_TURMA_PROFESSOR = 'Em cada questão fica a MAIOR nota entre a da IA e a já ' +
    'confirmada pelo professor; no empate, fica a do professor.';
const MOTIVO_SEM_NOTA_TURMA_PROFESSOR = 'questão sem nota da IA';
const MOTIVO_SUSPEITA_TURMA_PROFESSOR = 'suspeita de cópia pendente';
const MOTIVO_NADA_TURMA_PROFESSOR = 'já está com a maior nota';
const MOTIVO_FALHA_TURMA_PROFESSOR = 'não foi possível ler';
const SITUACAO_GRAVAR_TURMA_PROFESSOR = 'gravar';
const SITUACAO_SEM_NOTA_TURMA_PROFESSOR = 'semNota';
const SITUACAO_SUSPEITA_TURMA_PROFESSOR = 'suspeita';
const SITUACAO_NADA_TURMA_PROFESSOR = 'nada';
const SITUACAO_FALHA_TURMA_PROFESSOR = 'falha';
const MOTIVOS_FORA_TURMA_PROFESSOR = [
    [SITUACAO_SEM_NOTA_TURMA_PROFESSOR, MOTIVO_SEM_NOTA_TURMA_PROFESSOR],
    [SITUACAO_SUSPEITA_TURMA_PROFESSOR, MOTIVO_SUSPEITA_TURMA_PROFESSOR],
    [SITUACAO_NADA_TURMA_PROFESSOR, MOTIVO_NADA_TURMA_PROFESSOR],
    [SITUACAO_FALHA_TURMA_PROFESSOR, MOTIVO_FALHA_TURMA_PROFESSOR],
];
const TAMANHO_LOTE_TURMA_PROFESSOR = 4;
const DIGITOS_QUESTAO_TURMA_PROFESSOR = 2;

/**
 * Chave de um tópico ("item|tópico").
 * @param {{item: number, topico: number}} linha - Linha com item e tópico.
 * @returns {string} Chave.
 */
function chaveTopicoTurmaProfessor(linha) {
    return linha.item + '|' + linha.topico;
}

/**
 * Lê os tópicos da prova (valem para todos os alunos da atividade).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Object[]>} Tópicos com item e tópico, em ordem.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function lerTopicosDaProvaTurmaProfessor(atividadeId) {
    return sbGet(TABELA_TOPICOS_TURMA_PROFESSOR, 'select=item,topico&atividade_id=eq.' +
        atividadeId + '&order=item,topico');
}

/**
 * Lê a correção e as suspeitas de cópia pendentes de um aluno.
 * @param {number} atividadeId - Id da atividade.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno do painel.
 * @returns {Promise<{correcoes: Map, suspeitas: Set<string>}>} Dados do aluno.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function lerCorrecaoDoAlunoTurmaProfessor(atividadeId, aluno) {
    const filtro = '&atividade_id=eq.' + atividadeId + '&aluno_id=eq.' + aluno.alunoId +
        '&tentativa=eq.' + aluno.tentativa;
    const [correcoes, suspeitas] = await Promise.all([
        sbGet(TABELA_CORRECAO_TURMA_PROFESSOR,
            'select=item,topico,nota_ia,nota_professor' + filtro),
        sbGet(TABELA_SUSPEITA_TURMA_PROFESSOR, 'select=item,topico' + filtro +
            '&situacao=eq.pendente&semelhanca=gte.' + SEMELHANCA_MINIMA_TURMA_PROFESSOR),
    ]);
    return {
        correcoes: new Map(correcoes.map((linha) => [chaveTopicoTurmaProfessor(linha), linha])),
        suspeitas: new Set(suspeitas.map(chaveTopicoTurmaProfessor)),
    };
}

/**
 * Tópicos que entram na nota do aluno (da questão 1 até "Quantidade Mínima").
 * @param {Object[]} topicos - Tópicos da prova.
 * @param {{questoesNota: number}} aluno - Aluno do painel.
 * @returns {Object[]} Tópicos considerados.
 */
function topicosNaNotaTurmaProfessor(topicos, aluno) {
    const limite = aluno.questoesNota || Infinity;
    return topicos.filter((topico) => topico.item <= limite);
}

/**
 * Maior nota de uma questão: a da IA ou a já confirmada pelo professor (no empate, a do
 * professor, por isso devolve null quando não há o que gravar).
 * @param {{nota_ia: number, nota_professor: number}} correcao - Correção da questão.
 * @returns {number|null} Nota a gravar, ou null se a do professor já é a maior (ou igual).
 */
function maiorNotaTurmaProfessor(correcao) {
    const notaIa = correcao.nota_ia;
    const notaProfessor = correcao.nota_professor;
    const semNotaProfessor = notaProfessor === null || notaProfessor === undefined;
    if (semNotaProfessor) return notaIa;
    return notaIa > notaProfessor ? notaIa : null;
}

/**
 * Separa as questões do aluno: sem nota da IA, com suspeita pendente e as linhas a gravar com a
 * maior nota.
 * @param {{topicos: Object[], dados: Object, aluno: Object, atividadeId: number}} pedido - Dados
 *     lidos do aluno (topicos já limitados às questões da nota).
 * @returns {{semNota: Object[], comSuspeita: Object[], linhas: Object[]}} Separação.
 */
function separarQuestoesTurmaProfessor({ topicos, dados, aluno, atividadeId }) {
    const separacao = { semNota: [], comSuspeita: [], linhas: [] };
    const justificativa = 'Regerada pelo Confirmar Todas (regra da maior nota) em ' +
        new Date().toISOString();
    topicos.forEach((topico) => {
        const chave = chaveTopicoTurmaProfessor(topico);
        const correcao = dados.correcoes.get(chave);
        const semNotaIa = correcao?.nota_ia === null || correcao?.nota_ia === undefined;
        if (dados.suspeitas.has(chave)) {
            separacao.comSuspeita.push(topico);
            return;
        }
        if (semNotaIa) {
            separacao.semNota.push(topico);
            return;
        }
        const nota = maiorNotaTurmaProfessor(correcao);
        if (nota === null) return;
        separacao.linhas.push({
            aluno_id: aluno.alunoId, atividade_id: atividadeId, tentativa: aluno.tentativa,
            item: topico.item, topico: topico.topico, nota_professor: nota,
            justificativa_mudanca: justificativa,
        });
    });
    return separacao;
}

/**
 * Lista as questões de um conjunto de tópicos ("Q03, Q07").
 * @param {Object[]} topicos - Tópicos.
 * @returns {string} Lista das questões.
 */
function listarQuestoesTurmaProfessor(topicos) {
    const itens = [...new Set(topicos.map((topico) => topico.item))];
    return itens.map((item) => 'Q' + String(item).padStart(DIGITOS_QUESTAO_TURMA_PROFESSOR, '0'))
        .join(', ');
}

/**
 * Avalia um aluno entregue: diz se há nota a regerar ou por que ele é pulado.
 * @param {{atividadeId: number, topicos: Object[], aluno: Object}} pedido - Aluno e tópicos.
 * @returns {Promise<Object>} { situacao, aluno, linhas?, detalhe? }.
 */
async function avaliarAlunoTurmaProfessor({ atividadeId, topicos, aluno }) {
    try {
        const dados = await lerCorrecaoDoAlunoTurmaProfessor(atividadeId, aluno);
        const separacao = separarQuestoesTurmaProfessor({
            topicos: topicosNaNotaTurmaProfessor(topicos, aluno), dados, aluno, atividadeId });
        if (separacao.comSuspeita.length) {
            return { situacao: SITUACAO_SUSPEITA_TURMA_PROFESSOR, aluno,
                detalhe: listarQuestoesTurmaProfessor(separacao.comSuspeita) };
        }
        if (separacao.semNota.length) {
            return { situacao: SITUACAO_SEM_NOTA_TURMA_PROFESSOR, aluno,
                detalhe: listarQuestoesTurmaProfessor(separacao.semNota) };
        }
        if (!separacao.linhas.length) return { situacao: SITUACAO_NADA_TURMA_PROFESSOR, aluno };
        return { situacao: SITUACAO_GRAVAR_TURMA_PROFESSOR, aluno, linhas: separacao.linhas };
    } catch (erro) {
        return { situacao: SITUACAO_FALHA_TURMA_PROFESSOR, aluno, detalhe: erro.message };
    }
}

/**
 * Divide uma lista em lotes pequenos (poupa o banco).
 * @param {Object[]} lista - Lista a dividir.
 * @param {number} tamanho - Tamanho de cada lote.
 * @returns {Object[][]} Lotes, na ordem da lista.
 */
function dividirEmLotesTurmaProfessor(lista, tamanho) {
    const lotes = [];
    for (let inicio = 0; inicio < lista.length; inicio += tamanho) {
        lotes.push(lista.slice(inicio, inicio + tamanho));
    }
    return lotes;
}

/**
 * Avalia todos os alunos entregues, em lotes pequenos.
 * @param {{atividadeId: number, topicos: Object[], alunos: Object[], aoAvancar: Function}} pedido
 *     - Alunos entregues e aviso de andamento (recebe quantos já foram).
 * @returns {Promise<Object[]>} Avaliações, na ordem da lista.
 */
async function avaliarAlunosTurmaProfessor({ atividadeId, topicos, alunos, aoAvancar }) {
    const avaliacoes = [];
    for (const lote of dividirEmLotesTurmaProfessor(alunos, TAMANHO_LOTE_TURMA_PROFESSOR)) {
        const doLote = await Promise.all(lote.map((aluno) =>
            avaliarAlunoTurmaProfessor({ atividadeId, topicos, aluno })));
        avaliacoes.push(...doLote);
        aoAvancar?.(avaliacoes.length, alunos.length);
    }
    return avaliacoes;
}

/**
 * Grava as notas de um aluno num comando só (upsert na chave da correção).
 * @param {Object[]} linhas - Linhas da correção com a maior nota.
 * @throws {Error} Se o banco recusar a gravação.
 */
async function gravarNotasDoAlunoTurmaProfessor(linhas) {
    const { error } = await obterClienteSupabase().from(TABELA_CORRECAO_TURMA_PROFESSOR)
        .upsert(linhas, { onConflict: CHAVE_CORRECAO_TURMA_PROFESSOR });
    if (error) throw new Error(error.message);
}

/**
 * Grava aluno por aluno, em sequência; a falha de um não derruba os outros.
 * @param {{aGravar: Object[], aoAvancar: Function}} pedido - Avaliações a gravar e andamento.
 * @returns {Promise<{confirmados: number, questoes: number, falhas: string[]}>} Resultado.
 */
async function gravarAlunosTurmaProfessor({ aGravar, aoAvancar }) {
    const resultado = { confirmados: 0, questoes: 0, falhas: [] };
    for (const item of aGravar) {
        try {
            await gravarNotasDoAlunoTurmaProfessor(item.linhas);
            resultado.confirmados += 1;
            resultado.questoes += item.linhas.length;
        } catch (erro) {
            resultado.falhas.push(item.aluno.nome + ': ' + erro.message);
        }
        aoAvancar?.(resultado.confirmados + resultado.falhas.length, aGravar.length);
    }
    return resultado;
}

/**
 * Lista os alunos pulados, com o motivo de cada um.
 * @param {Object[]} avaliacoes - Todas as avaliações.
 * @returns {string[]} Linhas no formato "Nome — motivo".
 */
function listarPuladosTurmaProfessor(avaliacoes) {
    const pulados = [];
    MOTIVOS_FORA_TURMA_PROFESSOR.forEach(([situacao, motivo]) => {
        avaliacoes.filter((item) => item.situacao === situacao).forEach((item) => {
            const detalhe = item.detalhe ? ' (' + item.detalhe + ')' : '';
            pulados.push('• ' + item.aluno.nome + ' — ' + motivo + detalhe);
        });
    });
    return pulados;
}

/**
 * Monta o texto do popup de confirmação: o que será gravado, a regra e quem fica de fora.
 * @param {{aGravar: Object[], avaliacoes: Object[], entregues: number}} resumo - Avaliação feita.
 * @returns {string} Texto do popup.
 */
function montarResumoTurmaProfessor({ aGravar, avaliacoes, entregues }) {
    const questoes = aGravar.reduce((soma, item) => soma + item.linhas.length, 0);
    const linhas = ['Regerar a nota do professor em ' + questoes + ' questão(ões) de ' +
        aGravar.length + ' aluno(s) da turma (' + entregues + ' entregue(s))?',
        MSG_REGRA_TURMA_PROFESSOR];
    const pulados = listarPuladosTurmaProfessor(avaliacoes);
    if (pulados.length) {
        linhas.push('Ficam de fora ' + pulados.length + ' aluno(s):', ...pulados);
    }
    return linhas.join('\n');
}

/**
 * Mostra o resultado final: quantos foram confirmados, quem foi pulado e as falhas.
 * @param {{resultado: Object, avaliacoes: Object[]}} fim - Resultado da gravação e avaliações.
 * @returns {Promise<void>} Conclui quando o popup fechar.
 */
function mostrarResultadoTurmaProfessor({ resultado, avaliacoes }) {
    const pulados = listarPuladosTurmaProfessor(avaliacoes);
    const linhas = [resultado.confirmados + ' aluno(s) confirmado(s) · ' + resultado.questoes +
        ' questão(ões) com a maior nota.'];
    if (pulados.length) linhas.push('', 'Pulados (' + pulados.length + '):', ...pulados);
    if (resultado.falhas.length) {
        linhas.push('', resultado.falhas.length + ' falha(s):', ...resultado.falhas);
    }
    return mostrarPopup(linhas.join('\n'),
        { tipo: resultado.falhas.length ? 'erro' : 'sucesso', titulo: TITULO_TURMA_PROFESSOR });
}

/**
 * Avalia a turma, pergunta uma vez e grava; devolve true se gravou algo.
 * @param {{contexto: Object, avisar: Function}} pedido - Dados do painel e aviso de andamento.
 * @returns {Promise<boolean>} true se houve gravação.
 */
async function processarConfirmarTodasTurma({ contexto, avisar }) {
    const entregues = (contexto.lerAlunos?.() || []).filter((aluno) => aluno.entregue);
    if (!entregues.length) {
        await mostrarPopup(MSG_SEM_ALUNOS_TURMA_PROFESSOR,
            { tipo: 'info', titulo: TITULO_TURMA_PROFESSOR });
        return false;
    }
    const topicos = await lerTopicosDaProvaTurmaProfessor(contexto.atividadeId);
    const avaliacoes = await avaliarAlunosTurmaProfessor({ atividadeId: contexto.atividadeId,
        topicos, alunos: entregues, aoAvancar: (feitos, total) => avisar('⏳ Lendo ' + feitos +
            '/' + total + ' alunos...') });
    const aGravar = avaliacoes.filter((item) =>
        item.situacao === SITUACAO_GRAVAR_TURMA_PROFESSOR);
    if (!aGravar.length) {
        await mostrarPopup([MSG_NADA_TURMA_PROFESSOR, '',
            ...listarPuladosTurmaProfessor(avaliacoes)].join('\n'),
            { tipo: 'info', titulo: TITULO_TURMA_PROFESSOR });
        return false;
    }
    const confirmou = await confirmarPopup(
        montarResumoTurmaProfessor({ aGravar, avaliacoes, entregues: entregues.length }),
        { tipo: 'aviso', titulo: TITULO_TURMA_PROFESSOR,
            textoConfirmar: TEXTO_CONFIRMAR_POPUP_TURMA_PROFESSOR });
    if (!confirmou) return false;

    const resultado = await gravarAlunosTurmaProfessor({ aGravar,
        aoAvancar: (feitos, total) => avisar('⏳ Gravando ' + feitos + '/' + total + '...') });
    await mostrarResultadoTurmaProfessor({ resultado, avaliacoes });
    return resultado.confirmados > 0;
}

/**
 * Executa o fluxo completo com o botão desligado e trata erro inesperado.
 * @param {Object} contexto - Dados do painel.
 * @param {HTMLButtonElement} botao - Botão clicado.
 */
async function executarConfirmarTodasTurma(contexto, botao) {
    botao.disabled = true;
    botao.textContent = TEXTO_LENDO_TURMA_PROFESSOR;
    const avisar = (texto) => {
        botao.textContent = texto;
    };
    try {
        const gravou = await processarConfirmarTodasTurma({ contexto, avisar });
        if (gravou) await contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup('Não foi possível confirmar a turma: ' + erro.message,
            { tipo: 'erro', titulo: TITULO_TURMA_PROFESSOR });
    } finally {
        botao.disabled = false;
        botao.textContent = TEXTO_BOTAO_TURMA_PROFESSOR;
    }
}

/**
 * Cria o botão "✅ CONFIRMAR TODAS (TURMA)" do painel (nível turma, só professor).
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Dados do
 *     painel (lerAlunos devolve os alunos da turma escolhida).
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoConfirmarTodasTurma(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_TURMA_PROFESSOR + ' ' + CLASSE_EXTRA_BOTAO_TURMA_PROFESSOR;
    botao.textContent = TEXTO_BOTAO_TURMA_PROFESSOR;
    botao.title = DICA_BOTAO_TURMA_PROFESSOR;
    botao.addEventListener('click', () => executarConfirmarTodasTurma(contexto, botao));
    return botao;
}

window.criarBotaoConfirmarTodasTurma = criarBotaoConfirmarTodasTurma;
