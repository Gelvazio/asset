// Layout fluido do PDF da Ficha Aluno (jsPDF + autoTable): título, cards arredondados com sombra
// suave, indicadores grandes, lista de atividades com selos coloridos e rodapé "Página X de Y".
// Só desenha; os dados vêm de card-notas-ficha-aluno.js (carregado depois deste).
// Usa textoFichaNotas e formatarNotaCard (globais) só em tempo de chamada.
// Evita caracteres fora do Latin-1, que a fonte padrão do jsPDF não desenha.

const SITUACAO_NAO_FEZ_FICHA_NOTAS = 'Não fez';
const SITUACAO_AGUARDANDO_FICHA_NOTAS = 'Aguardando correção';
const SITUACAO_FEITA_FICHA_NOTAS = 'Feita';
const TEXTO_SEM_VALOR_FICHA_NOTAS = '-';

const X_ESQUERDA_LAYOUT_FICHA = 22;
const X_DIREITA_LAYOUT_FICHA = 282;
const LARGURA_CONTEUDO_LAYOUT_FICHA = X_DIREITA_LAYOUT_FICHA - X_ESQUERDA_LAYOUT_FICHA;
const RAIO_CARTAO_LAYOUT_FICHA = 4;
const DESLOCAMENTO_SOMBRA_LAYOUT_FICHA = 0.8;
const ESPACO_ENTRE_CARTOES_LAYOUT_FICHA = 6;
const PREENCHIMENTO_CARTAO_LAYOUT_FICHA = 6;

const MM_POR_PONTO_LAYOUT_FICHA = 0.3528;
const TAMANHO_NOME_LAYOUT_FICHA = 13;
const TAMANHO_ROTULO_LAYOUT_FICHA = 7;
const TAMANHO_VALOR_LAYOUT_FICHA = 8.5;
const PREENCHIMENTO_SUPERIOR_IDENTIFICACAO_FICHA = 3;
const PREENCHIMENTO_INFERIOR_IDENTIFICACAO_FICHA = 3.2;
const FOLGA_NOME_ROTULO_FICHA = 2.5;
const FOLGA_ROTULO_VALOR_FICHA = 1.5;
const DESCIDA_NOME_FICHA = 1.2;
const ALTURA_LINHA_VALOR_FICHA = 3.4;

const Y_IDENTIFICACAO_LAYOUT_FICHA = 32;
// y (linha de base) do nome, do rótulo e da 1a linha do valor, relativos ao topo do card.
const BASE_NOME_LAYOUT_FICHA = PREENCHIMENTO_SUPERIOR_IDENTIFICACAO_FICHA
    + TAMANHO_NOME_LAYOUT_FICHA * MM_POR_PONTO_LAYOUT_FICHA;
const BASE_ROTULO_LAYOUT_FICHA = BASE_NOME_LAYOUT_FICHA + DESCIDA_NOME_FICHA
    + FOLGA_NOME_ROTULO_FICHA + TAMANHO_ROTULO_LAYOUT_FICHA * MM_POR_PONTO_LAYOUT_FICHA;
const BASE_VALOR_LAYOUT_FICHA = BASE_ROTULO_LAYOUT_FICHA + FOLGA_ROTULO_VALOR_FICHA
    + TAMANHO_VALOR_LAYOUT_FICHA * MM_POR_PONTO_LAYOUT_FICHA;
const ALTURA_IDENTIFICACAO_LAYOUT_FICHA = BASE_VALOR_LAYOUT_FICHA
    + ALTURA_LINHA_VALOR_FICHA + PREENCHIMENTO_INFERIOR_IDENTIFICACAO_FICHA;
const Y_INDICADORES_LAYOUT_FICHA = Y_IDENTIFICACAO_LAYOUT_FICHA
    + ALTURA_IDENTIFICACAO_LAYOUT_FICHA + 3;
const ALTURA_INDICADORES_LAYOUT_FICHA = 17;
const Y_ATIVIDADES_LAYOUT_FICHA = 80;
const ALTURA_LINHA_TEXTO_LAYOUT_FICHA = 3.4;
const MAXIMO_LINHAS_CAMPO_LAYOUT_FICHA = 2;
const Y_TOPO_CARTAO_LAYOUT_FICHA = 32;
const ALTURA_TITULO_CARTAO_LAYOUT_FICHA = 9;
const ALTURA_CABECALHO_LAYOUT_FICHA = 7;
const ALTURA_LINHA_LAYOUT_FICHA = 6.4;
const FOLGA_FIM_CARTAO_LAYOUT_FICHA = 3;
// Termina em 195 para sobrar faixa ao QR Code e ao código de verificação no rodapé.
const LIMITE_TABELA_LAYOUT_FICHA = 195;
const MARGEM_TABELA_LAYOUT_FICHA = { top: 42, left: 26, right: 19, bottom: 10 };
const Y_RODAPE_LAYOUT_FICHA = 205;

