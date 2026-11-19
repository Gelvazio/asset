// Professor: botão "✅ Confirmar Todas" ao lado do nome do aluno no Progresso da turma das
// discursivas (progresso-turma-global.js). Regera a confirmação do professor
// (correcao_discursiva.nota_professor) em todas as questões do aluno, mesmo nas que já tinham
// correção, pela REGRA DA MAIOR NOTA: nota_professor = maior(nota_ia, nota_professor atual);
// em empate fica a nota do professor (pedido do usuário em 2026-11-09, tarefa
// CONFIRMAR-TODAS-MAIOR-NOTA.1 — antes só gravava nas questões sem nota do professor).
// - Só para quem já entregou.
// - Se alguma questão estiver sem nota da IA: alerta "QUESTÕES SEM NOTA! GERE A CORREÇÃO DE IA DE
//   NOVO!" e nada é gravado.
// - Questões com suspeita de cópia pendente (90% ou mais): um modal avisa que é preciso tratar as
//   suspeitas primeiro e nada é gravado (pedido do usuário em 2026-11-09).
// Pedido do usuário em 2026-10-14 (tarefa #134). Depende de js/supabase.js e assets/js/popup.js.

const TABELA_CORRECAO_CONFIRMAR_TODAS = 'correcao_discursiva';
const CHAVE_CORRECAO_CONFIRMAR_TODAS = 'aluno_id,atividade_id,tentativa,item,topico';
const SEMELHANCA_MINIMA_CONFIRMAR_TODAS = 0.9;
const TEXTO_BOTAO_CONFIRMAR_TODAS = '✅ Confirmar Todas';
const TITULO_CONFIRMAR_TODAS = 'Confirmar Todas';
const DICA_SEM_ENTREGA_CONFIRMAR_TODAS = 'Só depois que o aluno entregar a atividade.';
const MSG_SEM_NOTA_CONFIRMAR_TODAS = 'QUESTÕES SEM NOTA! GERE A CORREÇÃO DE IA DE NOVO!';
const MSG_SUSPEITA_CONFIRMAR_TODAS = 'Este aluno tem questão com SUSPEITA DE CÓPIA pendente. ' +
    'É preciso tratar as suspeitas primeiro; depois clique em Confirmar Todas de novo. ' +
    'Nada foi gravado.';
const MSG_NADA_CONFIRMAR_TODAS = 'Não há questão para confirmar: a nota do professor já é a ' +
    'maior em todas as questões (ou as que mudariam estão com suspeita de cópia pendente).';
const DIGITOS_QUESTAO_CONFIRMAR_TODAS = 2;
const NOTA_MAXIMA_CONFIRMAR_TODAS = 10;

/**
 * Chave de um tópico ("item|tópico").
 * @param {{item: number, topico: number}} linha - Linha com item e tópico.
 * @returns {string} Chave.
 */
function chaveTopicoConfirmarTodas(linha) {
    return linha.item + '|' + linha.topico;
}

/**
 * Lê os tópicos da prova, a correção do aluno e as suspeitas de cópia pendentes dele.
 * @param {number} atividadeId - Id da atividade.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno do painel.
 * @returns {Promise<{topicos: Object[], todosTopicos: Object[], correcoes: Map,
 *     suspeitas: Set<string>}>} Dados (topicos = só os que entram na nota do aluno; todosTopicos =
 *     todos, com os pontos, para calcular a nota).
 */
