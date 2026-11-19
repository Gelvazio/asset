// Professor: "Lançado AVA" no Progresso da turma GLOBAL (progresso-turma-global.js), em toda
// atividade. ON/OFF "Lançado AVA" na célula de cada aluno: marca que a nota dele nesta atividade
// já foi lançada no AVA (tabela lancado_ava, por aluno + atividade). ON/OFF "Falta Lançar AVA" em
// cima da lista: desligado (padrão) não filtra; ligado lista SÓ os alunos ainda NÃO lançados.
// A escolha do filtro fica no localStorage (preferências injetadas pelo painel). É só uma marca de
// controle: não muda nota nem média. RLS: só professor das turmas do aluno lê e grava; aluno e
// anon nunca leem. Pedido do usuário em 2026-11-09 (tarefa LANCADO-AVA).
// Depende de js/supabase.js e assets/js/popup.js. O visual do botão do aluno reaproveita as
// classes de falta-aluno-progresso.css (carregado junto pelo painel).

const TABELA_LANCADO_AVA = 'lancado_ava';
const CLASSE_INTERRUPTOR_LANCADO_AVA = 'progresso-turma__interruptor';
const CLASSE_BOTAO_ALUNO_LANCADO_AVA = 'falta-aluno__interruptor--aluno';
const TEXTO_BOTAO_LANCADO_AVA = 'Lançado AVA';
const TEXTO_FILTRO_FALTA_LANCAR_AVA = 'Falta Lançar AVA';
const DICA_FILTRO_FALTA_LANCAR_AVA = 'Desligado: não filtra. Ligado: só quem ainda NÃO teve a ' +
    'nota lançada no AVA.';
const MSG_ERRO_LANCADO_AVA = 'Não foi possível gravar o "Lançado AVA": ';
const CHAVE_PREFERENCIA_LANCADO_AVA = 'falta-lancar-ava';
const VALOR_LIGADO_PREFERENCIA_LANCADO_AVA = 'sim';
const VALOR_DESLIGADO_PREFERENCIA_LANCADO_AVA = 'nao';

/**
 * Cria um ON/OFF (caixa de marcar com aparência de chave).
 * @param {{texto: string, ligado: boolean, aoMudar: Function, dica: string}} dados - Texto,
 *     estado, ação e dica do interruptor.
 * @returns {{etiqueta: HTMLLabelElement, caixa: HTMLInputElement}} Interruptor.
 */
function criarInterruptorLancadoAva(dados) {
    const etiqueta = document.createElement('label');
    etiqueta.className = CLASSE_INTERRUPTOR_LANCADO_AVA;
    etiqueta.title = dados.dica;
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = dados.ligado;
    caixa.addEventListener('change', () => dados.aoMudar(caixa));
    const chave = document.createElement('span');
    chave.className = CLASSE_INTERRUPTOR_LANCADO_AVA + '-chave';
    const texto = document.createElement('span');
    texto.textContent = dados.texto;
    etiqueta.append(caixa, chave, texto);
    return { etiqueta, caixa };
}

/**
 * Lê os alunos já lançados no AVA nesta atividade (o RLS devolve só os das turmas do professor).
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Set<string>>} Ids dos alunos lançados.
 */
async function lerAlunosLancadosAva(atividadeId) {
    const linhas = await sbGet(TABELA_LANCADO_AVA, 'select=aluno_id&atividade_id=eq.' +
        atividadeId);
    return new Set(linhas.map((linha) => linha.aluno_id));
}

/**
 * Grava (marcou) ou apaga (desmarcou) o "Lançado AVA" do aluno na atividade.
 * @param {{alunoId: string, atividadeId: number, lancado: boolean}} dados - Aluno, atividade e
 *     situação.
 * @throws {Error} Se o banco recusar.
 */
async function gravarLancadoAvaDoAluno(dados) {
    const tabela = obterClienteSupabase().from(TABELA_LANCADO_AVA);
    const { error } = dados.lancado
        ? await tabela.upsert({ aluno_id: dados.alunoId, atividade_id: dados.atividadeId },
            { onConflict: 'aluno_id,atividade_id', ignoreDuplicates: true })
        : await tabela.delete().eq('aluno_id', dados.alunoId)
            .eq('atividade_id', dados.atividadeId);
    if (error) throw new Error(error.message);
}

