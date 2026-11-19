/**
 * Professor: botão "✅ MEIA CERTA → CERTA (TURMA)" no painel do Progresso da turma das discursivas
 * (progresso-turma-global.js; vale para toda atividade discursiva, inclusive a de id 257). Num
 * clique, marca como CERTA (nota cheia do tópico) toda questão em que a IA deu MEIA nota, de todos
 * os alunos que já entregaram a atividade na turma escolhida. Pedido do usuário em 2026-11-13.
 * - Entram só os alunos entregues e as questões da nota do aluno (da 1 até "Quantidade Mínima").
 * - "Meia certa" = nota_ia igual à metade dos pontos do tópico (tolerância de 0,01).
 * - Respeita o professor: se a nota_professor já foi mudada à mão (diferente da nota da IA), a
 *   questão não é tocada; só vira certa a questão sem nota do professor ou com a mesma nota da IA
 *   (o que o "Confirmar Todas" grava).
 * - Questão com suspeita de cópia pendente (90% ou mais) é pulada.
 * - Grava `correcao_discursiva.nota_professor` = pontos do tópico, por aluno, com upsert na chave
 *   'aluno_id,atividade_id,tentativa,item,topico' e justificativa_mudanca (trigger
 *   correcao_discursiva_validar). Nunca mexe na nota_ia. A falha de um aluno não derruba os outros.
 * - Um popup resume o que será gravado antes; no fim, outro mostra o resultado.
 * Depende de js/supabase.js (sbGet, obterClienteSupabase) e assets/js/popup.js.
 */

const TABELA_CORRECAO_MEIA_CERTA = 'correcao_discursiva';
const TABELA_TOPICOS_MEIA_CERTA = 'topico_discursivo';
const TABELA_SUSPEITA_MEIA_CERTA = 'suspeita_copia_discursiva';
const CHAVE_CORRECAO_MEIA_CERTA = 'aluno_id,atividade_id,tentativa,item,topico';
const SEMELHANCA_MINIMA_MEIA_CERTA = 0.9;
const TOLERANCIA_NOTA_MEIA_CERTA = 0.011;
const DIVISOR_META_MEIA_CERTA = 2;
const TAMANHO_LOTE_MEIA_CERTA = 4;
const CLASSE_BOTAO_MEIA_CERTA = 'progresso-turma__confirmar-toda-correcao-ia';
const CLASSE_EXTRA_BOTAO_MEIA_CERTA = 'progresso-turma__meia-certa-turma';
const TEXTO_BOTAO_MEIA_CERTA = '✅ MEIA CERTA → CERTA (TURMA)';
const DICA_BOTAO_MEIA_CERTA = 'Marca como CERTA (nota cheia) toda questão em que a IA deu meia ' +
    'nota, de todos os alunos entregues da turma.';
const TITULO_MEIA_CERTA = 'Meia certa → certa (turma)';
const TEXTO_CONFIRMAR_MEIA_CERTA = 'Marcar como certa';
const TEXTO_LENDO_MEIA_CERTA = '⏳ Lendo a turma...';
const MSG_SEM_ALUNOS_MEIA_CERTA = 'Nenhum aluno da turma entregou a atividade ainda.';
const MSG_NADA_MEIA_CERTA = 'Nenhuma questão com meia nota da IA para marcar como certa agora.';
const MSG_REGRA_MEIA_CERTA = 'A nota do professor da questão passa a ser a nota cheia. Questão ' +
    'que o professor já mudou à mão, ou com suspeita de cópia pendente, não é tocada.';
const DIGITOS_QUESTAO_MEIA_CERTA = 2;

/**
 * Chave de um tópico ("item|tópico").
 * @param {{item: number, topico: number}} linha - Linha com item e tópico.
 * @returns {string} Chave.
 */
function chaveTopicoMeiaCerta(linha) {
    return linha.item + '|' + linha.topico;
}

/**
 * Diz se duas notas são iguais, ignorando o erro de ponto flutuante.
 * @param {number} primeira - Uma nota.
 * @param {number} segunda - Outra nota.
 * @returns {boolean} true se a diferença é desprezível.
 */
function notasIguaisMeiaCerta(primeira, segunda) {
    return Math.abs(primeira - segunda) <= TOLERANCIA_NOTA_MEIA_CERTA;
}