async function lerDadosConfirmarTodas(atividadeId, aluno) {
    const filtroAluno = '&atividade_id=eq.' + atividadeId + '&aluno_id=eq.' + aluno.alunoId +
        '&tentativa=eq.' + aluno.tentativa;
    const [topicos, correcoes, suspeitas] = await Promise.all([
        sbGet('topico_discursivo', 'select=item,topico,pontos&atividade_id=eq.' + atividadeId +
            '&order=item,topico'),
        sbGet(TABELA_CORRECAO_CONFIRMAR_TODAS,
            'select=item,topico,nota_ia,nota_professor' + filtroAluno),
        sbGet('suspeita_copia_discursiva', 'select=item,topico' + filtroAluno +
            '&situacao=eq.pendente&semelhanca=gte.' + SEMELHANCA_MINIMA_CONFIRMAR_TODAS),
    ]);
    // Só contam as questões que entram na nota do aluno (da 1 até "Quantidade Mínima").
    const limite = aluno.questoesNota || Infinity;
    return { topicos: topicos.filter((topico) => topico.item <= limite), todosTopicos: topicos,
        correcoes: new Map(correcoes.map((linha) => [chaveTopicoConfirmarTodas(linha), linha])),
        suspeitas: new Set(suspeitas.map(chaveTopicoConfirmarTodas)) };
}

/**
 * Nota confirmada de um tópico pela regra da maior nota: maior(nota_ia, nota_professor).
 * Em empate fica a nota do professor; sem nota do professor, fica a da IA.
 * @param {{nota_ia: number, nota_professor: number}} correcao - Correção do tópico.
 * @returns {number} Nota a gravar como nota do professor.
 */
function notaMaiorConfirmarTodas(correcao) {
    const notaIa = Number(correcao?.nota_ia ?? 0);
    const notaProfessor = correcao?.nota_professor;
    const semNotaProfessor = notaProfessor === null || notaProfessor === undefined;
    if (semNotaProfessor) return notaIa;
    return Number(notaProfessor) >= notaIa ? Number(notaProfessor) : notaIa;
}

/**
 * Diz se o tópico muda ao regerar a confirmação (sem nota do professor ou nota da IA maior).
 * @param {{nota_ia: number, nota_professor: number}} correcao - Correção do tópico.
 * @returns {boolean} true se a nota do professor precisa ser gravada de novo.
 */
function precisaRegravarConfirmarTodas(correcao) {
    const notaProfessor = correcao?.nota_professor;
    const semNotaProfessor = notaProfessor === null || notaProfessor === undefined;
    if (semNotaProfessor) return true;
    return notaMaiorConfirmarTodas(correcao) > Number(notaProfessor);
}

/**
 * Separa as questões: sem nota da IA (bloqueiam), com suspeita (puladas) e a confirmar.
 * Entram todos os tópicos da nota, inclusive os já corrigidos pelo professor: ficam de fora só os
 * que não mudam pela regra da maior nota (a nota do professor já é a maior ou é igual à da IA).
 * @param {{topicos: Object[], correcoes: Map, suspeitas: Set<string>}} dados - Dados lidos.
 * @returns {{semNota: Object[], comSuspeita: Object[], puladas: number, aConfirmar: Object[]}}
 *   Separação (comSuspeita: tópicos que mudariam, mas têm suspeita de cópia pendente).
 */
function separarQuestoesConfirmarTodas(dados) {
    const semNota = dados.topicos.filter((topico) => {
        const notaIa = dados.correcoes.get(chaveTopicoConfirmarTodas(topico))?.nota_ia;
        return notaIa === null || notaIa === undefined;
    });
    const aRegravar = dados.topicos.filter((topico) => !semNota.includes(topico) &&
        precisaRegravarConfirmarTodas(dados.correcoes.get(chaveTopicoConfirmarTodas(topico))));
    const comSuspeita = aRegravar.filter((topico) =>
        dados.suspeitas.has(chaveTopicoConfirmarTodas(topico)));
    const aConfirmar = aRegravar.filter((topico) =>
        !dados.suspeitas.has(chaveTopicoConfirmarTodas(topico)));
    return { semNota, comSuspeita, puladas: comSuspeita.length, aConfirmar };
}

/**
 * Nota do aluno (0 a 10) pela mesma conta da nota lançada: soma das notas do professor ÷ pontos
 * da prova × 10 × (total de questões ÷ quantidade para a nota do aluno), no máximo 10.
 * @param {{todosTopicos: Object[], correcoes: Map}} dados - Dados lidos.
 * @param {{questoesNota?: number}} aluno - Aluno do painel (quantidade para a nota).
 * @param {Map<string, number>} [novasNotas] - Notas que passam a valer (chave "item|tópico").
 * @returns {number} Nota do aluno.
 */