const COR_AZUL_LAYOUT_FICHA = [22, 65, 148];
const COR_TEXTO_LAYOUT_FICHA = [30, 41, 59];
const COR_ROTULO_LAYOUT_FICHA = [100, 116, 139];
const COR_SOMBRA_LAYOUT_FICHA = [226, 231, 240];
const COR_CARTAO_LAYOUT_FICHA = [255, 255, 255];
const COR_ZEBRA_LAYOUT_FICHA = [246, 248, 252];
const COR_LINHA_LAYOUT_FICHA = [214, 222, 235];
const COR_NOTA_BOA_LAYOUT_FICHA = [21, 128, 61];
const COR_NOTA_RUIM_LAYOUT_FICHA = [185, 28, 28];
const NOTA_MINIMA_LAYOUT_FICHA = 7;

const ROTULOS_INDICADORES_LAYOUT_FICHA = ['Média das Atividades', 'Prova Objetiva',
    'Prova Prática', 'Média Final'];
const CAMPOS_IDENTIFICACAO_LAYOUT_FICHA = [
    { rotulo: 'Turma', chave: 'turma', deslocamento: 6, largura: 80 },
    { rotulo: 'Unidade Curricular', chave: 'uc', deslocamento: 92, largura: 90 },
    { rotulo: 'Docente', chave: 'docente', deslocamento: 188, largura: 66 },
];
const SELOS_SITUACAO_LAYOUT_FICHA = {
    [SITUACAO_FEITA_FICHA_NOTAS]: { fundo: [220, 252, 231], texto: [21, 128, 61] },
    [SITUACAO_NAO_FEZ_FICHA_NOTAS]: { fundo: [254, 226, 226], texto: [185, 28, 28] },
    [SITUACAO_AGUARDANDO_FICHA_NOTAS]: { fundo: [254, 243, 199], texto: [161, 98, 7] },
};
const SELOS_POR_COLUNA_LAYOUT_FICHA = { 3: SELOS_SITUACAO_LAYOUT_FICHA };
const ALTURA_SELO_LAYOUT_FICHA = 4.5;
const FOLGA_SELO_LAYOUT_FICHA = 5;

/**
 * Desenha um card branco arredondado com sombra suave simulada.
 * @param {Object} doc - Documento jsPDF.
 * @param {{x: number, y: number, largura: number, altura: number}} area - Retângulo do card.
 */
function desenharCartaoLayoutFicha(doc, area) {
    const raio = RAIO_CARTAO_LAYOUT_FICHA;
    doc.setFillColor(...COR_SOMBRA_LAYOUT_FICHA);
    doc.roundedRect(area.x + DESLOCAMENTO_SOMBRA_LAYOUT_FICHA,
        area.y + DESLOCAMENTO_SOMBRA_LAYOUT_FICHA, area.largura, area.altura, raio, raio, 'F');
    doc.setFillColor(...COR_CARTAO_LAYOUT_FICHA);
    doc.roundedRect(area.x, area.y, area.largura, area.altura, raio, raio, 'F');
}

/**
 * Ajusta fonte, tamanho e cor do texto seguinte.
 * @param {Object} doc - Documento jsPDF.
 * @param {{estilo: string, tamanho: number, cor: number[]}} fonte - Fonte desejada.
 */
function definirFonteLayoutFicha(doc, fonte) {
    doc.setFont('helvetica', fonte.estilo);
    doc.setFontSize(fonte.tamanho);
    doc.setTextColor(...fonte.cor);
}

/**
 * Corta o texto numa única linha que caiba na largura (com a fonte já definida).
 * @param {Object} doc - Documento jsPDF.
 * @param {string} texto - Texto original.
 * @param {number} largura - Largura máxima em mm.
 * @returns {string} Primeira linha do texto quebrado.
 */
function cortarTextoLayoutFicha(doc, texto, largura) {
    const linhas = doc.splitTextToSize(textoFichaNotas(texto) || TEXTO_SEM_VALOR_FICHA_NOTAS,
        largura);
    return linhas[0];
}

/**
 * Quebra o texto em até 2 linhas que cabem na largura, sem cortar o conteúdo.
 * @param {Object} doc - Documento jsPDF.
 * @param {string} texto - Texto original.
 * @param {number} largura - Largura máxima em mm.
 * @returns {string[]} Linhas (a última recebe o restante se passar do limite).
 */