/**
 * Lê os tópicos da prova com os pontos de cada um (valem para todos os alunos).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Object[]>} Tópicos (item, topico, pontos), em ordem.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function lerTopicosMeiaCerta(atividadeId) {
    return sbGet(TABELA_TOPICOS_MEIA_CERTA, 'select=item,topico,pontos&atividade_id=eq.' +
        atividadeId + '&order=item,topico');
}

/**
 * Lê a correção e as suspeitas de cópia pendentes de um aluno.
 * @param {number} atividadeId - Id da atividade.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno do painel.
 * @returns {Promise<{correcoes: Map, suspeitas: Set<string>}>} Dados do aluno.
 * @throws {Error} Se o banco recusar a leitura.
 */
async function lerDadosDoAlunoMeiaCerta(atividadeId, aluno) {
    const filtro = '&atividade_id=eq.' + atividadeId + '&aluno_id=eq.' + aluno.alunoId +
        '&tentativa=eq.' + aluno.tentativa;
    const [correcoes, suspeitas] = await Promise.all([
        sbGet(TABELA_CORRECAO_MEIA_CERTA, 'select=item,topico,nota_ia,nota_professor' + filtro),
        sbGet(TABELA_SUSPEITA_MEIA_CERTA, 'select=item,topico' + filtro +
            '&situacao=eq.pendente&semelhanca=gte.' + SEMELHANCA_MINIMA_MEIA_CERTA),
    ]);
    return {
        correcoes: new Map(correcoes.map((linha) => [chaveTopicoMeiaCerta(linha), linha])),
        suspeitas: new Set(suspeitas.map(chaveTopicoMeiaCerta)),
    };
}

/**
 * Diz se a questão deve virar certa: a IA deu meia nota e o professor não mudou à mão.
 * @param {{pontos: number}} topico - Tópico com os pontos.
 * @param {{nota_ia: ?number, nota_professor: ?number}|undefined} correcao - Correção da questão.
 * @returns {boolean} true se vira nota cheia.
 */
function virarCertaMeiaCerta(topico, correcao) {
    const notaIa = correcao?.nota_ia;
    if (notaIa === null || notaIa === undefined) return false;
    if (!notasIguaisMeiaCerta(notaIa, topico.pontos / DIVISOR_META_MEIA_CERTA)) return false;

    const notaProfessor = correcao.nota_professor;
    const semNotaProfessor = notaProfessor === null || notaProfessor === undefined;
    return semNotaProfessor || notasIguaisMeiaCerta(notaProfessor, notaIa);
}

/**
 * Monta as linhas a gravar de um aluno (nota do professor = nota cheia do tópico).
 * @param {{topicos: Object[], dados: Object, aluno: Object, atividadeId: number}} pedido - Tópicos
 *     da nota do aluno e o que foi lido dele.
 * @returns {{linhas: Object[], comSuspeita: number}} Linhas e quantas questões ficaram de fora
 *     por suspeita de cópia.
 */
function montarLinhasMeiaCerta({ topicos, dados, aluno, atividadeId }) {
    const justificativa = 'Meia certa marcada como certa pelo professor em ' +
        new Date().toISOString();
    const resultado = { linhas: [], comSuspeita: 0 };
    topicos.forEach((topico) => {
        const chave = chaveTopicoMeiaCerta(topico);
        if (!virarCertaMeiaCerta(topico, dados.correcoes.get(chave))) return;
        if (dados.suspeitas.has(chave)) {
            resultado.comSuspeita += 1;
            return;
        }
        resultado.linhas.push({
            aluno_id: aluno.alunoId, atividade_id: atividadeId, tentativa: aluno.tentativa,
            item: topico.item, topico: topico.topico, nota_professor: topico.pontos,
            justificativa_mudanca: justificativa,
        });
    });
    return resultado;
}

/**
 * Avalia um aluno entregue: lê a correção e separa o que vira certa.
 * @param {{atividadeId: number, topicos: Object[], aluno: Object}} pedido - Aluno e tópicos.
 * @returns {Promise<Object>} { aluno, linhas, comSuspeita, falha? }.
 */