function calcularNotaConfirmarTodas(dados, aluno, novasNotas = new Map()) {
    const totalPontos = dados.todosTopicos.reduce(
        (soma, topico) => soma + Number(topico.pontos), 0);
    const totalQuestoes = new Set(dados.todosTopicos.map((topico) => topico.item)).size;
    if (!totalPontos || !totalQuestoes) return 0;

    const soma = dados.todosTopicos.reduce((total, topico) => {
        const chave = chaveTopicoConfirmarTodas(topico);
        const atual = Number(dados.correcoes.get(chave)?.nota_professor ?? 0);
        return total + (novasNotas.has(chave) ? novasNotas.get(chave) : atual);
    }, 0);
    const questoesNota = aluno.questoesNota || totalQuestoes;
    return Math.min(NOTA_MAXIMA_CONFIRMAR_TODAS,
        soma / totalPontos * NOTA_MAXIMA_CONFIRMAR_TODAS * totalQuestoes / questoesNota);
}

/**
 * Nota do aluno hoje e a que ele terá depois do Confirmar Todas (regra da maior nota).
 * @param {Object} dados - Dados lidos (lerDadosConfirmarTodas).
 * @param {Object} aluno - Aluno do painel.
 * @param {Object[]} aConfirmar - Questões que serão regeradas.
 * @returns {{hoje: number, depois: number}} Notas.
 */
function calcularNotasConfirmarTodas(dados, aluno, aConfirmar) {
    const novasNotas = new Map(aConfirmar.map((topico) => [chaveTopicoConfirmarTodas(topico),
        notaMaiorConfirmarTodas(dados.correcoes.get(chaveTopicoConfirmarTodas(topico)))]));
    return { hoje: calcularNotaConfirmarTodas(dados, aluno),
        depois: calcularNotaConfirmarTodas(dados, aluno, novasNotas) };
}

/**
 * Formata a nota com duas casas.
 * @param {number} nota - Nota.
 * @returns {string} Nota formatada em português.
 */