function quebrarTextoLayoutFicha(doc, texto, largura) {
    const linhas = doc.splitTextToSize(textoFichaNotas(texto) || TEXTO_SEM_VALOR_FICHA_NOTAS,
        largura);
    if (linhas.length <= MAXIMO_LINHAS_CAMPO_LAYOUT_FICHA) return linhas;

    const primeira = linhas.slice(0, MAXIMO_LINHAS_CAMPO_LAYOUT_FICHA - 1);
    return primeira.concat(linhas.slice(MAXIMO_LINHAS_CAMPO_LAYOUT_FICHA - 1).join(' '));
}

/**
 * Desenha o título "Ficha do Aluno", o subtítulo e a data de geração.
 * @param {Object} doc - Documento jsPDF.
 */
function desenharTituloLayoutFicha(doc) {
    definirFonteLayoutFicha(doc, { estilo: 'bold', tamanho: 16, cor: COR_AZUL_LAYOUT_FICHA });
    doc.text('Ficha do Aluno', X_ESQUERDA_LAYOUT_FICHA, 15);
    definirFonteLayoutFicha(doc, { estilo: 'normal', tamanho: 8.5,
        cor: COR_ROTULO_LAYOUT_FICHA });
    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric',
        month: 'long', day: 'numeric' });
    const hora = agora.toLocaleTimeString('pt-BR', { hour12: false });
    doc.text(('Notas e médias da unidade curricular · ' + data + ' às ' + hora)
        .normalize('NFC').replace(/[^\x20-\xFF]/g, ''), X_ESQUERDA_LAYOUT_FICHA, 21);
}

/**
 * Desenha o card de identificação: estudante, turma, unidade curricular e docente.
 * @param {Object} doc - Documento jsPDF.
 * @param {{estudante: string, turma: string, uc: string, docente: string}} cabecalho - Dados.
 */
function desenharIdentificacaoLayoutFicha(doc, cabecalho) {
    const x = X_ESQUERDA_LAYOUT_FICHA;
    const y = Y_IDENTIFICACAO_LAYOUT_FICHA;
    desenharCartaoLayoutFicha(doc, { x, y, largura: LARGURA_CONTEUDO_LAYOUT_FICHA,
        altura: ALTURA_IDENTIFICACAO_LAYOUT_FICHA });
    definirFonteLayoutFicha(doc, { estilo: 'bold', tamanho: TAMANHO_NOME_LAYOUT_FICHA,
        cor: COR_TEXTO_LAYOUT_FICHA });
    doc.text(cortarTextoLayoutFicha(doc, cabecalho.estudante, 248), x + 6,
        y + BASE_NOME_LAYOUT_FICHA);
    CAMPOS_IDENTIFICACAO_LAYOUT_FICHA.forEach((campo) => {
        const xCampo = x + campo.deslocamento;
        definirFonteLayoutFicha(doc, { estilo: 'normal', tamanho: TAMANHO_ROTULO_LAYOUT_FICHA,
            cor: COR_ROTULO_LAYOUT_FICHA });
        doc.text(campo.rotulo, xCampo, y + BASE_ROTULO_LAYOUT_FICHA);
        definirFonteLayoutFicha(doc, { estilo: 'normal', tamanho: TAMANHO_VALOR_LAYOUT_FICHA,
            cor: COR_TEXTO_LAYOUT_FICHA });
        doc.text(quebrarTextoLayoutFicha(doc, cabecalho[campo.chave], campo.largura),
            xCampo, y + BASE_VALOR_LAYOUT_FICHA);
    });
}

/**
 * Cor do número do indicador conforme a nota.
 * @param {number|null} valor - Nota do indicador.
 * @returns {number[]} Cor RGB.
 */
function corIndicadorLayoutFicha(valor) {
    if (valor === null) return COR_AZUL_LAYOUT_FICHA;

    const aprovado = valor >= NOTA_MINIMA_LAYOUT_FICHA;
    return aprovado ? COR_NOTA_BOA_LAYOUT_FICHA : COR_NOTA_RUIM_LAYOUT_FICHA;
}

/**
 * Desenha os quatro cards de indicadores lado a lado.
 * @param {Object} doc - Documento jsPDF.
 * @param {Array<number|null>} valores - Médias na ordem de ROTULOS_INDICADORES_LAYOUT_FICHA.
 */
