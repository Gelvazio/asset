// Professor: botão "✅ CONFIRMAR CORRECAO DA TURMA TODA" no painel do Progresso da turma das
// discursivas (progresso-turma-global.js). Faz, em TODOS os alunos da turma escolhida, a mesma
// ação do botão "✅ Confirmar Correção" de um aluno (finalizar-atividade-professor.js):
// - só aluno que entregou e respondeu alguma alternativa;
// - a alternativa respondida, ainda sem nota do professor, que a IA marcou como CERTA (nota da IA
//   cheia) é confirmada com a nota da IA;
// - se depois disso ainda sobrar alternativa respondida sem a nota do professor (meia certa,
//   errada ou sem nota da IA), o aluno é PULADO: o professor corrige à mão, como no botão do
//   aluno;
// - aluno que fecha a correção ganha a nota gravada pelo banco (gatilho
//   nota_gravada_na_correcao).
// Uma janela com BARRA DE PROGRESSO acompanha a verificação e a gravação (barra-progresso-popup.js)
// e termina com a mensagem de resultado (✅ certo, ⚠️ em parte, ❌ errado), com os pulados e o
// motivo; um popup resume tudo e pede a confirmação antes de gravar.
// Pedido do usuário em 2026-11-11. Depende de js/supabase.js, assets/js/popup.js e
// assets/js/barra-progresso-popup.js.
// Regra: docs/regras/atividades.md

const CLASSE_BOTAO_CORRECAO_TURMA_TODA = 'progresso-turma__confirmar-toda-correcao-ia';
const TEXTO_BOTAO_CORRECAO_TURMA_TODA = '✅ CONFIRMAR CORRECAO DA TURMA TODA';
const TEXTO_VERIFICANDO_CORRECAO_TURMA_TODA = '⏳ Verificando os alunos...';
const TITULO_CORRECAO_TURMA_TODA = 'Confirmar correção da turma toda';
const TABELA_CORRECAO_TURMA_TODA = 'correcao_discursiva';
const CHAVE_CORRECAO_TURMA_TODA = 'aluno_id,atividade_id,tentativa,item,topico';
const TAMANHO_LOTE_CORRECAO_TURMA_TODA = 5;
const TOLERANCIA_CORRECAO_TURMA_TODA = 0.001;
const MSG_NADA_CORRECAO_TURMA_TODA = 'Nenhum aluno tem correção a confirmar agora.';
const MSG_TRAVA_CORRECAO_TURMA_TODA = 'Depois de confirmada, a nota só pode ser mudada com ' +
    'uma justificativa, que fica no histórico.';
const MOTIVOS_CORRECAO_TURMA_TODA = {
    semEntrega: 'não entregou',
    semResposta: 'não respondeu nenhuma alternativa',
    jaCorrigido: 'já está com a correção completa',
    falha: 'não foi possível ler',
};

/**
 * Chave de um tópico ("item|tópico").
 * @param {{item: number, topico: number}} linha - Linha com item e tópico.
 * @returns {string} Chave.
 */
function chaveTopicoCorrecaoTurmaToda(linha) {
    return linha.item + '|' + linha.topico;
}

/**
 * Lê as respostas e a correção de um aluno na tentativa dele.
 * @param {number} atividadeId - Id da atividade.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno do painel.
 * @returns {Promise<{respostas: Object[], correcoes: Object[]}>} Linhas lidas.
 * @throws {Error} Se o banco recusar.
 */
async function lerDadosCorrecaoTurmaToda(atividadeId, aluno) {
    const filtro = '&atividade_id=eq.' + atividadeId + '&aluno_id=eq.' + aluno.alunoId +
        '&tentativa=eq.' + aluno.tentativa;
    const [respostas, correcoes] = await Promise.all([
        sbGet('resposta_discursiva', 'select=item,topico,texto' + filtro),
        sbGet(TABELA_CORRECAO_TURMA_TODA, 'select=item,topico,nota_ia,nota_professor' + filtro),
    ]);
    return { respostas, correcoes };
}

