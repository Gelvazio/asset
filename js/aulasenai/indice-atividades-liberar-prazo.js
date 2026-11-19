// Botão "LIBERAR ATIVIDADE" no índice de atividades (só professor), ao lado da atividade que tem
// prazo (atividade.encerra_em, ex.: a oficina de UI/UX id 235, bloqueada depois das 17:05 de
// 10/11/2026). Liga/desliga atividade.prazo_liberado pela RPC liberar_atividade_prazo (só
// professor, RLS no banco): liberada, todos os alunos voltam a gravar e entregar.
// Depende de: js/supabase.js (SUPABASE, sbH, sbGet), popup.js (mostrarPopup) e de
// indice-atividades-bloqueio.js (caminhoDoLink, usuarioEhProfessorBloqueio), carregados antes.

const SELETOR_CARD_LIBERAR_PRAZO = 'article.aula';
const SELETOR_LINK_LIBERAR_PRAZO = 'a.btn';
const SELETOR_CONTROLES_LIBERAR_PRAZO =
    '.interruptor-atividade, .crud-editar-atividade, .crud-desvincular-atividade';
const CLASSE_BOTAO_LIBERAR_PRAZO = 'liberar-prazo-atividade';
const CLASSE_BOTAO_LIBERAR_PRAZO_ATIVO = 'liberar-prazo-atividade--liberada';
const ROTA_LIBERAR_PRAZO = '/rest/v1/rpc/liberar_atividade_prazo';
const FILTRO_ATIVIDADES_COM_PRAZO =
    'select=id,pagina,prazo_liberado&encerra_em=not.is.null';
const EVENTO_CARDS_LIBERAR_PRAZO = 'cards-aula-montados';
const TEXTO_LIBERAR_PRAZO = '🔓 LIBERAR ATIVIDADE';
const TEXTO_LIBERADA_PRAZO = '✅ ATIVIDADE LIBERADA (clique para bloquear)';
const MSG_LIBERADA_PRAZO = 'Atividade liberada: os alunos voltam a responder e entregar.';
const MSG_BLOQUEADA_PRAZO = 'Atividade bloqueada de novo pelo prazo.';
const MSG_ERRO_LIBERAR_PRAZO = 'Não foi possível liberar a atividade: ';
const ESPERA_REPOSICIONAR_PRAZO_MS = 200;

/**
 * Grava a liberação da atividade depois do prazo (só o professor consegue, pela RPC).
 * @param {number} idAtividade - Id da atividade.
 * @param {boolean} liberar - true libera depois do prazo; false volta a bloquear.
 * @throws {Error} Com a mensagem do banco se a gravação for recusada.
 */
async function gravarLiberacaoPrazo(idAtividade, liberar) {
    const resposta = await fetch(SUPABASE.URL + ROTA_LIBERAR_PRAZO, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify({ p_atividade: idAtividade, p_liberar: liberar }),
    });
    if (resposta.ok) return;

    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.message || 'HTTP ' + resposta.status);
}

/**
 * Atualiza o texto e a cor do botão conforme a atividade está liberada ou não.
 * @param {HTMLButtonElement} botao - Botão da atividade.
 * @param {boolean} liberada - Estado atual (prazo_liberado).
 */
function pintarBotaoLiberarPrazo(botao, liberada) {
    botao.textContent = liberada ? TEXTO_LIBERADA_PRAZO : TEXTO_LIBERAR_PRAZO;
    botao.classList.toggle(CLASSE_BOTAO_LIBERAR_PRAZO_ATIVO, liberada);
}

/**
 * Cria o botão LIBERAR ATIVIDADE de uma atividade com prazo.
 * @param {{id: number, prazo_liberado: boolean}} atividade - Dados da atividade.
 * @returns {HTMLButtonElement} Botão pronto (alterna liberada/bloqueada ao clicar).
 */
function criarBotaoLiberarPrazo(atividade) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_LIBERAR_PRAZO;
    let liberada = Boolean(atividade.prazo_liberado);
    pintarBotaoLiberarPrazo(botao, liberada);
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        try {
            await gravarLiberacaoPrazo(atividade.id, !liberada);
            liberada = !liberada;
            pintarBotaoLiberarPrazo(botao, liberada);
            await mostrarPopup(liberada ? MSG_LIBERADA_PRAZO : MSG_BLOQUEADA_PRAZO,
                { tipo: 'sucesso' });
        } catch (erro) {
            await mostrarPopup(MSG_ERRO_LIBERAR_PRAZO + erro.message, { tipo: 'erro' });
        }
        botao.disabled = false;
    });
    return botao;
}

/**
 * Põe o botão depois do último controle (ON/OFF, ✏️, −) da atividade, ou do link dela.
 * Não mexe se já estiver no lugar certo (evita laço com o MutationObserver).
 * @param {HTMLAnchorElement} link - Botão da atividade no card.
 * @param {HTMLButtonElement} botao - Botão LIBERAR ATIVIDADE.
 */
function posicionarBotaoLiberarPrazo(link, botao) {
    let ultimo = link;
    while (ultimo.nextElementSibling?.matches(SELETOR_CONTROLES_LIBERAR_PRAZO)) {
        ultimo = ultimo.nextElementSibling;
    }
    if (ultimo.nextElementSibling !== botao) ultimo.after(botao);
}

/**
 * Monta (ou reposiciona) o botão nas atividades com prazo de todos os cards do índice.
 * @param {Object[]} atividades - Atividades com prazo (id, pagina, prazo_liberado).
 * @param {Map<string, HTMLButtonElement>} botoes - Botões já criados, por página.
 */
function montarBotoesLiberarPrazo(atividades, botoes) {
    document.querySelectorAll(SELETOR_CARD_LIBERAR_PRAZO).forEach((card) => {
        card.querySelectorAll(SELETOR_LINK_LIBERAR_PRAZO).forEach((link) => {
            const pagina = caminhoDoLink(link);
            const atividade = atividades.find((item) => item.pagina === pagina);
            if (!atividade) return;

            if (!botoes.has(pagina)) botoes.set(pagina, criarBotaoLiberarPrazo(atividade));
            posicionarBotaoLiberarPrazo(link, botoes.get(pagina));
        });
    });
}

/**
 * Inicia o botão: só para professor; refaz quando os cards são remontados e reposiciona quando
 * outros módulos acrescentam ON/OFF, ✏️ ou − depois do carregamento.
 */
async function iniciarLiberarPrazo() {
    try {
        if (!(await usuarioEhProfessorBloqueio())) return;

        const atividades = await sbGet('atividade', FILTRO_ATIVIDADES_COM_PRAZO);
        if (!atividades.length) return;

        const botoes = new Map();
        let agendado = null;
        const remontar = () => {
            clearTimeout(agendado);
            agendado = setTimeout(() => montarBotoesLiberarPrazo(atividades, botoes),
                ESPERA_REPOSICIONAR_PRAZO_MS);
        };
        document.addEventListener(EVENTO_CARDS_LIBERAR_PRAZO, remontar);
        new MutationObserver(remontar).observe(document.body, { childList: true, subtree: true });
        remontar();
    } catch (erro) {
        console.warn('Botão LIBERAR ATIVIDADE indisponível:', erro.message);
    }
}

iniciarLiberarPrazo();
