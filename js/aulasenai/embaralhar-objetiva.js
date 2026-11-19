// Embaralha, só na TELA do aluno, a ordem das questões e das alternativas das atividades
// OBJETIVAS (pedido do professor, EMBARALHAR-OBJETIVAS, 2026-11-09): cada aluno vê uma ordem
// diferente, sempre a mesma para ele (PRNG mulberry32 com semente = hash de aluno + atividade).
// ⚠️ É só visual: o número do item e a letra gravados no banco continuam os ORIGINAIS
// (card.dataset.itemOriginal e li.dataset.letraOriginal); a correção, o gabarito, a visão do
// professor e os relatórios não mudam. Só o mínimo de questões (questoes-ate-minimo.js) é
// aplicado ANTES, para todos verem o mesmo conjunto de questões (1 até o mínimo).
// Desligar numa página: <body data-embaralhar-objetiva="nao">.
// Carregado por assets/js/respostas-atividade.js. Regra: docs/embaralhar-objetivas.md

const VALOR_DESLIGADO_EMBARALHAR = 'nao';
const ROTULO_ITEM_EMBARALHADO = 'ITEM ';
const DIGITOS_ITEM_EMBARALHADO = 2;
const LETRA_INICIAL_EMBARALHADA = 65; // "A"

/**
 * Hash de 32 bits (FNV-1a) de um texto, usado como semente do sorteio.
 * @param {string} texto - Texto da semente (ex.: "<aluno>:<atividade>").
 * @returns {number} Inteiro sem sinal de 32 bits.
 */
function hashEmbaralhar(texto) {
    let hash = 0x811c9dc5;
    for (let indice = 0; indice < texto.length; indice++) {
        hash ^= texto.charCodeAt(indice);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesma sequência.
 * @param {number} semente - Inteiro de 32 bits.
 * @returns {function(): number} Função que devolve números em [0, 1).
 */
function criarSorteioEmbaralhar(semente) {
    let estado = semente >>> 0;
    return () => {
        estado = (estado + 0x6d2b79f5) >>> 0;
        let valor = Math.imul(estado ^ (estado >>> 15), 1 | estado);
        valor = (valor + Math.imul(valor ^ (valor >>> 7), 61 | valor)) ^ valor;
        return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Embaralha uma cópia da lista (Fisher-Yates) com o sorteio dado.
 * @param {Array} lista - Lista original (não é alterada).
 * @param {function(): number} sorteio - Gerador em [0, 1).
 * @returns {Array} Nova lista embaralhada.
 */
function embaralharLista(lista, sorteio) {
    const copia = [...lista];
    for (let indice = copia.length - 1; indice > 0; indice--) {
        const troca = Math.floor(sorteio() * (indice + 1));
        [copia[indice], copia[troca]] = [copia[troca], copia[indice]];
    }
    return copia;
}

/**
 * Letra ORIGINAL de uma alternativa (a que vai para o banco), mesmo depois de embaralhada.
 * @param {HTMLElement} alternativa - Elemento <li> da alternativa.
 * @returns {string} Letra original (ex.: "B").
 */
function letraOriginalAlternativa(alternativa) {
    return alternativa.dataset.letraOriginal ||
        (alternativa.querySelector('.letra')?.textContent || '').replace(/\W/g, '');
}

/**
 * Letra EXIBIDA ao aluno para uma letra original da questão (sem embaralhar, é a mesma).
 * @param {{alternativas: HTMLElement[]}} item - Questão da página.
 * @param {string} letra - Letra original.
 * @returns {string} Letra que o aluno vê na tela.
 */
function letraExibidaAlternativa(item, letra) {
    const alternativa = item.alternativas.find((li) => letraOriginalAlternativa(li) === letra);
    if (!alternativa) return letra;
    return (alternativa.querySelector('.letra')?.textContent || '').replace(/\W/g, '') || letra;
}

/**
 * Embaralha as alternativas de uma questão: guarda a letra original e troca o rótulo pela letra
 * da nova posição (A, B, C...).
 * @param {{numero: string, alternativas: HTMLElement[]}} item - Questão da página.
 * @param {string} base - Semente-base (aluno + atividade).
 */
function embaralharAlternativas(item, base) {
    const lista = item.alternativas[0]?.parentElement;
    if (!lista || item.alternativas.length < 2) return;
    item.alternativas.forEach((li) => { li.dataset.letraOriginal = letraOriginalAlternativa(li); });
    const sorteio = criarSorteioEmbaralhar(hashEmbaralhar(base + ':' + item.numero));
    item.alternativas = embaralharLista(item.alternativas, sorteio);
    item.alternativas.forEach((li, posicao) => {
        const rotulo = li.querySelector('.letra');
        const letra = String.fromCharCode(LETRA_INICIAL_EMBARALHADA + posicao);
        if (rotulo) rotulo.textContent = letra + ')';
        lista.appendChild(li);
    });
}

/**
 * Põe os cards na nova ordem, nos mesmos lugares que os originais ocupavam na página.
 * @param {{card: HTMLElement}[]} originais - Questões na ordem original.
 * @param {{card: HTMLElement}[]} novos - Questões na ordem sorteada.
 */
function reposicionarCardsEmbaralhados(originais, novos) {
    const marcadores = originais.map((item) => {
        const marcador = document.createComment('questao');
        item.card.before(marcador);
        return marcador;
    });
    marcadores.forEach((marcador, posicao) => marcador.replaceWith(novos[posicao].card));
}

/**
 * Renumera o selo "ITEM NN" pela posição exibida; o número original fica no dataset.
 * @param {{numero: string, card: HTMLElement}} item - Questão da página.
 * @param {number} posicao - Posição exibida (0, 1, 2...).
 */
function renumerarQuestaoEmbaralhada(item, posicao) {
    item.rotulo = String(posicao + 1).padStart(DIGITOS_ITEM_EMBARALHADO, '0');
    item.card.dataset.itemOriginal = item.numero;
    const selo = item.card.querySelector('.aula-badge');
    if (selo) selo.textContent = ROTULO_ITEM_EMBARALHADO + item.rotulo;
}

/**
 * Embaralha questões e alternativas do aluno logado (só as questões visíveis).
 * @param {{itens: Object[], alunoId: string, atividadeId: number}} dados - Questões da página
 *     (cada uma com numero ORIGINAL, card e alternativas), aluno e atividade.
 * @returns {Object[]} Questões na ordem exibida, cada uma com `rotulo` (número exibido).
 */
function embaralharObjetivaAluno(dados) {
    const desligado = document.body.dataset.embaralharObjetiva === VALOR_DESLIGADO_EMBARALHAR;
    if (desligado || !dados.alunoId || !dados.atividadeId || dados.itens.length < 1) {
        return dados.itens;
    }
    const base = String(dados.alunoId) + ':' + String(dados.atividadeId);
    const novos = embaralharLista(dados.itens, criarSorteioEmbaralhar(hashEmbaralhar(base)));
    reposicionarCardsEmbaralhados(dados.itens, novos);
    novos.forEach((item, posicao) => {
        embaralharAlternativas(item, base);
        renumerarQuestaoEmbaralhada(item, posicao);
    });
    return novos;
}

window.EmbaralharObjetiva = {
    embaralhar: embaralharObjetivaAluno,
    letraOriginal: letraOriginalAlternativa,
    letraExibida: letraExibidaAlternativa,
};