async function avaliarAlunoMeiaCerta({ atividadeId, topicos, aluno }) {
    try {
        const limite = aluno.questoesNota || Infinity;
        const naNota = topicos.filter((topico) => topico.item <= limite);
        const dados = await lerDadosDoAlunoMeiaCerta(atividadeId, aluno);
        return { aluno, ...montarLinhasMeiaCerta({ topicos: naNota, dados, aluno, atividadeId }) };
    } catch (erro) {
        return { aluno, linhas: [], comSuspeita: 0, falha: erro.message };
    }
}

/**
 * Avalia todos os alunos entregues, em lotes pequenos (poupa o banco).
 * @param {{atividadeId: number, topicos: Object[], alunos: Object[], aoAvancar: Function}} pedido
 *     - Alunos entregues e aviso de andamento (recebe quantos já foram).
 * @returns {Promise<Object[]>} Avaliações, na ordem da lista.
 */
async function avaliarAlunosMeiaCerta({ atividadeId, topicos, alunos, aoAvancar }) {
    const avaliacoes = [];
    for (let inicio = 0; inicio < alunos.length; inicio += TAMANHO_LOTE_MEIA_CERTA) {
        const lote = alunos.slice(inicio, inicio + TAMANHO_LOTE_MEIA_CERTA);
        avaliacoes.push(...await Promise.all(lote.map((aluno) =>
            avaliarAlunoMeiaCerta({ atividadeId, topicos, aluno }))));
        aoAvancar?.(avaliacoes.length, alunos.length);
    }
    return avaliacoes;
}

/**
 * Grava as linhas de um aluno num comando só (upsert na chave da correção).
 * @param {Object[]} linhas - Linhas da correção com a nota cheia.
 * @throws {Error} Se o banco recusar a gravação.
 */
async function gravarAlunoMeiaCerta(linhas) {
    const { error } = await obterClienteSupabase().from(TABELA_CORRECAO_MEIA_CERTA)
        .upsert(linhas, { onConflict: CHAVE_CORRECAO_MEIA_CERTA });
    if (error) throw new Error(error.message);
}

/**
 * Grava aluno por aluno, em sequência; a falha de um não derruba os outros.
 * @param {{aGravar: Object[], aoAvancar: Function}} pedido - Avaliações a gravar e andamento.
 * @returns {Promise<{alunos: number, questoes: number, falhas: string[]}>} Resultado.
 */
async function gravarAlunosMeiaCerta({ aGravar, aoAvancar }) {
    const resultado = { alunos: 0, questoes: 0, falhas: [] };
    for (const item of aGravar) {
        try {
            await gravarAlunoMeiaCerta(item.linhas);
            resultado.alunos += 1;
            resultado.questoes += item.linhas.length;
        } catch (erro) {
            resultado.falhas.push(item.aluno.nome + ': ' + erro.message);
        }
        aoAvancar?.(resultado.alunos + resultado.falhas.length, aGravar.length);
    }
    return resultado;
}

/**
 * Lista as questões das linhas de um aluno ("Q03, Q07").
 * @param {Object[]} linhas - Linhas da correção.
 * @returns {string} Lista das questões.
 */
function listarQuestoesMeiaCerta(linhas) {
    const itens = [...new Set(linhas.map((linha) => linha.item))];
    return itens.map((item) => 'Q' + String(item).padStart(DIGITOS_QUESTAO_MEIA_CERTA, '0'))
        .join(', ');
}

/**
 * Monta o texto do popup de confirmação: o que será gravado, por aluno, e a regra.
 * @param {Object[]} aGravar - Avaliações com linhas a gravar.
 * @param {Object[]} avaliacoes - Todas as avaliações (para contar suspeitas e falhas).
 * @returns {string} Texto do popup.
 */
function montarResumoMeiaCerta(aGravar, avaliacoes) {
    const questoes = aGravar.reduce((soma, item) => soma + item.linhas.length, 0);
    const texto = ['Marcar como CERTA ' + questoes + ' questão(ões) com meia nota da IA, de ' +
        aGravar.length + ' aluno(s)?', MSG_REGRA_MEIA_CERTA, ''];
    aGravar.forEach((item) => texto.push('• ' + item.aluno.nome + ' — ' +
        listarQuestoesMeiaCerta(item.linhas)));
    const suspeitas = avaliacoes.reduce((soma, item) => soma + item.comSuspeita, 0);
    if (suspeitas) texto.push('', suspeitas + ' questão(ões) ficam de fora por suspeita de cópia.');
    const falhas = avaliacoes.filter((item) => item.falha);
    if (falhas.length) texto.push('', falhas.length + ' aluno(s) não puderam ser lidos.');
    return texto.join('\n');
}