function desenharIndicadoresLayoutFicha(doc, valores) {
    const quantidade = ROTULOS_INDICADORES_LAYOUT_FICHA.length;
    const espacos = ESPACO_ENTRE_CARTOES_LAYOUT_FICHA * (quantidade - 1);
    const largura = (LARGURA_CONTEUDO_LAYOUT_FICHA - espacos) / quantidade;
    ROTULOS_INDICADORES_LAYOUT_FICHA.forEach((rotulo, i) => {
        const x = X_ESQUERDA_LAYOUT_FICHA + i * (largura + ESPACO_ENTRE_CARTOES_LAYOUT_FICHA);
        const y = Y_INDICADORES_LAYOUT_FICHA;
        const centro = x + largura / 2;
        const valor = valores[i];
        desenharCartaoLayoutFicha(doc, { x, y, largura,
            altura: ALTURA_INDICADORES_LAYOUT_FICHA });
        definirFonteLayoutFicha(doc, { estilo: 'bold', tamanho: 16,
            cor: corIndicadorLayoutFicha(valor) });
        const texto = valor === null ? TEXTO_SEM_VALOR_FICHA_NOTAS : formatarNotaCard(valor);
        doc.text(textoFichaNotas(texto), centro, y + 9, { align: 'center' });
        definirFonteLayoutFicha(doc, { estilo: 'normal', tamanho: 8,
            cor: COR_ROTULO_LAYOUT_FICHA });
        doc.text(rotulo, centro, y + 14, { align: 'center' });
    });
}

/**
 * Calcula o card da lista de atividades em cada página (linhas de altura fixa).
 * @param {number} totalLinhas - Quantidade de atividades.
 * @returns {Array<{y: number, altura: number}>} Um item por página usada.
 */
function planejarPaginasLayoutFicha(totalLinhas) {
    const planos = [];
    let restante = totalLinhas;
    let yCartao = Y_ATIVIDADES_LAYOUT_FICHA;
    do {
        const topo = yCartao + ALTURA_TITULO_CARTAO_LAYOUT_FICHA;
        const espaco = LIMITE_TABELA_LAYOUT_FICHA - topo - ALTURA_CABECALHO_LAYOUT_FICHA;
        const cabem = Math.max(1, Math.floor(espaco / ALTURA_LINHA_LAYOUT_FICHA - 0.001));
        const nestaPagina = Math.min(restante, cabem);
        planos.push({ y: yCartao, altura: ALTURA_TITULO_CARTAO_LAYOUT_FICHA
            + ALTURA_CABECALHO_LAYOUT_FICHA + nestaPagina * ALTURA_LINHA_LAYOUT_FICHA
            + FOLGA_FIM_CARTAO_LAYOUT_FICHA });
        restante -= nestaPagina;
        yCartao = Y_TOPO_CARTAO_LAYOUT_FICHA;
    } while (restante > 0);
    return planos;
}

/**
 * Desenha o card branco da lista de atividades de uma página, com o título.
 * @param {Object} doc - Documento jsPDF.
 * @param {{y: number, altura: number}} plano - Posição e altura do card nesta página.
 */
function desenharCartaoAtividadesLayoutFicha(doc, plano) {
    desenharCartaoLayoutFicha(doc, { x: X_ESQUERDA_LAYOUT_FICHA, y: plano.y,
        largura: LARGURA_CONTEUDO_LAYOUT_FICHA, altura: plano.altura });
    definirFonteLayoutFicha(doc, { estilo: 'bold', tamanho: 11, cor: COR_AZUL_LAYOUT_FICHA });
    doc.text('Atividades', X_ESQUERDA_LAYOUT_FICHA + PREENCHIMENTO_CARTAO_LAYOUT_FICHA,
        plano.y + 6.5);
}

/**
 * Desenha um selo (pílula) colorido centralizado verticalmente na célula.
 * @param {Object} doc - Documento jsPDF.
 * @param {Object} celula - Célula do autoTable (x, y, height).
 * @param {{texto: string, cores: {fundo: number[], texto: number[]}}} selo - Selo a desenhar.
 */
function desenharSeloLayoutFicha(doc, celula, selo) {
    definirFonteLayoutFicha(doc, { estilo: 'bold', tamanho: 7, cor: selo.cores.texto });
    const largura = doc.getTextWidth(selo.texto) + FOLGA_SELO_LAYOUT_FICHA;
    const x = celula.x + 2;
    const y = celula.y + (celula.height - ALTURA_SELO_LAYOUT_FICHA) / 2;
    doc.setFillColor(...selo.cores.fundo);
    doc.roundedRect(x, y, largura, ALTURA_SELO_LAYOUT_FICHA, 2.5, 2.5, 'F');
    doc.text(selo.texto, x + largura / 2, y + ALTURA_SELO_LAYOUT_FICHA / 2,
        { align: 'center', baseline: 'middle' });
}

