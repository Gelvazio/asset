// Modal "⏰ Prazo de resposta" (aberto pelo botão ⏰ Prazo do formulário Editar atividade).
// Define atividade.encerra_em de UMA atividade (RPC definir_prazo_atividade) ou um horário padrão
// para TODAS as atividades da matéria (RPC definir_prazo_padrao_materia). Só professor (o banco
// confere). Horário sempre de Brasília (-03:00), nunca o fuso do navegador.
// Depende de: js/supabase.js (SUPABASE, sbH, sbGet) e popup.js (mostrarPopup, confirmarPopup).
// Expõe: window.abrirModalPrazoAtividade({ idAtividade, aoMudar }).

const ROTA_PRAZO_UNICO = '/rest/v1/rpc/definir_prazo_atividade';
const ROTA_PRAZO_PADRAO = '/rest/v1/rpc/definir_prazo_padrao_materia';
const FUSO_BRASILIA = 'America/Sao_Paulo';
const SUFIXO_BRASILIA = '-03:00';
const SEGUNDOS_PADRAO_PRAZO = ':00';
const CLASSE_FUNDO_PRAZO = 'prazo-fundo';
const TITULO_PRAZO = '⏰ Prazo de resposta';
const TEXTO_SEM_PRAZO = 'Sem prazo';
const TEXTO_EXPLICACAO_PADRAO = 'O prazo de cada atividade vira o dia dela (campo Data) ' +
    'neste horário. Atividade sem data fica de fora.';
const MSG_FALTA_DATA_HORA = 'Informe a data e a hora do prazo.';
const MSG_FALTA_HORA = 'Informe o horário padrão.';
const MSG_PRAZO_SALVO = 'Prazo da atividade salvo.';
const MSG_PRAZO_REMOVIDO = 'Prazo da atividade removido.';
const MSG_CONFIRMAR_PADRAO = 'Aplicar este horário como prazo das atividades da matéria?';
const MSG_ERRO_PRAZO = 'Não foi possível gravar o prazo: ';
const FORMATO_DATA_HORA_PRAZO = {
    timeZone: FUSO_BRASILIA, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
};

/**
 * Converte o ISO do banco em "dd/mm/aaaa HH:MM (Brasília)".
 * @param {string|null} iso - Valor de encerra_em.
 * @returns {string} Texto do prazo atual, ou "Sem prazo".
 */
function formatarPrazoBrasilia(iso) {
    if (!iso) return TEXTO_SEM_PRAZO;
    const texto = new Intl.DateTimeFormat('pt-BR', FORMATO_DATA_HORA_PRAZO).format(new Date(iso));
    return texto.replace(',', '') + ' (Brasília)';
}

/**
 * Converte o ISO do banco no valor de um datetime-local, em Brasília.
 * @param {string|null} iso - Valor de encerra_em.
 * @returns {string} "aaaa-mm-ddTHH:MM", ou vazio sem prazo.
 */
function isoParaCampoBrasilia(iso) {
    if (!iso) return '';
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA',
        { ...FORMATO_DATA_HORA_PRAZO, month: '2-digit' }).formatToParts(new Date(iso))
        .map((parte) => [parte.type, parte.value]));
    return partes.year + '-' + partes.month + '-' + partes.day + 'T' + partes.hour + ':' +
        partes.minute;
}

/**
 * Chama uma RPC do banco com o JWT do professor.
 * @param {string} rota - Caminho da RPC em /rest/v1/rpc/.
 * @param {Object} corpo - Parâmetros da RPC.
 * @returns {Promise<*>} Resposta já convertida de JSON.
 * @throws {Error} Com a mensagem limpa do banco se a chamada for recusada.
 */
