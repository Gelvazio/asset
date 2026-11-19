// Status das atividades em tempo real (Supabase Realtime): avisa a página quando o professor
// ativa, desativa ou bloqueia uma atividade (ou bloqueia a aula) da matéria aberta.
// Tarefas REALTIME-STATUS-ATIVIDADES.7 (módulo e canal), .8 (reconexão e releitura de reserva)
// e .9 (aba oculta e saída da página). Decisões: docs/realtime-atividades.md (item 3).
//
// Como funciona: assina UM canal por página, 'atividades-status:<materia_id>', em
// postgres_changes (INSERT e UPDATE) da tabela de sinal public.atividade_status_sinal com o filtro
// materia_id=eq.<materia_id>. O sinal não traz dado do aluno nem da atividade: só avisa "algo
// mudou nesta matéria". Quem escuta relê o estado pelo caminho normal (REST com RLS).
//
// Como usar (o módulo nunca cria cliente nem tem chave; recebe o da página):
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
//   <script src="<raiz>/js/supabase.js" defer></script>
//   <script src="<raiz>/assets/js/realtime-atividades.js" defer></script>   (uma vez por página)
//
//   const controle = window.RealtimeAtividades.iniciar({
//       cliente: obterClienteSupabase(),   // js/supabase.js
//       materiaId: materia.id,             // ex.: descobrirMateriaDoIndice (indice-aula-data.js)
//   });
//   document.addEventListener('atividades-status-alterado', (evento) => {
//       const { materiaId, versao, origem } = evento.detail;
//       // origem: 'realtime' | 'releitura' | 'reconexao' | 'visivel' → reler e reaplicar o status
//   });
//   controle.parar();                      // opcional: fecha o canal
//
// - iniciar() é idempotente: de novo com a mesma matéria devolve o mesmo controle, sem segundo
//   canal; com outra matéria, fecha o canal anterior e abre o novo (sempre um canal por página).
// - O evento já vem com espera de 1–2 s (variação aleatória): vários avisos seguidos viram um.
// - Sem sessão (visitante anon) não assina: a página continua como hoje.
// - Canal caído (CLOSED, CHANNEL_ERROR, TIMED_OUT): reassina com espera crescente e dispara
//   origem 'releitura' a cada 60 s só enquanto desconectado; ao voltar, origem 'reconexao'.
// - Aba oculta por mais de 5 min: fecha o canal; ao voltar, reassina e dispara origem 'visivel'.
//   Em pagehide o canal é removido (removeChannel); volta do cache do navegador = 'visivel'.
// - window.RealtimeAtividades.ATIVO = false desliga tudo (interruptor do plano de volta, .23):
//   iniciar() não faz nada e as telas ficam com a releitura de sempre ao abrir.
// - window.RealtimeAtividades.estado(): 'conectado' | 'reconectando' | 'offline' | 'desligado'.

const EVENTO_STATUS_ATIVIDADES = 'atividades-status-alterado';
const PREFIXO_CANAL_STATUS = 'atividades-status:';
const TABELA_SINAL_STATUS = 'atividade_status_sinal';
const ESPERA_AVISO_MIN_MS = 1000;
const ESPERA_AVISO_VARIACAO_MS = 1000;
const RELEITURA_RESERVA_MS = 60 * 1000;
const REASSINAR_INICIAL_MS = 2000;
const REASSINAR_MAXIMO_MS = 60 * 1000;
const FECHAR_ABA_OCULTA_MS = 5 * 60 * 1000;
const STATUS_CANAL_CAIDO = ['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'];

// Estado único do módulo (um canal por página).
const rtAtividades = {
    cliente: null,
    materiaId: null,
    canal: null,
    geracao: 0,             // muda a cada canal aberto/fechado; descarta retorno de canal antigo
    situacao: 'desligado',
    jaConectou: false,      // houve SUBSCRIBED desde o iniciar (para saber se é reconexão)
    origemAoConectar: null, // 'reconexao' ou 'visivel' a disparar no próximo SUBSCRIBED
    pausado: false,         // canal fechado pela aba oculta ou pelo pagehide
    tentativas: 0,
    ultimaVersao: null,
    aviso: { temporizador: null, origem: null },
    temporizadorReassinar: null,
    temporizadorReleitura: null,
    temporizadorOculta: null,
    controle: null,
    ouvintesLigados: false,
    removendo: Promise.resolve(), // fila de removeChannel em andamento
};

