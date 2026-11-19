// PDF do "Exportar Meu Gabarito" (assets/js/botao-minhas-respostas.js): cabeçalho SENAI, quadro
// de identificação (estudante, turma, unidade curricular, atividade, tentativa, entrega e nota),
// a tabela com as respostas do aluno, marca d'água diagonal (nome + identificador) e rodapé com
// data/hora. ⛔ Nunca leva a resposta certa: recebe só o que o adaptador da página leu das
// tabelas do próprio aluno. jsPDF e autoTable vêm do cdnjs se a página ainda não os tiver.

const URL_JSPDF_MEU_GABARITO =
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const URL_AUTOTABLE_MEU_GABARITO =
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
const MARGEM_MEU_GABARITO = 15;
const LARGURA_A4_MEU_GABARITO = 210;
const ALTURA_FAIXA_MEU_GABARITO = 18;
const POSICAO_RODAPE_MEU_GABARITO = 290;
const COR_MARCA_MEU_GABARITO = [160, 160, 160];
const OPACIDADE_MARCA_MEU_GABARITO = 0.18;
const ANGULO_MARCA_MEU_GABARITO = 35;
const TAMANHO_MARCA_MEU_GABARITO = 26;
const CENTRO_Y_MARCA_MEU_GABARITO = 148;
const LARGURA_COLUNA_QUESTAO = 55;
const COR_SENAI_MEU_GABARITO = [0, 51, 153];
const COR_CINZA_MEU_GABARITO = [240, 240, 240];
const TITULO_PDF_MEU_GABARITO = 'MEU GABARITO — RESPOSTAS DO ALUNO';
const SUBTITULO_PDF_MEU_GABARITO = 'SENAI · Documento para postagem no Ambiente Virtual';
const AVISO_PDF_MEU_GABARITO = 'Este documento traz somente as respostas registradas pelo ' +
    'estudante no sistema. Não contém o gabarito oficial da atividade.';
const ESTILO_TABELA_MEU_GABARITO = { fontSize: 10, cellPadding: 2.5, lineColor: [0, 0, 0],
    lineWidth: 0.1, textColor: [0, 0, 0], valign: 'top' };
const TAMANHO_MAXIMO_NOME_ARQUIVO = 60;
const PREFIXO_PADRAO_ARQUIVO_MEU_GABARITO = 'MEU-GABARITO';
const LIMITE_AVISO_NA_FOLHA = 270;

/**
 * Deixa o texto compatível com a fonte padrão do jsPDF (Latin-1): troca símbolos, tira emojis.
 * @param {string} texto - Texto original.
 * @returns {string} Texto limpo.
 */