/**
 * Separa as alternativas respondidas: as que a IA marcou certa e faltam confirmar, e as que
 * ainda dependem do professor.
 * @param {{respostas: Object[], correcoes: Object[]}} dados - Dados do aluno.
 * @param {Map<string, number>} pontos - Pontos de cada tópico da prova.
 * @returns {{respondidas: number, certasDaIa: Object[], pendentes: number}} Separação.
 */
function separarAlternativasCorrecaoTurmaToda(dados, pontos) {
    const correcoes = new Map(dados.correcoes.map((linha) =>
        [chaveTopicoCorrecaoTurmaToda(linha), linha]));
    const respondidas = dados.respostas.filter((linha) => (linha.texto || '').trim());
    const separacao = { respondidas: respondidas.length, certasDaIa: [], pendentes: 0 };
    respondidas.forEach((linha) => {
        const chave = chaveTopicoCorrecaoTurmaToda(linha);
        const correcao = correcoes.get(chave);
        if (correcao?.nota_professor !== null && correcao?.nota_professor !== undefined) return;

        const cheia = pontos.get(chave) || 0;
        const iaMarcouCerta = cheia > 0 && correcao?.nota_ia !== null
            && correcao?.nota_ia !== undefined
            && Number(correcao.nota_ia) >= cheia - TOLERANCIA_CORRECAO_TURMA_TODA;
        if (iaMarcouCerta) separacao.certasDaIa.push({ item: linha.item, topico: linha.topico,
            nota_professor: cheia });
        else separacao.pendentes += 1;
    });
    return separacao;
}

/**
 * Avalia um aluno: diz se há correção a confirmar ou por que ele é pulado.
 * @param {{atividadeId: number, pontos: Map<string, number>, aluno: Object}} pedido - Aluno.
 * @returns {Promise<Object>} { situacao, aluno, linhas?, pendentes? }.
 */
async function avaliarAlunoCorrecaoTurmaToda({ atividadeId, pontos, aluno }) {
    if (!aluno.entregue) return { situacao: 'semEntrega', aluno };
    try {
        const dados = await lerDadosCorrecaoTurmaToda(atividadeId, aluno);
        const separacao = separarAlternativasCorrecaoTurmaToda(dados, pontos);
        if (!separacao.respondidas) return { situacao: 'semResposta', aluno };
        if (separacao.pendentes) {
            return { situacao: 'pendente', aluno, pendentes: separacao.pendentes };
        }
        if (!separacao.certasDaIa.length) return { situacao: 'jaCorrigido', aluno };
        return { situacao: 'gravar', aluno, linhas: separacao.certasDaIa.map((linha) => ({
            ...linha, aluno_id: aluno.alunoId, atividade_id: atividadeId,
            tentativa: aluno.tentativa })) };
    } catch (erro) {
        return { situacao: 'falha', aluno, detalhe: erro.message };
    }
}

/**
 * Avalia todos os alunos, alguns de cada vez (poupa o banco).
 * @param {number} atividadeId - Id da atividade.
 * @param {Object[]} alunos - Alunos do painel.
 * @param {function(number, number): void} aoAvancar - Recebe quantos já foram e o total.
 * @returns {Promise<Object[]>} Avaliações, na ordem da lista.
 * @throws {Error} Se não conseguir ler os pontos da prova.
 */
async function avaliarTodosCorrecaoTurmaToda(atividadeId, alunos, aoAvancar) {
    const topicos = await sbGet('topico_discursivo',
        'select=item,topico,pontos&atividade_id=eq.' + atividadeId);
    const pontos = new Map(topicos.map((topico) =>
        [chaveTopicoCorrecaoTurmaToda(topico), Number(topico.pontos)]));
    const avaliacoes = [];
    for (let inicio = 0; inicio < alunos.length; inicio += TAMANHO_LOTE_CORRECAO_TURMA_TODA) {
        const lote = alunos.slice(inicio, inicio + TAMANHO_LOTE_CORRECAO_TURMA_TODA);
        avaliacoes.push(...await Promise.all(lote.map((aluno) =>
            avaliarAlunoCorrecaoTurmaToda({ atividadeId, pontos, aluno }))));
        aoAvancar(avaliacoes.length, alunos.length);
    }
    return avaliacoes;
}