/**
 * Mostra o resultado final: quantos alunos e questões foram marcados e as falhas.
 * @param {{alunos: number, questoes: number, falhas: string[]}} resultado - Gravação feita.
 * @returns {Promise<void>} Conclui quando o popup fechar.
 */
function mostrarResultadoMeiaCerta(resultado) {
    const linhas = [resultado.questoes + ' questão(ões) marcada(s) como certa(s), em ' +
        resultado.alunos + ' aluno(s).'];
    if (resultado.falhas.length) {
        linhas.push('', resultado.falhas.length + ' falha(s):', ...resultado.falhas);
    }
    return mostrarPopup(linhas.join('\n'),
        { tipo: resultado.falhas.length ? 'erro' : 'sucesso', titulo: TITULO_MEIA_CERTA });
}

/**
 * Avalia a turma, pergunta uma vez e grava; devolve true se gravou algo.
 * @param {{contexto: Object, avisar: Function}} pedido - Dados do painel e aviso de andamento.
 * @returns {Promise<boolean>} true se houve gravação.
 */
async function processarMeiaCertaTurma({ contexto, avisar }) {
    const entregues = (contexto.lerAlunos?.() || []).filter((aluno) => aluno.entregue);
    if (!entregues.length) {
        await mostrarPopup(MSG_SEM_ALUNOS_MEIA_CERTA, { tipo: 'info', titulo: TITULO_MEIA_CERTA });
        return false;
    }
    const topicos = await lerTopicosMeiaCerta(contexto.atividadeId);
    const avaliacoes = await avaliarAlunosMeiaCerta({ atividadeId: contexto.atividadeId, topicos,
        alunos: entregues, aoAvancar: (feitos, total) => avisar('⏳ Lendo ' + feitos + '/' +
            total + ' alunos...') });
    const aGravar = avaliacoes.filter((item) => item.linhas.length);
    if (!aGravar.length) {
        await mostrarPopup(MSG_NADA_MEIA_CERTA, { tipo: 'info', titulo: TITULO_MEIA_CERTA });
        return false;
    }
    const confirmou = await confirmarPopup(montarResumoMeiaCerta(aGravar, avaliacoes),
        { tipo: 'aviso', titulo: TITULO_MEIA_CERTA, textoConfirmar: TEXTO_CONFIRMAR_MEIA_CERTA });
    if (!confirmou) return false;

    const resultado = await gravarAlunosMeiaCerta({ aGravar,
        aoAvancar: (feitos, total) => avisar('⏳ Gravando ' + feitos + '/' + total + '...') });
    await mostrarResultadoMeiaCerta(resultado);
    return resultado.alunos > 0;
}

/**
 * Executa o fluxo completo com o botão desligado e trata erro inesperado.
 * @param {Object} contexto - Dados do painel.
 * @param {HTMLButtonElement} botao - Botão clicado.
 */
async function executarMeiaCertaTurma(contexto, botao) {
    botao.disabled = true;
    botao.textContent = TEXTO_LENDO_MEIA_CERTA;
    try {
        const gravou = await processarMeiaCertaTurma({
            contexto, avisar: (texto) => { botao.textContent = texto; } });
        if (gravou) await contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup('Não foi possível marcar as questões: ' + erro.message,
            { tipo: 'erro', titulo: TITULO_MEIA_CERTA });
    } finally {
        botao.disabled = false;
        botao.textContent = TEXTO_BOTAO_MEIA_CERTA;
    }
}

/**
 * Cria o botão "✅ MEIA CERTA → CERTA (TURMA)" do painel (nível turma, só professor).
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Dados do
 *     painel (lerAlunos devolve os alunos da turma escolhida).
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoMeiaCertaTurma(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_MEIA_CERTA + ' ' + CLASSE_EXTRA_BOTAO_MEIA_CERTA;
    botao.textContent = TEXTO_BOTAO_MEIA_CERTA;
    botao.title = DICA_BOTAO_MEIA_CERTA;
    botao.addEventListener('click', () => executarMeiaCertaTurma(contexto, botao));
    return botao;
}

window.criarBotaoMeiaCertaTurma = criarBotaoMeiaCertaTurma;