/**
 * Grava a mudança do "Lançado AVA"; se o banco recusar, volta o interruptor e avisa.
 * @param {Object} estado - Estado do controle (atividadeId, lancados, aoMudar).
 * @param {{aluno: Object, caixa: HTMLInputElement}} dados - Aluno e interruptor.
 */
async function mudarLancadoAvaDoAluno(estado, dados) {
    const lancado = dados.caixa.checked;
    dados.caixa.disabled = true;
    try {
        await gravarLancadoAvaDoAluno({ alunoId: dados.aluno.alunoId,
            atividadeId: estado.atividadeId, lancado });
        if (lancado) estado.lancados.add(dados.aluno.alunoId);
        if (!lancado) estado.lancados.delete(dados.aluno.alunoId);
        estado.aoMudar();
    } catch (erro) {
        dados.caixa.checked = !lancado;
        await mostrarPopup(MSG_ERRO_LANCADO_AVA + erro.message,
            { tipo: 'erro', titulo: TEXTO_BOTAO_LANCADO_AVA });
    } finally {
        dados.caixa.disabled = false;
    }
}

/**
 * Monta o ON/OFF "Lançado AVA" de um aluno.
 * @param {Object} estado - Estado do controle.
 * @param {{alunoId: string, nome: string}} aluno - Aluno do painel.
 * @returns {HTMLElement} Interruptor do aluno.
 */
function montarBotaoLancadoAvaDoAluno(estado, aluno) {
    const { etiqueta } = criarInterruptorLancadoAva({ texto: TEXTO_BOTAO_LANCADO_AVA,
        ligado: estado.lancados.has(aluno.alunoId),
        dica: 'Nota de ' + aluno.nome + ' já lançada no AVA',
        aoMudar: (caixa) => mudarLancadoAvaDoAluno(estado, { aluno, caixa }) });
    etiqueta.classList.add(CLASSE_BOTAO_ALUNO_LANCADO_AVA);
    return etiqueta;
}

/**
 * Cria o controle "Lançado AVA" do Progresso da turma (filtro de cima e botão do aluno).
 * @param {{atividadeId: number, aoMudar: Function, preferencias: Object}} dados - Atividade,
 *     redesenho da lista e escolhas guardadas no navegador ({ler, gravar}, opcional).
 * @returns {{elemento: HTMLElement, atualizar: Function, filtrar: Function,
 *     criarBotao: Function}} Filtro "Falta Lançar AVA", leitura dos lançados, filtro da lista e
 *     botão do aluno.
 */
function criarControleLancadoAva(dados) {
    const estado = { atividadeId: dados.atividadeId, lancados: new Set(),
        aoMudar: dados.aoMudar };
    const { etiqueta, caixa } = criarInterruptorLancadoAva({
        texto: TEXTO_FILTRO_FALTA_LANCAR_AVA, dica: DICA_FILTRO_FALTA_LANCAR_AVA,
        ligado: dados.preferencias?.ler(CHAVE_PREFERENCIA_LANCADO_AVA) ===
            VALOR_LIGADO_PREFERENCIA_LANCADO_AVA,
        aoMudar: (elemento) => {
            dados.preferencias?.gravar(CHAVE_PREFERENCIA_LANCADO_AVA, elemento.checked
                ? VALOR_LIGADO_PREFERENCIA_LANCADO_AVA
                : VALOR_DESLIGADO_PREFERENCIA_LANCADO_AVA);
            estado.aoMudar();
        } });

    return {
        elemento: etiqueta,
        async atualizar() {
            estado.lancados = await lerAlunosLancadosAva(estado.atividadeId);
        },
        filtrar: (alunos) => (caixa.checked
            ? alunos.filter((aluno) => !estado.lancados.has(aluno.alunoId)) : alunos),
        criarBotao: (aluno) => montarBotaoLancadoAvaDoAluno(estado, aluno),
    };
}

window.criarControleLancadoAva = criarControleLancadoAva;