/**
 * Lista os alunos pulados, com o motivo.
 * @param {Object[]} avaliacoes - Avaliações.
 * @returns {string[]} Linhas "• Nome — motivo".
 */
function listarPuladosCorrecaoTurmaToda(avaliacoes) {
    return avaliacoes.filter((avaliacao) => avaliacao.situacao !== 'gravar').map((avaliacao) => {
        const motivo = avaliacao.situacao === 'pendente'
            ? avaliacao.pendentes + ' alternativa(s) respondida(s) para você corrigir'
            : MOTIVOS_CORRECAO_TURMA_TODA[avaliacao.situacao] || avaliacao.situacao;
        return '• ' + avaliacao.aluno.nome + ' — ' + motivo;
    });
}

/**
 * Grava as notas de um aluno num comando só.
 * @param {Object[]} linhas - Linhas da correção a confirmar.
 * @throws {Error} Se o banco recusar.
 */
async function gravarCorrecaoDoAlunoTurmaToda(linhas) {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error('Banco de dados indisponível.');

    const { error } = await cliente.from(TABELA_CORRECAO_TURMA_TODA)
        .upsert(linhas, { onConflict: CHAVE_CORRECAO_TURMA_TODA });
    if (error) throw new Error(error.message);
}

/**
 * Grava a correção dos alunos avaliados como "gravar"; a falha de um não derruba os outros.
 * @param {Object[]} aGravar - Avaliações com situação "gravar".
 * @param {function(number, number, string): void} aoAvancar - Recebe quantos já foram, o total e
 *     o nome do aluno em andamento.
 * @returns {Promise<{confirmados: number, alternativas: number, falhas: string[]}>} Resultado.
 */
async function gravarTodosCorrecaoTurmaToda(aGravar, aoAvancar) {
    const resultado = { confirmados: 0, alternativas: 0, falhas: [] };
    for (const [indice, avaliacao] of aGravar.entries()) {
        aoAvancar(indice, aGravar.length, avaliacao.aluno.nome);
        try {
            await gravarCorrecaoDoAlunoTurmaToda(avaliacao.linhas);
            resultado.confirmados += 1;
            resultado.alternativas += avaliacao.linhas.length;
        } catch (erro) {
            resultado.falhas.push('• ' + avaliacao.aluno.nome + ' — ' + erro.message);
        }
    }
    aoAvancar(aGravar.length, aGravar.length, '');
    return resultado;
}

/**
 * Diz se a gravação deu certo, deu certo em parte ou deu errado.
 * @param {{confirmados: number, falhas: string[]}} resultado - Resultado da gravação.
 * @returns {'sucesso'|'aviso'|'erro'} Tipo da mensagem final.
 */
function tipoDoResultadoCorrecaoTurmaToda(resultado) {
    if (!resultado.confirmados) return 'erro';
    return resultado.falhas.length ? 'aviso' : 'sucesso';
}

/**
 * Verifica todos os alunos mostrando a barra de progresso.
 * @param {{atividadeId: number, lerAlunos: Function}} contexto - Painel.
 * @returns {Promise<{avaliacoes: Object[]|null, janela: Object}>} Avaliações (null se falhou, e
 *     a janela já mostrou o erro) e a janela aberta.
 */
async function verificarComBarraCorrecaoTurmaToda(contexto) {
    const alunos = contexto.lerAlunos();
    const janela = window.abrirBarraProgresso({ titulo: 'Verificando os alunos da turma' });
    janela.atualizar(0, alunos.length, '');
    try {
        const avaliacoes = await avaliarTodosCorrecaoTurmaToda(contexto.atividadeId, alunos,
            (feito, total) => janela.atualizar(feito, total, 'verificando'));
        return { avaliacoes, janela };
    } catch (erro) {
        await janela.concluir({ tipo: 'erro',
            mensagem: 'Não foi possível verificar os alunos: ' + erro.message });
        return { avaliacoes: null, janela };
    }
}

