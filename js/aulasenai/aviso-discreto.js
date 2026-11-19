// Aviso discreto (toast) reutilizável em qualquer página: uma faixa pequena no canto de baixo,
// que some sozinha, não rouba o foco e não bloqueia a tela (no lugar do popup quando a mensagem
// é só informativa). Leitores de tela anunciam o texto (role="status", aria-live="polite").
// Uso: mostrarAvisoDiscreto('Atividade X foi atualizada.', { duracaoMs: 4000 });
// Um aviso por vez: um novo troca o texto e reinicia o tempo. O CSS (assets/css/aviso-discreto.css)
// é carregado sozinho, a partir da pasta deste script; com prefers-reduced-motion não há animação.
// Criado para o tempo real das atividades (REALTIME-STATUS-ATIVIDADES.14).

const CLASSE_AVISO_DISCRETO = 'aviso-discreto';
const CLASSE_AVISO_DISCRETO_VISIVEL = 'aviso-discreto--visivel';
const DURACAO_AVISO_DISCRETO_MS = 4000;
const RAIZ_AVISO_DISCRETO = document.currentScript ? document.currentScript.src : location.href;
let temporizadorAvisoDiscreto = null;

/**
 * Garante que o CSS do aviso esteja na página (uma única vez).
 */
function garantirEstiloAvisoDiscreto() {
    if (document.querySelector('link[data-aviso-discreto]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/aviso-discreto.css', RAIZ_AVISO_DISCRETO).href;
    link.dataset.avisoDiscreto = 'sim';
    document.head.appendChild(link);
}

/**
 * Devolve o elemento do aviso, criando-o na primeira vez (fica na página, escondido).
 * @returns {HTMLElement} Região do aviso.
 */
function obterElementoAvisoDiscreto() {
    let aviso = document.querySelector('.' + CLASSE_AVISO_DISCRETO);
    if (aviso) return aviso;

    aviso = document.createElement('div');
    aviso.className = CLASSE_AVISO_DISCRETO;
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    aviso.setAttribute('aria-atomic', 'true');
    document.body.appendChild(aviso);
    return aviso;
}

/**
 * Mostra um aviso curto e não intrusivo, que some sozinho.
 * @param {string} mensagem - Texto do aviso (em português).
 * @param {{duracaoMs?: number}} [opcoes] - Tempo na tela (padrão 4 s).
 */
function mostrarAvisoDiscreto(mensagem, opcoes) {
    if (!document.body || !mensagem) return;

    garantirEstiloAvisoDiscreto();
    const aviso = obterElementoAvisoDiscreto();
    aviso.textContent = String(mensagem);
    // Próximo quadro: o CSS já carregou a posição inicial e a transição acontece.
    requestAnimationFrame(() => aviso.classList.add(CLASSE_AVISO_DISCRETO_VISIVEL));
    clearTimeout(temporizadorAvisoDiscreto);
    temporizadorAvisoDiscreto = setTimeout(() => {
        aviso.classList.remove(CLASSE_AVISO_DISCRETO_VISIVEL);
    }, opcoes?.duracaoMs || DURACAO_AVISO_DISCRETO_MS);
}

window.mostrarAvisoDiscreto = mostrarAvisoDiscreto;
