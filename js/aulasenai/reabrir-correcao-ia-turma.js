// Professor: botão "REABRIR CORRECAO DE IA" no painel do Progresso da turma das discursivas
// (progresso-turma-global.js). Reabre a correção da TURMA TODA (todos os alunos da turma
// escolhida), tudo mesmo, também o que o professor já confirmou:
// - zera nota_ia e nota_ia_em de todos os tópicos da atividade (a IA nunca refaz o tópico que já
//   tem nota da IA, então precisa zerar para corrigir de novo);
// - apaga a correção confirmada pelo professor (nota, justificativa, histórico) e a nota gravada
//   de cada aluno, pela função do banco reabrir_correcao_discursiva (tipo 'todas',
//   database/2026-11-11-reabrir-correcao-discursiva-todas.sql).
// Não mexe em comentário nem em resposta de aluno. Pede confirmação, mostra a barra de progresso
// (barra-progresso-popup.js) e termina com a mensagem de resultado.
// Pedido do usuário em 2026-11-11. Depende de js/supabase.js (sbH, obterClienteSupabase),
// assets/js/popup.js e assets/js/barra-progresso-popup.js. Regra: docs/regras/atividades.md

const CLASSE_BOTAO_REABRIR_IA = 'progresso-turma__confirmar-toda-correcao-ia';
const TEXTO_BOTAO_REABRIR_IA = '↩️ REABRIR CORRECAO DE IA';
const TITULO_REABRIR_IA = 'Reabrir correção de IA';
const TABELA_REABRIR_IA = 'correcao_discursiva';
const FUNCAO_REABRIR_PROFESSOR_IA = 'reabrir_correcao_discursiva';
const TIPO_REABRIR_TUDO_IA = 'todas';
const TAMANHO_LOTE_REABRIR_IA = 5;
const MSG_SEM_ALUNOS_REABRIR_IA = 'Nenhum aluno na lista da turma.';
const MSG_PERGUNTA_REABRIR_IA = ' aluno(s) da turma: TODA a correção desta atividade será ' +
    'REMOVIDA, inclusive o que você já confirmou (notas do professor, justificativas, ' +
    'histórico e a nota gravada de cada aluno) e as notas da IA. Os comentários e as respostas ' +
    'dos alunos não mudam. Depois, a IA pode corrigir de novo e você confirma outra vez. ' +
    'Reabrir tudo?';

/**
 * Reabre a correção confirmada pelo professor de um aluno (nota, justificativa, histórico e nota
 * gravada), pela função do banco.
 * @param {number} atividadeId - Id da atividade.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno e tentativa da lista.
 * @returns {Promise<number>} Quantos tópicos foram reabertos.
 * @throws {Error} Se o banco recusar.
 */
async function reabrirCorrecaoDoProfessorDoAluno(atividadeId, aluno) {
    const { data, error } = await obterClienteSupabase().rpc(FUNCAO_REABRIR_PROFESSOR_IA, {
        p_aluno: aluno.alunoId, p_atividade: atividadeId, p_tentativa: aluno.tentativa,
        p_tipo: TIPO_REABRIR_TUDO_IA });
    if (error) throw new Error(error.message);
    return Number(data) || 0;
}

/**
 * Zera a correção de IA de alguns alunos da atividade.
 * @param {number} atividadeId - Id da atividade.
 * @param {string[]} alunoIds - Ids dos alunos do lote.
 * @returns {Promise<number>} Quantos tópicos tiveram a correção de IA removida.
 * @throws {Error} Se o banco recusar.
 */
async function zerarCorrecaoIaDoLote(atividadeId, alunoIds) {
    const consulta = 'atividade_id=eq.' + atividadeId + '&aluno_id=in.(' + alunoIds.join(',') +
        ')&nota_ia=not.is.null&select=item';
    const resposta = await fetch(SUPABASE.URL + '/rest/v1/' + TABELA_REABRIR_IA + '?' + consulta,
        { method: 'PATCH', headers: { ...(await sbH()), Prefer: 'return=representation' },
            body: JSON.stringify({ nota_ia: null, nota_ia_em: null }) });
    if (!resposta.ok) throw new Error(await resposta.text());
    return (await resposta.json()).length;
}