function textoPdfMeuGabarito(texto) {
    return String(texto || '')
        .replace(/→/g, '->').replace(/×/g, 'x').replace(/≥/g, '>=').replace(/≤/g, '<=')
        .replace(/[^\x00-\xFF—–“”‘’•…\n]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Carrega um script externo e espera terminar.
 * @param {string} endereco - URL do script.
 * @returns {Promise<void>} Resolve quando carregou.
 */
function carregarScriptExternoMeuGabarito(endereco) {
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
async function garantirJsPdfMeuGabarito() {
    const temJsPdf = Boolean(window.jspdf?.jsPDF || window.jsPDF);
    if (!temJsPdf) await carregarScriptExternoMeuGabarito(URL_JSPDF_MEU_GABARITO);
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF.API.autoTable) await carregarScriptExternoMeuGabarito(URL_AUTOTABLE_MEU_GABARITO);
    return jsPDF;
}

/**
 * Formata data e hora no padrão brasileiro (vazio se não houver data).
 * @param {string} dataIso - Data em ISO.
 * @returns {string} Data formatada.
 */
function formatarDataMeuGabarito(dataIso) {
    if (!dataIso) return '';
    return new Date(dataIso).toLocaleString('pt-BR');
}

/**
 * Desenha a faixa azul do topo com o título do documento.
 * @param {Object} doc - Documento jsPDF.
 * @returns {number} Posição vertical logo abaixo da faixa.
 */
function desenharFaixaMeuGabarito(doc) {
    doc.setFillColor(...COR_SENAI_MEU_GABARITO);
    doc.rect(0, 0, LARGURA_A4_MEU_GABARITO, ALTURA_FAIXA_MEU_GABARITO, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.text(textoPdfMeuGabarito(TITULO_PDF_MEU_GABARITO), MARGEM_MEU_GABARITO, 9);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(textoPdfMeuGabarito(SUBTITULO_PDF_MEU_GABARITO), MARGEM_MEU_GABARITO, 14.5);
    doc.setTextColor(0, 0, 0);
    return ALTURA_FAIXA_MEU_GABARITO + 6;
}

/**
 * Monta as linhas do quadro de identificação.
 * @param {Object} dados - Dados do PDF (ver gerarPdfMeuGabarito).
 * @returns {string[][]} Linhas [rótulo, valor].
 */
function linhasIdentificacaoMeuGabarito(dados) {
    return [
        ['Estudante', dados.estudante],
        ['Turma', dados.turma],
        ['Unidade Curricular', dados.unidadeCurricular],
        ['Atividade', dados.atividade],
        ['Docente', dados.docente],
        ['Tentativa', dados.tentativa],
        ['Entregue em', formatarDataMeuGabarito(dados.entregueEm)],
        ['Nota', dados.nota],
    ].filter((linha) => linha[1]).map((linha) => linha.map(textoPdfMeuGabarito));
}

/**
 * Desenha o quadro de identificação do aluno e da atividade.
 * @param {Object} doc - Documento jsPDF.
 * @param {Object} dados - Dados do PDF.
 * @param {number} yPos - Posição vertical inicial.
 * @returns {number} Posição vertical logo abaixo do quadro.
 */
function desenharIdentificacaoMeuGabarito(doc, dados, yPos) {
    doc.autoTable({
        startY: yPos, margin: { left: MARGEM_MEU_GABARITO, right: MARGEM_MEU_GABARITO },
        theme: 'grid', styles: ESTILO_TABELA_MEU_GABARITO,
        columnStyles: { 0: { fontStyle: 'bold', fillColor: COR_CINZA_MEU_GABARITO,
            cellWidth: 45 } },
        body: linhasIdentificacaoMeuGabarito(dados),
    });
    return doc.lastAutoTable.finalY + 6;
}

/**
 * Desenha a tabela com as respostas do aluno e, se o professor comentou algum tópico, a coluna
 * "Comentário do professor".
 * @param {Object} doc - Documento jsPDF.
 * @param {{questao: string, resposta: string, comentario?: string}[]} respostas - Respostas.
 * @param {number} yPos - Posição vertical inicial.
 * @returns {number} Posição vertical logo abaixo da tabela.
 */
function desenharRespostasMeuGabarito(doc, respostas, yPos) {
    const temComentario = respostas.some((linha) => linha.comentario);
    const titulos = ['Questão', 'Resposta do estudante'];
    if (temComentario) titulos.push('Comentário do professor');
    doc.autoTable({
        startY: yPos, margin: { left: MARGEM_MEU_GABARITO, right: MARGEM_MEU_GABARITO },
        theme: 'grid', styles: ESTILO_TABELA_MEU_GABARITO,
        headStyles: { fillColor: COR_SENAI_MEU_GABARITO, textColor: [255, 255, 255],
            fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: LARGURA_COLUNA_QUESTAO } },
        head: [titulos],
        body: respostas.map((linha) => {
            const celulas = [textoPdfMeuGabarito(linha.questao),
                textoPdfMeuGabarito(linha.resposta)];
            if (temComentario) celulas.push(textoPdfMeuGabarito(linha.comentario || ''));
            return celulas;
        }),
    });
    return doc.lastAutoTable.finalY + 6;
}

/**
 * Monta o texto da marca d'água / rodapé: nome e identificador (matrícula ou e-mail).
 * @param {Object} dados - Dados do PDF.
 * @returns {string} Texto limpo para o jsPDF.
 */
function textoMarcaMeuGabarito(dados) {
    const nome = textoPdfMeuGabarito(dados.estudante || '');
    const id = textoPdfMeuGabarito(dados.identificador || dados.matricula || dados.email || '');
    return [nome, id].filter(Boolean).join(' · ') || 'ALUNO';
}

/**
 * Desenha a marca d'água diagonal (cinza semitransparente) em todas as páginas.
 * @param {Object} doc - Documento jsPDF.
 * @param {string} texto - Texto da marca.
 */
function desenharMarcaDaguaMeuGabarito(doc, texto) {
    const total = doc.getNumberOfPages();
    const centroX = LARGURA_A4_MEU_GABARITO / 2;
    const temGState = Boolean(doc.GState && doc.setGState && doc.saveGraphicsState);
    for (let pagina = 1; pagina <= total; pagina++) {
        doc.setPage(pagina);
        if (temGState) {
            doc.saveGraphicsState();
            doc.setGState(new doc.GState({ opacity: OPACIDADE_MARCA_MEU_GABARITO }));
            doc.setTextColor(...COR_MARCA_MEU_GABARITO);
        } else {
            doc.setTextColor(210, 210, 210);
        }
        doc.setFont(undefined, 'bold');
        doc.setFontSize(TAMANHO_MARCA_MEU_GABARITO);
        doc.text(texto, centroX, CENTRO_Y_MARCA_MEU_GABARITO,
            { align: 'center', angle: ANGULO_MARCA_MEU_GABARITO });
        if (temGState) doc.restoreGraphicsState();
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
    }
}

/**
 * Escreve o aviso final e o rodapé "Página X de Y" em todas as folhas.
 * @param {Object} doc - Documento jsPDF.
 * @param {Object} dados - Dados do PDF.
 * @param {number} posicaoAviso - Posição vertical do aviso.
 */
function finalizarFolhasMeuGabarito(doc, dados, posicaoAviso) {
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const marca = textoMarcaMeuGabarito(dados);
    let yPos = posicaoAviso;
    const larguraTexto = LARGURA_A4_MEU_GABARITO - 2 * MARGEM_MEU_GABARITO;
    if (yPos > LIMITE_AVISO_NA_FOLHA) {
        doc.addPage();
        yPos = MARGEM_MEU_GABARITO;
    }
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text(doc.splitTextToSize(textoPdfMeuGabarito(AVISO_PDF_MEU_GABARITO + ' Gerado em ' +
        geradoEm + '.'), larguraTexto), MARGEM_MEU_GABARITO, yPos);
    doc.setFont(undefined, 'normal');
    desenharMarcaDaguaMeuGabarito(doc, marca);
    const total = doc.getNumberOfPages();
    const rodapeBase = marca + ' · ' + geradoEm;
    for (let pagina = 1; pagina <= total; pagina++) {
        doc.setPage(pagina);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(textoPdfMeuGabarito(rodapeBase + ' · Página ' + pagina + ' de ' + total),
            LARGURA_A4_MEU_GABARITO / 2, POSICAO_RODAPE_MEU_GABARITO, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    }
}

/**
 * Deixa um texto seguro para nome de arquivo: sem acentos, só A-Z, 0-9 e hífen, em maiúsculas.
 * @param {string} texto - Texto livre.
 * @returns {string} Texto seguro (pode ser vazio).
 */
function textoSeguroArquivoMeuGabarito(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
}

/**
 * Prefixo do nome do arquivo (#552): PRIMEIRO NOME + ÚLTIMO SOBRENOME do estudante
 * ("Ana Gabrieli Alves" → ANA-ALVES); nome de uma palavra só → só ele; sem nome, o prefixo
 * antigo "MEU-GABARITO".
 * @param {string} estudante - Nome completo do estudante.
 * @returns {string} Prefixo seguro para o nome do arquivo.
 */
function prefixoArquivoMeuGabarito(estudante) {
    const partes = String(estudante || '').trim().split(/\s+/).filter(Boolean);
    const nomes = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
    return textoSeguroArquivoMeuGabarito(nomes.join(' ')) || PREFIXO_PADRAO_ARQUIVO_MEU_GABARITO;
}

/**
 * Nome curto da atividade (#552): o nome do arquivo da página, sem a extensão
 * (".../ATIVIDADE-PRATICA-AULA-05.html" → ATIVIDADE-PRATICA-AULA-05). Sem arquivo na página,
 * usa o título da atividade (truncado depois, no nome do arquivo).
 * @param {Object} dados - Dados do PDF (pagina opcional; padrão: location.pathname).
 * @returns {string} Nome curto seguro (pode ser vazio).
 */
function nomeCurtoAtividadeMeuGabarito(dados) {
    const caminho = dados.pagina || globalThis.location?.pathname || '';
    const arquivo = decodeURIComponent(caminho.split('/').pop() || '').replace(/\.html?$/i, '');
    return textoSeguroArquivoMeuGabarito(arquivo) || textoSeguroArquivoMeuGabarito(dados.atividade);
}

/**
 * Monta o nome do arquivo: PREFIXO-NOME-CURTO-DA-ATIVIDADE.pdf (#552; ex.:
 * ANA-ALVES-ATIVIDADE-PRATICA-AULA-05.pdf). O limite de tamanho vale para o conjunto, sem cortar
 * o prefixo.
 * @param {Object} dados - Dados do PDF.
 * @returns {string} Nome do arquivo .pdf.
 */
function nomeArquivoMeuGabarito(dados) {
    const prefixo = prefixoArquivoMeuGabarito(dados.estudante);
    const espaco = Math.max(TAMANHO_MAXIMO_NOME_ARQUIVO - prefixo.length - 1, 0);
    const atividade = nomeCurtoAtividadeMeuGabarito(dados).slice(0, espaco).replace(/-+$/, '');
    return (atividade ? prefixo + '-' + atividade : prefixo) + '.pdf';
}

/**
 * Gera e baixa o PDF com as respostas do aluno.
 * @param {{estudante: string, identificador?: string, matricula?: string, email?: string,
 *     turma: string, unidadeCurricular: string, atividade: string, docente: string,
 *     tentativa: string, entregueEm: string, nota: string,
 *     respostas: {questao: string, resposta: string}[]}} dados - Dados montados pelo adaptador
 *     (identificador = matrícula ou, sem ela, e-mail).
 * @throws {Error} Se não houver respostas ou o jsPDF não carregar.
 */
async function gerarPdfMeuGabarito(dados) {
    if (!dados?.respostas?.length) throw new Error('nenhuma resposta encontrada.');
    const jsPDF = await garantirJsPdfMeuGabarito();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let yPos = desenharFaixaMeuGabarito(doc);
    yPos = desenharIdentificacaoMeuGabarito(doc, dados, yPos);
    yPos = desenharRespostasMeuGabarito(doc, dados.respostas, yPos);
    finalizarFolhasMeuGabarito(doc, dados, yPos);
    doc.save(nomeArquivoMeuGabarito(dados));
}

window.gerarPdfMeuGabarito = gerarPdfMeuGabarito;