/**
 * Grava a correção mostrando a barra e termina com a mensagem de resultado.
 * @param {Object[]} aGravar - Avaliações com situação "gravar".
 * @param {string[]} resumoPulados - Linhas dos alunos que ficaram de fora.
 * @returns {Promise<boolean>} true se confirmou algum aluno.
 */
async function gravarComBarraCorrecaoTurmaToda(aGravar, resumoPulados) {
    const janela = window.abrirBarraProgresso({ titulo: 'Confirmando a correção da turma' });
    const resultado = await gravarTodosCorrecaoTurmaToda(aGravar,
        (feito, total, nome) => janela.atualizar(feito, total, nome));
    const linhas = [resultado.confirmados + ' aluno(s) confirmado(s) · ' +
        resultado.alternativas + ' alternativa(s).', ...resumoPulados];
    if (resultado.falhas.length) linhas.push('', resultado.falhas.length + ' falha(s):',
        ...resultado.falhas);
    await janela.concluir({ tipo: tipoDoResultadoCorrecaoTurmaToda(resultado),
        mensagem: linhas.join('\n') });
    return resultado.confirmados > 0;
}

/**
 * Fluxo completo: verifica (com barra), pede a confirmação, grava (com barra) e mostra o
 * resultado.
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Painel.
 * @returns {Promise<boolean>} true se gravou algo (o painel deve atualizar).
 */
async function processarCorrecaoTurmaToda(contexto) {
    const { avaliacoes, janela } = await verificarComBarraCorrecaoTurmaToda(contexto);
    if (!avaliacoes) return false;

    const aGravar = avaliacoes.filter((avaliacao) => avaliacao.situacao === 'gravar');
    const pulados = listarPuladosCorrecaoTurmaToda(avaliacoes);
    const resumoPulados = pulados.length ? ['', 'Ficam de fora (' + pulados.length + '):',
        ...pulados] : [];
    if (!aGravar.length) {
        await janela.concluir({ tipo: 'aviso',
            mensagem: [MSG_NADA_CORRECAO_TURMA_TODA, ...resumoPulados].join('\n') });
        return false;
    }
    janela.fechar();
    const total = aGravar.reduce((soma, avaliacao) => soma + avaliacao.linhas.length, 0);
    const aceitou = await confirmarPopup([aGravar.length + ' aluno(s): ' + total +
        ' alternativa(s) certa(s) pela IA serão confirmadas com a nota da IA.',
    MSG_TRAVA_CORRECAO_TURMA_TODA, ...resumoPulados].join('\n'),
    { titulo: TITULO_CORRECAO_TURMA_TODA, textoConfirmar: 'Confirmar' });
    if (!aceitou) return false;

    return gravarComBarraCorrecaoTurmaToda(aGravar, resumoPulados);
}

/**
 * Cria o botão "✅ CONFIRMAR CORRECAO DA TURMA TODA".
 * @param {{atividadeId: number, lerAlunos: Function, aoMudar: Function}} contexto - Dados do
 *     painel (lerAlunos devolve todos os alunos da turma escolhida).
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoCorrecaoTurmaToda(contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_CORRECAO_TURMA_TODA;
    botao.textContent = TEXTO_BOTAO_CORRECAO_TURMA_TODA;
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        botao.textContent = TEXTO_VERIFICANDO_CORRECAO_TURMA_TODA;
        try {
            if (await processarCorrecaoTurmaToda(contexto)) await contexto.aoMudar?.();
        } catch (erro) {
            await mostrarPopup('Não foi possível confirmar: ' + erro.message,
                { tipo: 'erro', titulo: TITULO_CORRECAO_TURMA_TODA });
        } finally {
            botao.disabled = false;
            botao.textContent = TEXTO_BOTAO_CORRECAO_TURMA_TODA;
        }
    });
    return botao;
}

window.criarBotaoCorrecaoTurmaToda = criarBotaoCorrecaoTurmaToda;