/**
 * Reabre um lote: primeiro a correção do professor de cada aluno, depois a correção de IA.
 * @param {number} atividadeId - Id da atividade.
 * @param {Object[]} lote - Alunos do lote (alunoId e tentativa).
 * @param {{professor: number, ia: number, falhas: string[]}} resultado - Soma do resultado.
 */
async function reabrirLoteReabrirIa(atividadeId, lote, resultado) {
    const reaberturas = await Promise.allSettled(lote.map((aluno) =>
        reabrirCorrecaoDoProfessorDoAluno(atividadeId, aluno)));
    reaberturas.forEach((reabertura, indice) => {
        if (reabertura.status === 'fulfilled') resultado.professor += reabertura.value;
        else resultado.falhas.push('• ' + (lote[indice].nome || lote[indice].alunoId) +
            ' — professor: ' + reabertura.reason.message);
    });
    try {
        resultado.ia += await zerarCorrecaoIaDoLote(atividadeId, lote.map((aluno) => aluno.alunoId));
    } catch (erro) {
        resultado.falhas.push('• lote de ' + lote.length + ' aluno(s) — IA: ' + erro.message);
    }
}

/**
 * Reabre a correção da lista de alunos, alguns por vez, mostrando o andamento.
 * @param {number} atividadeId - Id da atividade.
 * @param {Object[]} alunos - Alunos da turma (com alunoId e tentativa).
 * @param {Object} janela - Janela da barra de progresso.
 * @returns {Promise<{professor: number, ia: number, falhas: string[]}>} Resultado.
 */
async function reabrirCorrecaoDaTurma(atividadeId, alunos, janela) {
    const resultado = { professor: 0, ia: 0, falhas: [] };
    for (let inicio = 0; inicio < alunos.length; inicio += TAMANHO_LOTE_REABRIR_IA) {
        janela.atualizar(inicio, alunos.length, 'reabrindo a correção');
        const lote = alunos.slice(inicio, inicio + TAMANHO_LOTE_REABRIR_IA);
        await reabrirLoteReabrirIa(atividadeId, lote, resultado);
    }
    janela.atualizar(alunos.length, alunos.length, '');
    return resultado;
}

/**
 * Fluxo completo: confirma, remove a correção de IA da turma e mostra o resultado.
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Painel.
 * @returns {Promise<boolean>} true se removeu alguma correção (o painel deve atualizar).
 */
async function processarReabrirCorrecaoIa(contexto) {
    const alunos = contexto.lerAlunos();
    if (!alunos.length) {
        await mostrarPopup(MSG_SEM_ALUNOS_REABRIR_IA, { tipo: 'aviso', titulo: TITULO_REABRIR_IA });
        return false;
    }
    const aceitou = await confirmarPopup(alunos.length + MSG_PERGUNTA_REABRIR_IA,
        { titulo: TITULO_REABRIR_IA, textoConfirmar: 'Reabrir' });
    if (!aceitou) return false;

    const janela = window.abrirBarraProgresso({ titulo: 'Reabrindo a correção da turma' });
    const resultado = await reabrirCorrecaoDaTurma(contexto.atividadeId, alunos, janela);
    const linhas = [alunos.length + ' aluno(s) da turma: ' + resultado.professor +
        ' tópico(s) com a correção do professor reaberta e ' + resultado.ia +
        ' tópico(s) com a correção de IA removida.'];
    if (resultado.falhas.length) linhas.push('', resultado.falhas.length + ' falha(s):',
        ...resultado.falhas);
    const mudou = resultado.professor + resultado.ia > 0;
    const tipo = resultado.falhas.length ? (mudou ? 'aviso' : 'erro') : 'sucesso';
    await janela.concluir({ tipo, mensagem: linhas.join('\n') });
    return mudou;
}

/**
 * Cria o botão "REABRIR CORRECAO DE IA".
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Dados do
 *     painel (lerAlunos devolve todos os alunos da turma escolhida).
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoReabrirCorrecaoIa(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_REABRIR_IA;
    botao.textContent = TEXTO_BOTAO_REABRIR_IA;
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        try {
            if (await processarReabrirCorrecaoIa(contexto)) await contexto.aoMudar?.();
        } catch (erro) {
            await mostrarPopup('Não foi possível reabrir: ' + erro.message,
                { tipo: 'erro', titulo: TITULO_REABRIR_IA });
        } finally {
            botao.disabled = false;
        }
    });
    return botao;
}

window.criarBotaoReabrirCorrecaoIa = criarBotaoReabrirCorrecaoIa;
