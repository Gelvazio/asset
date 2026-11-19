// Card "Notas e média": botão "Ficha Aluno" (só professor), no fim da faixa de filtros, ao lado
// de "Marcar Todos". Com um aluno escolhido no combo, baixa um PDF (jsPDF + autoTable, mesmas
// URLs do exportar-pdf-discursiva.js) com o cabeçalho SENAI, a tabela do card e as médias.
// Reaproveita o que o card já carregou (estadoNotas); só a data da aula é lida do banco
// (aula_turma.data_aula, uma consulta ao gerar, com o JWT do usuário; falha cai no card "Data:").
// O desenho fica em card-notas-ficha-aluno-layout.js (carregado antes).
// Usa globais de card-notas-media.js (estadoNotas, listarAtividadesVisiveisNotas...) só em
// tempo de chamada; por isso pode carregar antes dele.
// Média das Atividades / Prova Objetiva / Prova Prática = soma das notas ÷ atividades LIBERADAS
// na turma (não feita conta zero; aguardando fica fora do divisor; fora da média e não
// liberada não contam). Média Final = média das colunas que existirem.

const ROTULO_FICHA_ALUNO_NOTAS = 'Ficha Aluno';
const CLASSE_BOTAO_FICHA_ALUNO_NOTAS = 'btn card-notas-media__ficha-aluno';
const MSG_SEM_ALUNO_FICHA_NOTAS = 'Selecione um aluno no filtro do card para gerar a Ficha Aluno.';
const MSG_ERRO_FICHA_NOTAS = 'Não foi possível gerar a Ficha Aluno: ';
const URL_JSPDF_FICHA_NOTAS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const URL_AUTOTABLE_FICHA_NOTAS =
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
const LARGURA_PAGINA_FICHA_NOTAS = 297;
const ALTURA_PAGINA_FICHA_NOTAS = 210;
// Tema padrão SENAI (#555.4): caminho relativo à pasta assets/, como o atividades-crud-modal.js.
const BASE_ASSETS_FICHA_NOTAS = document.currentScript?.src.replace(/js\/[^/]*$/, '') || '';
const URL_TEMA_FICHA_NOTAS = BASE_ASSETS_FICHA_NOTAS + 'img/tema-senai-pdf.png';
const SELETOR_DATA_AULA_FICHA_NOTAS = '.aula-data-card';
const TABELA_AULA_TURMA_FICHA_NOTAS = 'aula_turma';
const COLUNAS_FICHA_NOTAS = ['Aula', 'Data', 'Atividade', 'Situação', 'Nota'];
const PERFIL_PROFESSOR_FICHA_NOTAS = 'PROFESSOR';
const ARQUIVO_VERIFICACAO_FICHA_NOTAS = 'js/card-notas-ficha-aluno-verificacao.js';

let botaoFichaAlunoNotas = null;

/**
 * Mantém só caracteres Latin-1 (acentos do português ficam) para a fonte padrão do jsPDF.
 * @param {string} texto - Texto original.
 * @returns {string} Texto limpo.
 */
function textoFichaNotas(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\x20-\xFF]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Monta um trecho de nome de arquivo: sem acentos, maiúsculo e com hífens.
 * @param {string} texto - Texto original.
 * @returns {string} Trecho seguro para nome de arquivo.
 */
