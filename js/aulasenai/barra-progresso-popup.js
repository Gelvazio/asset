// Janela com BARRA DE PROGRESSO para ações em lote do professor (ex.: confirmar a correção da turma
// toda). Mostra o título, a barra com "feito de total" e o texto do que está sendo feito; no fim
// troca a barra pela mensagem de resultado (✅ deu certo, ⚠️ deu certo em parte ou ❌ deu errado) e
// espera o clique em OK. Só tela: não lê nem grava nada. Estilo: assets/css/barra-progresso-popup.css
// (carregado por este arquivo). Uso: const janela = abrirBarraProgresso({ titulo });
// janela.atualizar(feito, total, texto); await janela.concluir({ tipo, mensagem }); janela.fechar().

const CLASSE_BARRA_POPUP = 'barra-progresso-popup';
const ICONES_BARRA_POPUP = { sucesso: '✅', aviso: '⚠️', erro: '❌' };
const ROTULO_OK_BARRA_POPUP = 'OK';
const PERCENTUAL_MAXIMO_BARRA_POPUP = 100;
const BASE_SCRIPTS_BARRA_POPUP = document.currentScript?.src.replace(/[^/]*$/, '') || '';

(function incluirEstiloBarraPopup() {
    if (!BASE_SCRIPTS_BARRA_POPUP) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_BARRA_POPUP + '../css/barra-progresso-popup.css';
    document.head.appendChild(link);
})();

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} classe - Classe CSS.
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoBarraPopup(tag, classe, texto = '') {
    const elemento = document.createElement(tag);
    elemento.className = classe;
    elemento.textContent = texto;
    return elemento;
}

/**
 * Abre a janela com a barra de progresso.
 * @param {{titulo: string}} dados - Título da janela.
 * @returns {{atualizar: function(number, number, string): void,
 *     concluir: function({tipo: string, mensagem: string}): Promise<void>,
 *     fechar: function(): void}} Controle da janela.
 */
function abrirBarraProgresso(dados) {
    const fundo = criarElementoBarraPopup('div', CLASSE_BARRA_POPUP);
    const caixa = criarElementoBarraPopup('div', CLASSE_BARRA_POPUP + '__caixa');
    const titulo = criarElementoBarraPopup('h3', CLASSE_BARRA_POPUP + '__titulo', dados.titulo);
    const trilho = criarElementoBarraPopup('div', CLASSE_BARRA_POPUP + '__trilho');
    const enchimento = criarElementoBarraPopup('div', CLASSE_BARRA_POPUP + '__enchimento');
    const texto = criarElementoBarraPopup('p', CLASSE_BARRA_POPUP + '__texto', 'Iniciando...');
    trilho.appendChild(enchimento);
    caixa.append(titulo, trilho, texto);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    const atualizar = (feito, total, descricao) => {
        const percentual = total
            ? Math.min(PERCENTUAL_MAXIMO_BARRA_POPUP,
                Math.round((feito / total) * PERCENTUAL_MAXIMO_BARRA_POPUP)) : 0;
        enchimento.style.width = percentual + '%';
        texto.textContent = feito + ' de ' + total + ' (' + percentual + '%)' +
            (descricao ? ' — ' + descricao : '');
    };
    const concluir = ({ tipo, mensagem }) => new Promise((resolver) => {
        trilho.remove();
        texto.textContent = (ICONES_BARRA_POPUP[tipo] || '') + ' ' + mensagem;
        texto.classList.add(CLASSE_BARRA_POPUP + '__resultado',
            CLASSE_BARRA_POPUP + '__resultado--' + tipo);
        const ok = criarElementoBarraPopup('button', CLASSE_BARRA_POPUP + '__ok',
            ROTULO_OK_BARRA_POPUP);
        ok.type = 'button';
        ok.addEventListener('click', () => {
            fundo.remove();
            resolver();
        });
        caixa.appendChild(ok);
    });
    return { atualizar, concluir, fechar: () => fundo.remove() };
}

window.abrirBarraProgresso = abrirBarraProgresso;