async function chamarRpcPrazo(rota, corpo) {
    const resposta = await fetch(SUPABASE.URL + rota, {
        method: 'POST',
        headers: await sbH(),
        body: JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    if (resposta.ok) return texto ? JSON.parse(texto) : null;

    let mensagem = texto;
    try { mensagem = JSON.parse(texto).message || texto; } catch (erro) { /* texto puro */ }
    throw new Error(mensagem || 'HTTP ' + resposta.status);
}

/**
 * Cria um elemento com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoPrazo(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto) elemento.textContent = texto;
    return elemento;
}

/**
 * Cria um botão do modal.
 * @param {string} texto - Texto do botão.
 * @param {string} [classe] - Modificador de estilo.
 * @returns {HTMLButtonElement} Botão type=button.
 */
function criarBotaoPrazo(texto, classe) {
    const botao = criarElementoPrazo('button', 'prazo-btn ' + (classe || ''), texto);
    botao.type = 'button';
    return botao;
}

/**
 * Cria um campo com rótulo e controle.
 * @param {string} rotulo - Texto do rótulo.
 * @param {string} tipo - Tipo do input.
 * @returns {{campo: HTMLLabelElement, controle: HTMLInputElement}} Rótulo e input.
 */
function criarCampoPrazo(rotulo, tipo) {
    const campo = criarElementoPrazo('label', 'prazo-campo');
    const controle = criarElementoPrazo('input', 'prazo-controle');
    controle.type = tipo;
    campo.append(criarElementoPrazo('span', 'prazo-rotulo', rotulo), controle);
    return { campo, controle };
}

/**
 * Monta a seção "Só esta atividade".
 * @returns {{secao: HTMLElement, entrada: HTMLInputElement, salvar: HTMLButtonElement,
 *   remover: HTMLButtonElement}} Seção e seus controles.
 */
function montarSecaoUnicaPrazo() {
    const secao = criarElementoPrazo('section', 'prazo-secao');
    const { campo, controle } = criarCampoPrazo('Data e hora (Brasília)', 'datetime-local');
    const salvar = criarBotaoPrazo('Salvar prazo desta atividade', 'prazo-btn--principal');
    const remover = criarBotaoPrazo('Remover prazo', 'prazo-btn--perigo');
    const acoes = criarElementoPrazo('div', 'prazo-acoes');
    acoes.append(salvar, remover);
    secao.append(criarElementoPrazo('h3', 'prazo-subtitulo', 'Só esta atividade'), campo, acoes);
    return { secao, entrada: controle, salvar, remover };
}

/**
 * Monta a seção do horário padrão da matéria.
 * @returns {{secao: HTMLElement, hora: HTMLInputElement, sobrescrever: HTMLInputElement,
 *   aplicar: HTMLButtonElement}} Seção e seus controles.
 */
function montarSecaoPadraoPrazo() {
    const secao = criarElementoPrazo('section', 'prazo-secao');
    const { campo, controle: hora } = criarCampoPrazo('Horário (Brasília)', 'time');
    const caixa = criarCampoPrazo('Trocar também os prazos que já existem', 'checkbox');
    caixa.campo.classList.add('prazo-campo--linha');
    const aplicar = criarBotaoPrazo('Aplicar horário padrão', 'prazo-btn--principal');
    secao.append(
        criarElementoPrazo('h3', 'prazo-subtitulo',
            'Horário padrão para todas as atividades desta matéria'),
        campo, caixa.campo, criarElementoPrazo('p', 'prazo-texto', TEXTO_EXPLICACAO_PADRAO),
        aplicar);
    return { secao, hora, sobrescrever: caixa.controle, aplicar };
}

/**
 * Monta o modal inteiro e o anexa à página.
 * @returns {Object} Referências: fundo, atual, fechar, unica e padrao.
 */
function montarModalPrazo() {
    const fundo = criarElementoPrazo('div', CLASSE_FUNDO_PRAZO);
    const caixa = criarElementoPrazo('div', 'prazo-caixa');
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', TITULO_PRAZO);
    const fechar = criarBotaoPrazo('✕ Fechar', 'prazo-btn--fechar');
    const cabecalho = criarElementoPrazo('div', 'prazo-cabecalho');
    cabecalho.append(criarElementoPrazo('h2', 'prazo-titulo', TITULO_PRAZO), fechar);
    const atual = criarElementoPrazo('p', 'prazo-atual');
    const unica = montarSecaoUnicaPrazo();
    const padrao = montarSecaoPadraoPrazo();
    caixa.append(cabecalho, atual, unica.secao, padrao.secao);
    fundo.append(caixa);
    document.body.append(fundo);
    return { fundo, atual, fechar, unica, padrao };
}

/**
 * Resumo do resultado do horário padrão.
 * @param {{aplicadas: number, sem_data: number, mantidas: number}} resultado - Resposta da RPC.
 * @returns {string} Texto para o popup.
 */
function resumirResultadoPadrao(resultado) {
    return 'Aplicadas: ' + resultado.aplicadas + '\nSem data (ficaram de fora): ' +
        resultado.sem_data + '\nMantidas (já tinham prazo): ' + resultado.mantidas;
}

/**
 * Liga os botões do modal às ações, desabilitando-os enquanto grava.
 * @param {Object} modal - Referências do modal.
 * @param {{idAtividade: number, aoMudar: Function}} contexto - Atividade e aviso de mudança.
 * @param {Function} atualizar - Relê o prazo atual do banco.
 */
function ligarAcoesPrazo(modal, contexto, atualizar) {
    const botoes = [modal.unica.salvar, modal.unica.remover, modal.padrao.aplicar];
    const executar = async (acao) => {
        botoes.forEach((botao) => { botao.disabled = true; });
        try {
            const mensagem = await acao();
            if (!mensagem) return;
            await atualizar();
            await mostrarPopup(mensagem, { tipo: 'sucesso', titulo: TITULO_PRAZO });
            if (contexto.aoMudar) contexto.aoMudar();
        } catch (erro) {
            await mostrarPopup(MSG_ERRO_PRAZO + erro.message, { tipo: 'erro' });
        } finally {
            botoes.forEach((botao) => { botao.disabled = false; });
        }
    };
    modal.unica.salvar.addEventListener('click', () =>
        executar(() => salvarPrazoUnico(modal, contexto.idAtividade)));
    modal.unica.remover.addEventListener('click', () =>
        executar(() => gravarPrazoUnico(contexto.idAtividade, null, MSG_PRAZO_REMOVIDO)));
    modal.padrao.aplicar.addEventListener('click', () =>
        executar(() => aplicarPadraoPrazo(modal, contexto.idAtividade)));
}

/**
 * Grava o prazo de uma atividade.
 * @param {number} idAtividade - Id da atividade.
 * @param {string|null} encerraEm - ISO com fuso, ou null para remover.
 * @param {string} mensagem - Texto de sucesso.
 * @returns {Promise<string>} A mensagem de sucesso.
 */
async function gravarPrazoUnico(idAtividade, encerraEm, mensagem) {
    await chamarRpcPrazo(ROTA_PRAZO_UNICO, { p_atividade: idAtividade, p_encerra_em: encerraEm });
    return mensagem;
}

/**
 * Valida o campo datetime-local e grava o prazo da atividade.
 * @param {Object} modal - Referências do modal.
 * @param {number} idAtividade - Id da atividade.
 * @returns {Promise<string|null>} Mensagem de sucesso, ou null se faltou o campo.
 */
async function salvarPrazoUnico(modal, idAtividade) {
    const valor = modal.unica.entrada.value;
    if (!valor) {
        await mostrarPopup(MSG_FALTA_DATA_HORA, { tipo: 'aviso' });
        return null;
    }
    const iso = valor + (valor.length === 16 ? SEGUNDOS_PADRAO_PRAZO : '') + SUFIXO_BRASILIA;
    return gravarPrazoUnico(idAtividade, iso, MSG_PRAZO_SALVO);
}

/**
 * Pergunta e aplica o horário padrão em toda a matéria da atividade.
 * @param {Object} modal - Referências do modal.
 * @param {number} idAtividade - Id da atividade (define a matéria).
 * @returns {Promise<string|null>} Resumo do resultado, ou null se cancelou ou faltou o campo.
 */
async function aplicarPadraoPrazo(modal, idAtividade) {
    const hora = modal.padrao.hora.value;
    if (!hora) {
        await mostrarPopup(MSG_FALTA_HORA, { tipo: 'aviso' });
        return null;
    }
    const confirmou = await confirmarPopup(MSG_CONFIRMAR_PADRAO,
        { tipo: 'aviso', titulo: TITULO_PRAZO, textoConfirmar: 'Aplicar' });
    if (!confirmou) return null;

    const resultado = await chamarRpcPrazo(ROTA_PRAZO_PADRAO, {
        p_atividade: idAtividade,
        p_hora: hora + (hora.length === 5 ? SEGUNDOS_PADRAO_PRAZO : ''),
        p_sobrescrever: modal.padrao.sobrescrever.checked,
    });
    return resumirResultadoPadrao(resultado);
}

/**
 * Abre o modal de prazo de uma atividade. Não abre duplicado.
 * @param {{idAtividade: number, aoMudar?: Function}} opcoes - Atividade e aviso de mudança.
 */
async function abrirModalPrazoAtividade({ idAtividade, aoMudar }) {
    if (document.querySelector('.' + CLASSE_FUNDO_PRAZO)) return;

    const modal = montarModalPrazo();
    const fechar = () => {
        document.removeEventListener('keydown', aoTeclar, true);
        modal.fundo.remove();
    };
    function aoTeclar(evento) {
        if (evento.key !== 'Escape') return;
        evento.stopImmediatePropagation();
        fechar();
    }
    const atualizar = async () => {
        const [atividade] = await sbGet('atividade',
            'select=id,encerra_em,data_atividade&id=eq.' + idAtividade);
        const encerraEm = atividade?.encerra_em || null;
        modal.atual.textContent = 'Prazo atual: ' + formatarPrazoBrasilia(encerraEm);
        modal.unica.entrada.value = isoParaCampoBrasilia(encerraEm);
    };
    modal.fechar.addEventListener('click', fechar);
    modal.fundo.addEventListener('click', (evento) => {
        if (evento.target === modal.fundo) fechar();
    });
    document.addEventListener('keydown', aoTeclar, true);
    ligarAcoesPrazo(modal, { idAtividade, aoMudar }, atualizar);
    try {
        await atualizar();
    } catch (erro) {
        modal.atual.textContent = MSG_ERRO_PRAZO + erro.message;
    }
}

window.abrirModalPrazoAtividade = abrirModalPrazoAtividade;