function trechoArquivoFichaNotas(texto) {
    const semAcento = textoFichaNotas(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
    return semAcento.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Carrega um script externo.
 * @param {string} endereco - URL do script.
 * @returns {Promise<void>} Resolve quando carregou.
 */
function carregarScriptFichaNotas(endereco) {
    return new Promise((resolver, rejeitar) => {
        const script = document.createElement('script');
        script.src = endereco;
        script.onload = () => resolver();
        script.onerror = () => rejeitar(new Error('Não foi possível carregar ' + endereco));
        document.head.appendChild(script);
    });
}

/**
 * Garante o jsPDF e o autoTable na página.
 * @returns {Promise<Function>} Construtor do jsPDF.
 */
async function garantirJsPdfFichaNotas() {
    const temJsPdf = Boolean(window.jspdf?.jsPDF || window.jsPDF);
    if (!temJsPdf) await carregarScriptFichaNotas(URL_JSPDF_FICHA_NOTAS);
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF.API.autoTable) await carregarScriptFichaNotas(URL_AUTOTABLE_FICHA_NOTAS);
    return jsPDF;
}

/**
 * Nome do docente: o professor logado.
 * @returns {Promise<string>} Nome (ou e-mail) do professor; vazio se não achar.
 */
async function docenteFichaNotas() {
    const cliente = typeof obterClienteSupabase === 'function' ? obterClienteSupabase() : null;
    if (!cliente) return '';

    const { data } = await cliente.auth.getSession();
    const usuario = data?.session?.user;
    const ehProfessor = usuario?.app_metadata?.perfil === PERFIL_PROFESSOR_FICHA_NOTAS;
    if (!ehProfessor) return '';

    return usuario.user_metadata?.nome || usuario.email || '';
}

/**
 * Reúne estudante, turma, UC e docente para o cabeçalho.
 * @returns {Promise<{estudante: string, turma: string, uc: string, docente: string}>}
 */
async function dadosCabecalhoFichaNotas() {
    const idAluno = String(estadoNotas.alunoId);
    const aluno = estadoNotas.alunos.find((item) => String(item.id) === idAluno);
    const turma = estadoNotas.turmas.find((item) => item.codigo === estadoNotas.turma);
    const dados = document.body.dataset;
    const uc = dados.uc || document.querySelector('header h1')?.textContent || '';
    return { estudante: aluno ? aluno.nome : '',
        turma: turma ? rotuloTurmaNotas(turma) : estadoNotas.turma,
        uc, docente: dados.docente || await docenteFichaNotas() };
}

/**
 * Diz se a atividade está liberada na turma (sem a lista de liberadas, todas valem).
 * @param {string} pagina - Página da atividade.
 * @returns {boolean} true se liberada.
 */
function estaLiberadaFichaNotas(pagina) {
    if (!estadoNotas.liberadas) return true;

    return estadoNotas.liberadas.has(estadoNotas.ids.get(pagina)?.id);
}

/**
 * Situação do aluno na atividade.
 * @param {string} pagina - Página da atividade.
 * @returns {string} "Feita", "Aguardando correção" ou "Não fez".
 */
function situacaoFichaNotas(pagina) {
    const nota = estadoNotas.notas.get(pagina);
    if (nota?.aguardando) return SITUACAO_AGUARDANDO_FICHA_NOTAS;
    const temNota = nota && nota.nota !== null && nota.nota !== undefined;
    return temNota ? SITUACAO_FEITA_FICHA_NOTAS : SITUACAO_NAO_FEZ_FICHA_NOTAS;
}

/**
 * Converte a data do banco (AAAA-MM-DD) em dd/mm/aaaa, sem passar por fuso horário.
 * @param {string} dataBanco - Data da coluna date do banco.
 * @returns {string} Data formatada, ou texto vazio se o valor não tiver o formato esperado.
 */
function formatarDataBancoFichaNotas(dataBanco) {
    const encontrada = String(dataBanco || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!encontrada) return '';

    const [, ano, mes, dia] = encontrada;
    return dia + '/' + mes + '/' + ano;
}

/**
 * Busca no banco (aula_turma.data_aula, com o JWT do usuário logado) a data de cada aula na
 * turma escolhida no card, em uma única consulta. Falha não quebra o PDF: devolve mapa vazio.
 * @param {Array<{aulaId: number}>} atividades - Atividades listadas na ficha.
 * @returns {Promise<Map<number, string>>} dd/mm/aaaa por id da aula (só as que têm data).
 */
async function buscarDatasAulaFichaNotas(atividades) {
    const datas = new Map();
    const aulaIds = [...new Set(atividades.map((atividade) => Number(atividade.aulaId)))]
        .filter((aulaId) => Number.isFinite(aulaId) && aulaId > 0);
    if (!estadoNotas.turma || !aulaIds.length) return datas;

    try {
        const linhas = await sbGet(TABELA_AULA_TURMA_FICHA_NOTAS, 'select=aula_id,data_aula'
            + '&turma_codigo=eq.' + encodeURIComponent(estadoNotas.turma)
            + '&aula_id=in.(' + aulaIds.join(',') + ')');
        linhas.forEach((linha) => {
            const data = formatarDataBancoFichaNotas(linha.data_aula);
            if (data) datas.set(Number(linha.aula_id), data);
        });
    } catch (erro) {
        console.warn('Datas das aulas indisponíveis na Ficha Aluno:', erro.message);
    }
    return datas;
}

/**
 * Data da aula (dd/mm/aaaa): primeiro a do banco; senão a do card "Data:" que o índice mostra
 * (aula_turma.data_aula, só nas matérias com bloqueio da aula ligado); senão "-".
 * @param {number} aulaId - Id da aula do card.
 * @param {Map<number, string>} datasBanco - Datas lidas do banco por id da aula.
 * @returns {string} Data, ou "-" se nenhuma fonte a tem.
 */
function dataAulaFichaNotas(aulaId, datasBanco) {
    const doBanco = datasBanco.get(Number(aulaId));
    if (doBanco) return doBanco;

    const card = document.querySelector('[data-aula-id="' + aulaId + '"]');
    const texto = card?.querySelector(SELETOR_DATA_AULA_FICHA_NOTAS)?.textContent || '';
    const encontrada = texto.match(/\d{2}\/\d{2}\/\d{4}/);
    return encontrada ? encontrada[0] : TEXTO_SEM_VALOR_FICHA_NOTAS;
}

/**
 * Linha da ficha para uma atividade, com os textos originais (com acento).
 * @param {{pagina: string, titulo: string, aulaId: number, rotuloAula?: string}} atividade -
 *   Atividade.
 * @param {Map<number, string>} datasBanco - Datas das aulas lidas do banco.
 * @returns {string[]} Células na ordem de COLUNAS_FICHA_NOTAS.
 */
function linhaBrutaFichaNotas(atividade, datasBanco) {
    const nota = textoNotaNotas(atividade.pagina);
    const nome = estadoNotas.ids.get(atividade.pagina)?.nome || atividade.titulo;
    const textoNota = nota === TEXTO_AGUARDANDO_NOTAS ? TEXTO_SEM_VALOR_FICHA_NOTAS : nota;
    return [atividade.rotuloAula || '', dataAulaFichaNotas(atividade.aulaId, datasBanco), nome,
        situacaoFichaNotas(atividade.pagina), textoNota];
}

/**
 * Linha da tabela do PDF (sem acentos, para a fonte padrão do jsPDF).
 * @param {string[]} linhaBruta - Linha de linhaBrutaFichaNotas.
 * @returns {string[]} Células limpas.
 */
function linhaPdfFichaNotas(linhaBruta) {
    return linhaBruta.map(textoFichaNotas);
}

/**
 * Média de um grupo: soma das notas ÷ atividades liberadas (aguardando fica fora do divisor).
 * @param {string[]} paginas - Páginas do grupo (já liberadas e que calculam média).
 * @returns {number|null} Média, ou null se o grupo não tem atividade.
 */
function mediaGrupoFichaNotas(paginas) {
    let soma = 0;
    let divisor = 0;
    paginas.forEach((pagina) => {
        const nota = estadoNotas.notas.get(pagina);
        if (nota?.aguardando) return;

        divisor += 1;
        soma += Number(nota?.nota) || 0;
    });
    return divisor ? soma / divisor : null;
}

/**
 * Calcula as quatro médias da ficha.
 * @returns {Array<number|null>} Atividades, objetiva, prática e final (na ordem das colunas).
 */
function calcularMediasFichaNotas() {
    const contam = estadoNotas.atividades.filter((atividade) =>
        estaLiberadaFichaNotas(atividade.pagina)
        && lerConfiguracaoNotas(atividade.pagina).naMedia);
    const doTipo = (tipo) => contam.filter((atividade) => tipoDeProvaMediaAtividades({
        titulo: atividade.titulo, pagina: atividade.pagina,
        tipo: estadoNotas.ids.get(atividade.pagina)?.tipo ?? null }) === tipo)
        .map((atividade) => atividade.pagina);
    const colunas = [mediaGrupoFichaNotas(doTipo(null)), mediaGrupoFichaNotas(doTipo('objetiva')),
        mediaGrupoFichaNotas(doTipo('pratica'))];
    const existentes = colunas.filter((valor) => valor !== null);
    const final = existentes.length
        ? existentes.reduce((soma, valor) => soma + valor, 0) / existentes.length : null;
    return [...colunas, final];
}

/**
 * Carrega o tema SENAI como dataURL.
 * @returns {Promise<string|null>} dataURL da imagem, ou null se não carregou (PDF sai sem fundo).
 */
async function carregarTemaFichaNotas() {
    try {
        const resposta = await fetch(URL_TEMA_FICHA_NOTAS);
        if (!resposta.ok) return null;

        const blob = await resposta.blob();
        return await new Promise((resolver, rejeitar) => {
            const leitor = new FileReader();
            leitor.onload = () => resolver(leitor.result);
            leitor.onerror = () => rejeitar(leitor.error);
            leitor.readAsDataURL(blob);
        });
    } catch (erro) {
        return null;
    }
}

/**
 * Cria o gancho do autoTable que desenha o tema atrás do conteúdo, uma vez por página.
 * @param {Object} doc - Documento jsPDF.
 * @param {string|null} tema - dataURL do tema (null = sem fundo).
 * @returns {Function} Gancho willDrawPage.
 */
function criarFundoFichaNotas(doc, tema) {
    const paginasComFundo = new Set();
    return () => {
        if (!tema) return;

        const pagina = doc.internal.getCurrentPageInfo().pageNumber;
        if (paginasComFundo.has(pagina)) return;

        paginasComFundo.add(pagina);
        doc.addImage(tema, 'PNG', 0, 0, LARGURA_PAGINA_FICHA_NOTAS, ALTURA_PAGINA_FICHA_NOTAS);
    };
}

/**
 * Desenha a primeira página inteira e a lista de atividades (com as páginas seguintes).
 * @param {Object} doc - Documento jsPDF.
 * @param {{cabecalho: Object, fundo: Function, linhasBrutas: string[][], medias: Array,
 *   verificacao: Object}} contexto - Cabeçalho, gancho do fundo, linhas e médias da ficha e
 *   resultado da verificação (código e QR, ou aviso).
 */
function desenharFichaNotas(doc, contexto) {
    contexto.fundo();
    desenharTituloLayoutFicha(doc);
    desenharIdentificacaoLayoutFicha(doc, contexto.cabecalho);
    desenharIndicadoresLayoutFicha(doc, contexto.medias);
    const linhas = contexto.linhasBrutas.map(linhaPdfFichaNotas);
    desenharTabelaAtividadesLayoutFicha(doc, { colunas: COLUNAS_FICHA_NOTAS, linhas,
        planos: planejarPaginasLayoutFicha(linhas.length), fundo: contexto.fundo });
    desenharRodapeLayoutFicha(doc, contexto.verificacao);
}

/**
 * Registra a emissão no banco (antes de desenhar o PDF) e devolve código e QR, ou o aviso.
 * @param {string[][]} linhasBrutas - Linhas que a ficha imprime.
 * @param {Array<number|null>} medias - Atividades, objetiva, prática e final.
 * @returns {Promise<Object>} Verificação para o rodapé.
 */
async function verificarEmissaoFichaNotas(linhasBrutas, medias) {
    await carregarScriptFichaNotas(BASE_ASSETS_FICHA_NOTAS + ARQUIVO_VERIFICACAO_FICHA_NOTAS)
        .catch((erro) => console.warn('Verificação da ficha indisponível:', erro.message));
    if (typeof window.prepararVerificacaoFichaNotas !== 'function') return { aviso: true };

    const [atividades, objetiva, pratica, final] = medias;
    return window.prepararVerificacaoFichaNotas({
        aluno_id: String(estadoNotas.alunoId), turma_codigo: estadoNotas.turma,
        materia_id: estadoNotas.materiaId,
        linhas: linhasBrutas.map(([aula, data, atividade, situacao, nota]) =>
            ({ aula, data, atividade, situacao, nota })),
        medias: { atividades, objetiva, pratica, final } });
}

/**
 * Gera e baixa o PDF da ficha do aluno escolhido.
 * @returns {Promise<void>}
 */
async function gerarPdfFichaAlunoNotas() {
    const jsPDF = await garantirJsPdfFichaNotas();
    const cabecalho = await dadosCabecalhoFichaNotas();
    const atividades = listarAtividadesVisiveisNotas();
    const datasBanco = await buscarDatasAulaFichaNotas(atividades);
    const linhasBrutas = atividades.map((item) => linhaBrutaFichaNotas(item, datasBanco));
    const medias = calcularMediasFichaNotas();
    const verificacao = await verificarEmissaoFichaNotas(linhasBrutas, medias);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fundo = criarFundoFichaNotas(doc, await carregarTemaFichaNotas());
    desenharFichaNotas(doc, { cabecalho, fundo, linhasBrutas, medias, verificacao });
    doc.save('FICHA-ALUNO-' + trechoArquivoFichaNotas(cabecalho.estudante) + '-'
        + trechoArquivoFichaNotas(cabecalho.uc) + '.pdf');
}

/**
 * Mostra um aviso em popup (ou alert, se o popup não estiver carregado).
 * @param {string} mensagem - Texto do aviso.
 */
async function avisarFichaNotas(mensagem) {
    if (typeof window.mostrarPopup === 'function') {
        await window.mostrarPopup(mensagem, { tipo: 'erro' });
        return;
    }
    alert(mensagem);
}

/**
 * Trata o clique: exige aluno escolhido e gera o PDF.
 * @param {HTMLButtonElement} botao - Botão clicado (desabilitado durante a geração).
 */
async function aoClicarFichaAlunoNotas(botao) {
    if (!estadoNotas.alunoId) {
        await avisarFichaNotas(MSG_SEM_ALUNO_FICHA_NOTAS);
        return;
    }
    botao.disabled = true;
    try {
        await gerarPdfFichaAlunoNotas();
    } catch (erro) {
        await avisarFichaNotas(MSG_ERRO_FICHA_NOTAS + erro.message);
    } finally {
        botao.disabled = false;
    }
}

/**
 * Cria o botão "Ficha Aluno", escondido até o perfil professor ser confirmado.
 * @returns {HTMLButtonElement} Botão pronto para a faixa de filtros.
 */
function criarBotaoFichaAlunoNotas() {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_FICHA_ALUNO_NOTAS;
    botao.textContent = ROTULO_FICHA_ALUNO_NOTAS;
    botao.hidden = true;
    botao.addEventListener('click', () => aoClicarFichaAlunoNotas(botao));
    botaoFichaAlunoNotas = botao;
    atualizarBotaoFichaAlunoNotas();
    return botao;
}

/**
 * Mostra o botão só para o professor.
 */
function atualizarBotaoFichaAlunoNotas() {
    if (!botaoFichaAlunoNotas) return;

    botaoFichaAlunoNotas.hidden = !estadoNotas.ehProfessor;
}

window.criarBotaoFichaAlunoNotas = criarBotaoFichaAlunoNotas;
window.atualizarBotaoFichaAlunoNotas = atualizarBotaoFichaAlunoNotas;