/**
 * Converte o id da matéria em número inteiro positivo.
 * @param {number|string} materiaId - Id vindo da página.
 * @returns {number|null} Id válido, ou null.
 */
function normalizarMateriaRealtime(materiaId) {
    const numero = Number(materiaId);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Dispara o evento da página com o que se sabe da última mudança.
 * @param {string} origem - 'realtime' | 'releitura' | 'reconexao' | 'visivel'.
 */
function dispararStatusAlterado(origem) {
    const detail = { materiaId: rtAtividades.materiaId, versao: rtAtividades.ultimaVersao, origem };
    document.dispatchEvent(new CustomEvent(EVENTO_STATUS_ATIVIDADES, { detail }));
}

/**
 * Agenda o evento com espera de 1–2 s: avisos que chegam nesse intervalo viram um só evento
 * (vale a origem do último aviso). A variação espalha as releituras dos alunos no tempo.
 * @param {string} origem - Origem do aviso.
 */
function agendarAvisoStatus(origem) {
    const aviso = rtAtividades.aviso;
    aviso.origem = origem;
    if (aviso.temporizador) return;

    const espera = ESPERA_AVISO_MIN_MS + Math.random() * ESPERA_AVISO_VARIACAO_MS;
    aviso.temporizador = setTimeout(() => {
        aviso.temporizador = null;
        if (rtAtividades.materiaId) dispararStatusAlterado(aviso.origem);
    }, espera);
}

/**
 * Recebe o INSERT/UPDATE da tabela de sinal e guarda a versão.
 * @param {Object} payload - Payload do postgres_changes (só materia_id, versao, alterado_em).
 */
function aoReceberSinalStatus(payload) {
    const versao = payload?.new?.versao;
    if (versao !== undefined && versao !== null) rtAtividades.ultimaVersao = Number(versao);
    agendarAvisoStatus('realtime');
}

/**
 * Para os temporizadores de reassinatura e de releitura de reserva.
 */
function pararTemporizadoresConexao() {
    clearTimeout(rtAtividades.temporizadorReassinar);
    clearInterval(rtAtividades.temporizadorReleitura);
    rtAtividades.temporizadorReassinar = null;
    rtAtividades.temporizadorReleitura = null;
}

/**
 * Remove o canal atual do cliente (unsubscribe + removeChannel). Retornos de status do canal
 * removido são ignorados porque a geração muda. As remoções ficam em fila: o canal novo, de mesmo
 * nome, só é criado depois que o antigo saiu do cliente.
 * @returns {Promise<void>} Resolve quando não há remoção pendente.
 */
function soltarCanalStatus() {
    const { canal, cliente } = rtAtividades;
    rtAtividades.geracao += 1;
    rtAtividades.canal = null;
    if (!canal || !cliente) return rtAtividades.removendo;

    rtAtividades.removendo = rtAtividades.removendo
        .then(() => cliente.removeChannel(canal))
        .catch((erro) => console.warn('Realtime das atividades: erro ao fechar o canal.', erro));
    return rtAtividades.removendo;
}

/**
 * Lê a sessão e passa o JWT ao Realtime (o RLS do sinal exige usuário logado).
 * @param {Object} cliente - Cliente supabase-js da página.
 * @returns {Promise<boolean>} true se há usuário logado.
 */
async function prepararSessaoRealtime(cliente) {
    try {
        const { data } = await cliente.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return false;
        if (cliente.realtime?.setAuth) await cliente.realtime.setAuth(token);
        return true;
    } catch (erro) {
        console.warn('Realtime das atividades: sem sessão para assinar.', erro);
        return false;
    }
}

/**
 * Abre (ou reabre) o único canal da página para a matéria atual.
 * @returns {Promise<void>}
 */
async function assinarCanalStatus() {
    await soltarCanalStatus();
    const geracao = rtAtividades.geracao;
    const { cliente, materiaId } = rtAtividades;
    if (!cliente || !materiaId || rtAtividades.pausado) return;

    const logado = await prepararSessaoRealtime(cliente);
    if (geracao !== rtAtividades.geracao || rtAtividades.pausado) return; // parado no meio
    if (!logado) {
        rtAtividades.situacao = 'desligado';
        return;
    }

    const filtro = { schema: 'public', table: TABELA_SINAL_STATUS, filter: 'materia_id=eq.' + materiaId };
    const canal = cliente.channel(PREFIXO_CANAL_STATUS + materiaId)
        .on('postgres_changes', { event: 'INSERT', ...filtro }, aoReceberSinalStatus)
        .on('postgres_changes', { event: 'UPDATE', ...filtro }, aoReceberSinalStatus);
    rtAtividades.canal = canal;
    canal.subscribe((status, erro) => aoMudarStatusCanal(geracao, status, erro));
}

/**
 * Trata o status do canal: SUBSCRIBED liga; CLOSED, CHANNEL_ERROR e TIMED_OUT reconectam.
 * @param {number} geracao - Geração do canal que mandou o status.
 * @param {string} status - Status do supabase-js.
 * @param {Error} [erro] - Erro, quando houver.
 */
function aoMudarStatusCanal(geracao, status, erro) {
    if (geracao !== rtAtividades.geracao) return; // canal antigo, já removido
    if (status === 'SUBSCRIBED') {
        aoConectarCanal();
        return;
    }
    if (STATUS_CANAL_CAIDO.includes(status)) {
        if (erro) console.warn('Realtime das atividades: canal ' + status + '.', erro);
        aoCairCanal();
    }
}

/**
 * Canal no ar: zera a espera de reconexão, para a releitura de reserva e, se veio de uma queda
 * ou da aba oculta, pede uma releitura (pode ter mudado algo enquanto estava fora).
 */
function aoConectarCanal() {
    pararTemporizadoresConexao();
    rtAtividades.situacao = 'conectado';
    rtAtividades.tentativas = 0;
    const origem = rtAtividades.origemAoConectar || (rtAtividades.jaConectou ? 'reconexao' : null);
    rtAtividades.origemAoConectar = null;
    rtAtividades.jaConectou = true;
    if (origem) agendarAvisoStatus(origem);
}

/**
 * Canal caiu (.8): marca reconectando/offline, liga a releitura de reserva de 60 s e agenda a
 * reassinatura com espera crescente (2 s, 4 s, 8 s… até 60 s, com variação).
 */
function aoCairCanal() {
    if (rtAtividades.pausado || !rtAtividades.materiaId) return;
    rtAtividades.situacao = navigator.onLine === false ? 'offline' : 'reconectando';
    rtAtividades.origemAoConectar = 'reconexao'; // algo pode ter mudado enquanto estava fora
    ligarReleituraDeReserva();
    if (rtAtividades.temporizadorReassinar) return;

    const base = Math.min(REASSINAR_MAXIMO_MS, REASSINAR_INICIAL_MS * 2 ** rtAtividades.tentativas);
    const espera = base / 2 + Math.random() * (base / 2);
    rtAtividades.tentativas += 1;
    rtAtividades.temporizadorReassinar = setTimeout(() => {
        rtAtividades.temporizadorReassinar = null;
        assinarCanalStatus();
    }, espera);
}

/**
 * Releitura de reserva (.8): a cada 60 s, só enquanto o canal não estiver conectado.
 */
function ligarReleituraDeReserva() {
    if (rtAtividades.temporizadorReleitura) return;
    rtAtividades.temporizadorReleitura = setInterval(() => {
        if (rtAtividades.situacao === 'conectado' || rtAtividades.pausado) return;
        agendarAvisoStatus('releitura');
    }, RELEITURA_RESERVA_MS);
}

/**
 * Fecha o canal sem esquecer a matéria (aba oculta ou pagehide); retomarCanalStatus reabre.
 */
function pausarCanalStatus() {
    if (!rtAtividades.materiaId || rtAtividades.pausado) return;
    rtAtividades.pausado = true;
    rtAtividades.situacao = 'desligado';
    pararTemporizadoresConexao();
    soltarCanalStatus();
}

/**
 * Reabre o canal pausado e, ao conectar, dispara origem 'visivel'.
 */
function retomarCanalStatus() {
    if (!rtAtividades.materiaId || !rtAtividades.pausado) return;
    rtAtividades.pausado = false;
    rtAtividades.tentativas = 0;
    rtAtividades.origemAoConectar = 'visivel';
    rtAtividades.situacao = 'reconectando';
    assinarCanalStatus();
}

/**
 * Aba oculta por mais de 5 min fecha o canal; ao voltar, reabre (.9).
 */
function aoMudarVisibilidadeRealtime() {
    clearTimeout(rtAtividades.temporizadorOculta);
    rtAtividades.temporizadorOculta = null;
    if (document.visibilityState === 'hidden') {
        rtAtividades.temporizadorOculta = setTimeout(pausarCanalStatus, FECHAR_ABA_OCULTA_MS);
        return;
    }
    retomarCanalStatus();
}

/**
 * Liga, uma vez por página, os ouvintes de visibilidade, saída da página e rede.
 */
function ligarOuvintesRealtime() {
    if (rtAtividades.ouvintesLigados) return;
    rtAtividades.ouvintesLigados = true;
    document.addEventListener('visibilitychange', aoMudarVisibilidadeRealtime);
    window.addEventListener('pagehide', pausarCanalStatus);
    window.addEventListener('pageshow', (evento) => {
        if (evento.persisted) retomarCanalStatus(); // voltou do cache do navegador
    });
    window.addEventListener('offline', () => {
        if (rtAtividades.materiaId && !rtAtividades.pausado) rtAtividades.situacao = 'offline';
    });
    window.addEventListener('online', () => {
        if (rtAtividades.situacao === 'conectado' || rtAtividades.pausado) return;
        if (!rtAtividades.materiaId) return;
        clearTimeout(rtAtividades.temporizadorReassinar);
        rtAtividades.temporizadorReassinar = null;
        rtAtividades.tentativas = 0;
        assinarCanalStatus();
    });
}

/**
 * Para o módulo: fecha o canal, limpa os temporizadores e esquece a matéria.
 */
function pararRealtimeAtividades() {
    pararTemporizadoresConexao();
    clearTimeout(rtAtividades.temporizadorOculta);
    clearTimeout(rtAtividades.aviso.temporizador);
    Object.assign(rtAtividades, {
        materiaId: null, situacao: 'desligado', jaConectou: false, origemAoConectar: null,
        pausado: false, tentativas: 0, ultimaVersao: null, temporizadorOculta: null, controle: null,
    });
    rtAtividades.aviso = { temporizador: null, origem: null };
    soltarCanalStatus();
}

/**
 * Inicia o Realtime da matéria (idempotente; um canal por página).
 * @param {{cliente: Object, materiaId: number|string}} opcoes - Cliente supabase-js da página e
 *   id da matéria.
 * @returns {{parar: Function}} Controle do canal.
 */
function iniciarRealtimeAtividades({ cliente, materiaId } = {}) {
    const inerte = { parar() {} };
    if (window.RealtimeAtividades?.ATIVO !== true) return inerte;
    const id = normalizarMateriaRealtime(materiaId);
    if (!id || typeof cliente?.channel !== 'function') {
        console.warn('Realtime das atividades: cliente ou matéria inválidos; sem tempo real.');
        return inerte;
    }
    if (rtAtividades.controle && rtAtividades.materiaId === id && rtAtividades.cliente === cliente) {
        return rtAtividades.controle;
    }
    if (rtAtividades.controle) pararRealtimeAtividades(); // outra matéria: fecha o canal antigo

    const controle = {
        parar() {
            if (rtAtividades.controle === controle) pararRealtimeAtividades();
        },
    };
    Object.assign(rtAtividades, { cliente, materiaId: id, controle, situacao: 'reconectando' });
    ligarOuvintesRealtime();
    if (document.visibilityState === 'hidden') {
        rtAtividades.temporizadorOculta = setTimeout(pausarCanalStatus, FECHAR_ABA_OCULTA_MS);
    }
    assinarCanalStatus();
    return controle;
}

// Interruptor (.23): true = tempo real ligado. Migration .6 aplicada em 2026-11-09 pelo
// professor via SQL Editor. Para o plano de volta (.23): trocar para false, commit + push,
// e só então rodar database/2026-11-09-realtime-atividades-rollback.sql.
window.RealtimeAtividades = {
    ATIVO: true,
    iniciar: iniciarRealtimeAtividades,
    estado: () => rtAtividades.situacao,
};