function formatarNotaConfirmarTodas(nota) {
    return nota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Lista as questões sem nota ("Q03, Q07").
 * @param {Object[]} topicos - Tópicos sem nota da IA.
 * @returns {string} Lista das questões.
 */
function listarQuestoesConfirmarTodas(topicos) {
    const itens = [...new Set(topicos.map((topico) => topico.item))];
    return itens.map((item) => 'Q' + String(item).padStart(DIGITOS_QUESTAO_CONFIRMAR_TODAS, '0'))
        .join(', ');
}

/**
 * Grava a maior nota (IA ou professor) como nota do professor em todas as questões a confirmar,
 * num comando só, atualizando também as que já tinham nota do professor.
 * @param {{atividadeId: number, aluno: Object, aConfirmar: Object[], correcoes: Map}} pedido
 * @throws {Error} Se o banco recusar.
 */
async function gravarConfirmarTodas({ atividadeId, aluno, aConfirmar, correcoes }) {
    const justificativa = 'Regerada pelo Confirmar Todas (regra da maior nota) em ' +
        new Date().toISOString();
    const linhas = aConfirmar.map((topico) => ({
        aluno_id: aluno.alunoId, atividade_id: atividadeId, tentativa: aluno.tentativa,
        item: topico.item, topico: topico.topico,
        nota_professor: notaMaiorConfirmarTodas(correcoes.get(chaveTopicoConfirmarTodas(topico))),
        justificativa_mudanca: justificativa,
    }));
    const { error } = await obterClienteSupabase().from(TABELA_CORRECAO_CONFIRMAR_TODAS)
        .upsert(linhas, { onConflict: CHAVE_CORRECAO_CONFIRMAR_TODAS });
    if (error) throw new Error(error.message);
}

/**
 * Pergunta ao professor antes de gravar (explica a regra da maior nota e mostra a nota do aluno).
 * @param {Object} aluno - Aluno do painel (nome).
 * @param {{aConfirmar: Object[]}} separacao - Questões separadas.
 * @param {{hoje: number, depois: number}} notas - Nota do aluno hoje e depois de confirmar.
 * @returns {Promise<boolean>} true se confirmou.
 */
function perguntarConfirmarTodas(aluno, separacao, notas) {
    return confirmarPopup('Regerar a nota confirmada pelo professor em ' +
        separacao.aConfirmar.length + ' questão(ões) de ' + aluno.nome + '? ' +
        'Em cada questão fica a MAIOR nota entre a da IA e a do professor.\n\n' +
        'Nota do aluno depois de confirmar: ' + formatarNotaConfirmarTodas(notas.depois) +
        ' (máximo 10)\nNota hoje: ' + formatarNotaConfirmarTodas(notas.hoje),
    { tipo: 'aviso', titulo: TITULO_CONFIRMAR_TODAS, textoConfirmar: 'Confirmar Todas' });
}

/**
 * Faz o "Confirmar Todas" de um aluno: confere, pergunta, grava e atualiza o painel.
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 */
async function confirmarTodasDoAluno(contexto) {
    const { atividadeId, aluno } = contexto;
    try {
        const dados = await lerDadosConfirmarTodas(atividadeId, aluno);
        const separacao = separarQuestoesConfirmarTodas(dados);
        if (separacao.comSuspeita.length) {
            await mostrarPopup(MSG_SUSPEITA_CONFIRMAR_TODAS + '\n\nQuestões: ' +
                listarQuestoesConfirmarTodas(separacao.comSuspeita),
                { tipo: 'aviso', titulo: TITULO_CONFIRMAR_TODAS });
            return;
        }
        if (separacao.semNota.length) {
            await mostrarPopup(MSG_SEM_NOTA_CONFIRMAR_TODAS + '\n\nQuestões: ' +
                listarQuestoesConfirmarTodas(separacao.semNota),
                { tipo: 'erro', titulo: TITULO_CONFIRMAR_TODAS });
            return;
        }
        if (!separacao.aConfirmar.length) {
            await mostrarPopup(MSG_NADA_CONFIRMAR_TODAS,
                { tipo: 'info', titulo: TITULO_CONFIRMAR_TODAS });
            return;
        }
        const notas = calcularNotasConfirmarTodas(dados, aluno, separacao.aConfirmar);
        if (!await perguntarConfirmarTodas(aluno, separacao, notas)) return;

        await gravarConfirmarTodas({ atividadeId, aluno, aConfirmar: separacao.aConfirmar,
            correcoes: dados.correcoes });
        await mostrarPopup(separacao.aConfirmar.length + ' questão(ões) confirmada(s).',
            { tipo: 'sucesso', titulo: TITULO_CONFIRMAR_TODAS });
        await contexto.aoMudar?.();
    } catch (erro) {
        await mostrarPopup('Não foi possível confirmar: ' + erro.message,
            { tipo: 'erro', titulo: TITULO_CONFIRMAR_TODAS });
    }
}

/**
 * Cria o botão "✅ Confirmar Todas" do aluno (desativado enquanto ele não entregou).
 * @param {{atividadeId: number, aluno: Object, aoMudar: Function}} contexto - Dados do painel.
 * @returns {HTMLButtonElement} Botão.
 */
function criarBotaoConfirmarTodas(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'progresso-turma__confirmar-todas';
    botao.textContent = TEXTO_BOTAO_CONFIRMAR_TODAS;
    botao.disabled = !contexto.aluno.entregue;
    if (botao.disabled) botao.title = DICA_SEM_ENTREGA_CONFIRMAR_TODAS;
    botao.addEventListener('click', () => confirmarTodasDoAluno(contexto));
    return botao;
}

window.criarBotaoConfirmarTodas = criarBotaoConfirmarTodas;
