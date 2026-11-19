// Atividade Dinâmica (tarefa #517): desenho SVG da tela "antes" e "depois" no card SOLUÇÃO DO
// PROFESSOR. Só desenha; não busca dados nem conhece o banco. Coordenadas da tela: 360 x 640,
// origem no centro e y para cima (o SVG inverte o y). Regra: docs/regras/atividade-dinamica.md

const NAMESPACE_SVG_SOLUCAO = 'http://www.w3.org/2000/svg';
const LARGURA_TELA_SOLUCAO = 360;
const ALTURA_TELA_SOLUCAO = 640;
const TAMANHO_FONTE_SOLUCAO = 11;
const COR_TEXTO_ESCURO_SOLUCAO = '#1a202c';
const COR_TEXTO_CLARO_SOLUCAO = '#ffffff';
const COR_FUNDO_TELA_SOLUCAO = '#ffffff';
const COR_BORDA_TELA_SOLUCAO = '#cbd5e0';
const LIMITE_CLARO_SOLUCAO = 150;
const ESPESSURA_CONTORNO_SOLUCAO = 2;

/**
 * Cria um elemento SVG com atributos.
 * @param {string} etiqueta - Nome da tag SVG.
 * @param {Object} [atributos] - Atributos a aplicar.
 * @returns {SVGElement} Elemento criado.
 */
function criarNoSvgSolucao(etiqueta, atributos = {}) {
    const no = document.createElementNS(NAMESPACE_SVG_SOLUCAO, etiqueta);
    Object.entries(atributos).forEach(([nome, valor]) => no.setAttribute(nome, String(valor)));
    return no;
}

/**
 * Escolhe texto claro ou escuro para ficar legível sobre a cor de preenchimento.
 * @param {string} cor - Cor no formato #rrggbb.
 * @returns {string} Cor do texto.
 */
function escolherCorTextoSolucao(cor) {
    const hexadecimal = String(cor).replace('#', '');
    if (hexadecimal.length !== 6) return COR_TEXTO_ESCURO_SOLUCAO;

    const [vermelho, verde, azul] = [0, 2, 4].map((i) => parseInt(hexadecimal.slice(i, i + 2), 16));
    const brilho = (vermelho * 299 + verde * 587 + azul * 114) / 1000;
    return brilho > LIMITE_CLARO_SOLUCAO ? COR_TEXTO_ESCURO_SOLUCAO : COR_TEXTO_CLARO_SOLUCAO;
}

/**
 * Cria a forma geométrica de um elemento da tela.
 * @param {Object} elemento - { forma, x, y, largura, altura, cor, preenchido, raio }.
 * @returns {SVGElement} Retângulo, elipse ou triângulo.
 */
function criarFormaSolucao(elemento) {
    const { forma, x, largura, altura, cor, preenchido, raio } = elemento;
    const centroY = -elemento.y;
    const estilo = {
        fill: preenchido ? cor : 'none', stroke: cor, 'stroke-width': ESPESSURA_CONTORNO_SOLUCAO,
    };
    if (forma === 'circulo') {
        return criarNoSvgSolucao('ellipse',
            { cx: x, cy: centroY, rx: largura / 2, ry: altura / 2, ...estilo });
    }
    if (forma === 'triangulo') {
        const pontos = [[x, centroY - altura / 2], [x - largura / 2, centroY + altura / 2],
            [x + largura / 2, centroY + altura / 2]].map((ponto) => ponto.join(',')).join(' ');
        return criarNoSvgSolucao('polygon', { points: pontos, ...estilo });
    }
    return criarNoSvgSolucao('rect', { x: x - largura / 2, y: centroY - altura / 2,
        width: largura, height: altura, rx: raio || 0, ...estilo });
}

/**
 * Cria o rótulo centralizado de um elemento (texto sempre via textContent).
 * @param {Object} elemento - Elemento com rotulo, x, y, cor e preenchido.
 * @returns {SVGElement|null} Texto, ou null se o elemento não tem rótulo.
 */
function criarRotuloSolucao(elemento) {
    if (!elemento.rotulo) return null;

    const corTexto = elemento.preenchido
        ? escolherCorTextoSolucao(elemento.cor) : elemento.cor;
    const texto = criarNoSvgSolucao('text', { x: elemento.x, y: -elemento.y,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': TAMANHO_FONTE_SOLUCAO, fill: corTexto });
    texto.textContent = elemento.rotulo;
    return texto;
}

/**
 * Desenha uma tela inteira em SVG.
 * @param {Object[]} elementos - Elementos da tela, do fundo para a frente.
 * @param {string} descricao - Texto alternativo para leitores de tela.
 * @returns {SVGElement} SVG pronto para inserir na página.
 */
function criarSvgTelaSolucao(elementos, descricao) {
    const svg = criarNoSvgSolucao('svg', { class: 'dinamica__solucao-svg', role: 'img',
        'aria-label': descricao,
        viewBox: [-LARGURA_TELA_SOLUCAO / 2, -ALTURA_TELA_SOLUCAO / 2,
            LARGURA_TELA_SOLUCAO, ALTURA_TELA_SOLUCAO].join(' ') });
    svg.append(criarNoSvgSolucao('rect', { x: -LARGURA_TELA_SOLUCAO / 2,
        y: -ALTURA_TELA_SOLUCAO / 2, width: LARGURA_TELA_SOLUCAO, height: ALTURA_TELA_SOLUCAO,
        fill: COR_FUNDO_TELA_SOLUCAO, stroke: COR_BORDA_TELA_SOLUCAO }));
    elementos.forEach((elemento) => {
        svg.append(criarFormaSolucao(elemento));
        const rotulo = criarRotuloSolucao(elemento);
        if (rotulo) svg.append(rotulo);
    });
    return svg;
}

/**
 * Cria uma figura com legenda para uma das telas.
 * @param {Object[]} elementos - Elementos da tela.
 * @param {string} legenda - Legenda da figura (Antes ou Depois).
 * @returns {HTMLElement} Figura com o SVG.
 */
function criarFiguraTelaSolucao(elementos, legenda) {
    const figura = document.createElement('figure');
    figura.className = 'dinamica__solucao-figura';
    const rotulo = document.createElement('figcaption');
    rotulo.textContent = legenda;
    figura.append(criarSvgTelaSolucao(elementos, 'Tela ' + legenda.toLowerCase()), rotulo);
    return figura;
}

/**
 * Monta as duas telas lado a lado; sem a lista "antes", mostra só o "depois".
 * @param {Object[]|null} antes - Elementos da tela original, ou null se indisponível.
 * @param {Object[]} depois - Elementos da tela redesenhada.
 * @returns {HTMLElement} Bloco com as figuras.
 */
function criarComparacaoTelasSolucao(antes, depois) {
    const bloco = document.createElement('div');
    bloco.className = 'dinamica__solucao-telas';
    if (Array.isArray(antes) && antes.length) {
        bloco.append(criarFiguraTelaSolucao(antes, 'Antes'));
    }
    bloco.append(criarFiguraTelaSolucao(depois, 'Depois'));
    return bloco;
}