/**
 * Busca as cores do selo comparando sem acento (o texto da tabela já vem sem acento).
 * @param {number} indiceColuna - Índice da coluna da tabela.
 * @param {string} texto - Texto da célula.
 * @returns {{fundo: number[], texto: number[]}|undefined} Cores, se houver selo.
 */
function buscarCoresSeloLayoutFicha(indiceColuna, texto) {
    const mapa = SELOS_POR_COLUNA_LAYOUT_FICHA[indiceColuna];
    if (!mapa || !texto) return undefined;

    const chave = Object.keys(mapa).find((nome) => textoFichaNotas(nome) === texto);
    return chave ? mapa[chave] : undefined;
}

/**
 * Desenha a linha fina sob o cabeçalho e os selos da coluna Situação.
 * @param {Object} doc - Documento jsPDF.
 * @param {Object} dado - Dados do gancho didDrawCell.
 * @param {string[][]} linhas - Linhas da tabela (com o texto dos selos).
 */
function desenharCelulaLayoutFicha(doc, dado, linhas) {
    const { cell: celula, section: secao, column: coluna, row: linha } = dado;
    if (secao === 'head') {
        doc.setDrawColor(...COR_LINHA_LAYOUT_FICHA);
        doc.setLineWidth(0.3);
        doc.line(celula.x, celula.y + celula.height, celula.x + celula.width,
            celula.y + celula.height);
        return;
    }
    const texto = linhas[linha.index]?.[coluna.index];
    const cores = buscarCoresSeloLayoutFicha(coluna.index, texto);
    if (secao !== 'body' || !cores) return;

    desenharSeloLayoutFicha(doc, celula, { texto, cores });
}

/**
 * Desenha a lista de atividades (autoTable sem grade) dentro dos cards de cada página.
 * @param {Object} doc - Documento jsPDF.
 * @param {{colunas: string[], linhas: string[][], planos: Array, fundo: Function}} dados - Tabela.
 */
function desenharTabelaAtividadesLayoutFicha(doc, dados) {
    const { colunas, linhas, planos, fundo } = dados;
    const colunasSelo = Object.keys(SELOS_POR_COLUNA_LAYOUT_FICHA).map(Number);
    doc.autoTable({
        head: [colunas],
        body: linhas.map((linha) => linha.map((celula, i) =>
            colunasSelo.includes(i) ? '' : celula)),
        startY: planos[0].y + ALTURA_TITULO_CARTAO_LAYOUT_FICHA,
        margin: MARGEM_TABELA_LAYOUT_FICHA, theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: { top: 1.2, bottom: 1.2, left: 3, right: 3 },
            textColor: COR_TEXTO_LAYOUT_FICHA, minCellHeight: ALTURA_LINHA_LAYOUT_FICHA,
            valign: 'middle', overflow: 'ellipsize' },
        headStyles: { textColor: COR_AZUL_LAYOUT_FICHA, fontStyle: 'bold',
            minCellHeight: ALTURA_CABECALHO_LAYOUT_FICHA },
        alternateRowStyles: { fillColor: COR_ZEBRA_LAYOUT_FICHA },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 26 }, 3: { cellWidth: 44 },
            4: { cellWidth: 24, fontStyle: 'bold' } },
        willDrawPage: () => {
            fundo();
            const pagina = doc.internal.getCurrentPageInfo().pageNumber;
            desenharCartaoAtividadesLayoutFicha(doc,
                planos[Math.min(pagina, planos.length) - 1]);
        },
        didDrawCell: (dado) => desenharCelulaLayoutFicha(doc, dado, linhas),
    });
}

/**
 * Escreve "Página X de Y" no canto inferior direito e a verificação (código, QR) à esquerda,
 * em todas as páginas.
 * @param {Object} doc - Documento jsPDF.
 * @param {Object} [verificacao] - Código e QR (ou aviso) de card-notas-ficha-aluno-verificacao.js.
 */
function desenharRodapeLayoutFicha(doc, verificacao) {
    const total = doc.internal.getNumberOfPages();
    for (let pagina = 1; pagina <= total; pagina += 1) {
        doc.setPage(pagina);
        definirFonteLayoutFicha(doc, { estilo: 'normal', tamanho: 7.5,
            cor: COR_ROTULO_LAYOUT_FICHA });
        doc.text('Página ' + pagina + ' de ' + total, X_DIREITA_LAYOUT_FICHA,
            Y_RODAPE_LAYOUT_FICHA, { align: 'right' });
        window.desenharVerificacaoRodapeFichaNotas?.(doc, verificacao);
    }
}
