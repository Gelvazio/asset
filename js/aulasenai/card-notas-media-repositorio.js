// Card "Notas e média" do índice de atividades: acesso a dados (DOM do índice e Supabase).
// Notas: RPC notas_media_final (aluno logado) e notas_aluno_para_professor (professor). Config da
// média por turma: tabela media_atividade_config (RLS + JWT do usuário logado; nunca service_role).
// Confirmação da média por aluno×matéria: tabela media_finalizada.
// Depende de js/supabase.js (SUPABASE, sbGet, sbH, obterClienteSupabase).

const RPC_NOTAS_ALUNO_CARD = 'notas_media_final';
const RPC_NOTAS_PROFESSOR_CARD = 'notas_aluno_para_professor';
const RPC_MEDIA_PERGUNTAS_CARD = 'media_perguntas_turma';
const TABELA_CONFIG_CARD = 'media_atividade_config';
const SITUACAO_AGUARDANDO_CARD = 'AGUARDANDO_CORRECAO';
const PERFIL_PROFESSOR_CARD = 'PROFESSOR';
const CLASSE_DO_CARD_REPOSITORIO = 'card-notas-media';
// Provas (tipo_avaliacao 3 = objetiva, 4 = prática) que entram na tabela mesmo sem botão no card.
const TIPOS_PROVA_CARD = [3, 4];
const SEGMENTOS_CHAVE_PROVAS_CARD = 2;
const SELETOR_CARDS_CARD = 'section.grade article.aula';
const PESO_PADRAO_CARD = 1;
const CONSULTA_TURMAS_CARD = 'select=codigo,nome,turno,unidade:unidade_id(nome),favorito,' +
    'lider_aluno_id';
const COLUNAS_ALUNOS_CARD = 'id,nome,numero_chamada,na_chamada';
const ORDEM_ALUNOS_CARD = 'numero_chamada.asc.nullslast,nome.asc';
const MSG_PESO_INVALIDO_CARD = 'Peso inválido';
const MSG_SEM_CLIENTE_CARD = 'Não foi possível conectar ao banco de dados.';
const MSG_FALHA_GRAVAR_CARD = 'Não foi possível gravar a configuração da média.';
const REGEX_EMOJI_INICIAL_CARD = /^[^\p{L}\p{N}]+/u;
const TABELA_MATERIA_NOTAS = 'materia';
const TABELA_MEDIA_FINALIZADA_CARD = 'media_finalizada';
const PASTA_ATIVIDADES_CARD = 'ATIVIDADES';
const CONSULTA_MATERIA_CARD = 'select=id&descricao=ilike.';
const MSG_SEM_ALUNO_MEDIA_CARD = 'Aluno não informado para a confirmação da média.';
const MSG_SEM_MATERIA_MEDIA_CARD = 'Matéria não informada para a confirmação da média.';
const MSG_SEM_TURMA_MEDIA_CARD = 'Turma não informada para a confirmação da média.';
const MSG_FALHA_GRAVAR_MEDIA_CARD = 'Não foi possível gravar a confirmação da média.';

/**
 * Converte o href de um link no caminho gravado em atividade.pagina.
 * @param {string} href - Endereço do link.
 * @returns {string} Pathname decodificado.
 */
function caminhoDaPaginaCard(href) {
    return decodeURIComponent(new URL(href, location.href).pathname);
}

/**
 * Texto de um link sem símbolos ou emojis iniciais.
 * @param {HTMLAnchorElement} link - Link do card.
 * @returns {string} Título limpo.
 */
function tituloDoLinkCard(link) {
    const texto = link.textContent.trim();
    const semSimbolos = texto.replace(REGEX_EMOJI_INICIAL_CARD, '').trim();
    return semSimbolos || texto;
}

/**
 * Atividades (links .html) de um card de aula do índice.
 * @param {HTMLElement} card - Card `article.aula`.
 * @param {string} paginaIndice - Pathname do próprio índice.
 * @returns {{pagina: string, titulo: string, aulaId: number, rotuloAula: string}[]} Atividades.
 */
function atividadesDoCardAula(card, paginaIndice) {
    const rotuloAula = (card.querySelector('.num')?.textContent || '').trim();
    const aulaId = Number(card.dataset.aulaId);
    const atividades = [];
    card.querySelectorAll('.acoes a[href]').forEach((link) => {
        const pagina = caminhoDaPaginaCard(link.getAttribute('href'));
        const ehHtml = pagina.toLowerCase().endsWith('.html');
        if (!ehHtml || pagina === paginaIndice) return;
        atividades.push({ pagina, titulo: tituloDoLinkCard(link), aulaId, rotuloAula });
    });
    return atividades;
}

/**
 * Lê no DOM do índice as páginas de atividade de cada card de aula, na ordem do DOM.
 * @returns {{pagina: string, titulo: string, aulaId: number, rotuloAula: string}[]} Atividades
 *     sem repetir a mesma página.
 */
function lerAtividadesDoIndice() {
    const paginaIndice = decodeURIComponent(location.pathname);
    const vistas = new Set();
    const resultado = [];
    document.querySelectorAll(SELETOR_CARDS_CARD).forEach((card) => {
        const ignorar = card.hidden || card.classList.contains(CLASSE_DO_CARD_REPOSITORIO);
        if (ignorar) return;
        atividadesDoCardAula(card, paginaIndice).forEach((atividade) => {
            if (vistas.has(atividade.pagina)) return;
            vistas.add(atividade.pagina);
            resultado.push(atividade);
        });
    });
    return resultado;
}

/**
 * Lê o usuário logado e se ele é professor.
 * @returns {Promise<{logado: boolean, ehProfessor: boolean, usuarioId: string}>} Login atual.
 */
async function lerLoginCard() {
    const cliente = obterClienteSupabase();
    if (!cliente) return { logado: false, ehProfessor: false, usuarioId: '' };

    const { data } = await cliente.auth.getSession();
    const usuario = data?.session?.user;
    return { logado: Boolean(usuario), usuarioId: usuario?.id || '',
        ehProfessor: usuario?.app_metadata?.perfil === PERFIL_PROFESSOR_CARD };
}

/**
 * Código da turma do aluno logado.
 * @param {string} usuarioId - Id do aluno.
 * @returns {Promise<string>} Código da turma ou "" se não houver.
 */
async function lerTurmaDoAlunoLogado(usuarioId) {
    const linhas = await sbGet('aluno',
        'select=turma_codigo&id=eq.' + encodeURIComponent(usuarioId));
    return linhas[0]?.turma_codigo || '';
}

/**
 * Converte as linhas de uma RPC de notas em mapa por página.
 * @param {{pagina: string, nota: number|null, situacao: string}[]} linhas - Retorno da RPC.
 * @returns {Map<string, {nota: number|null, aguardando: boolean}>} Notas por página.
 */
function mapearNotasCard(linhas) {
    const mapa = new Map();
    (linhas || []).forEach((linha) => {
        const aguardando = linha.situacao === SITUACAO_AGUARDANDO_CARD;
        const nota = aguardando || linha.nota === null ? null : Number(linha.nota);
        mapa.set(linha.pagina, { nota, aguardando });
    });
    return mapa;
}

/**
 * Chama uma RPC de notas pelo cliente autenticado.
 * @param {string} funcao - Nome da função do banco.
 * @param {Object} parametros - Parâmetros da RPC.
 * @returns {Promise<Map<string, {nota: number|null, aguardando: boolean}>>} Notas por página.
 * @throws {Error} Se não houver cliente ou o banco responder com erro.
 */
async function chamarRpcNotasCard(funcao, parametros) {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error(MSG_SEM_CLIENTE_CARD);

    const { data, error } = await cliente.rpc(funcao, parametros);
    if (error) throw new Error(error.message);
    return mapearNotasCard(data);
}

/**
 * Melhores notas do aluno logado nas páginas informadas.
 * @param {string[]} paginas - Caminhos das páginas de atividade.
 * @returns {Promise<Map<string, {nota: number|null, aguardando: boolean}>>} Notas por página.
 */
async function buscarNotasDoAlunoLogado(paginas) {
    return chamarRpcNotasCard(RPC_NOTAS_ALUNO_CARD, { p_paginas: paginas });
}

/**
 * Melhores notas de um aluno, vistas pelo professor.
 * @param {string} alunoId - Id do aluno.
 * @param {string[]} paginas - Caminhos das páginas de atividade.
 * @returns {Promise<Map<string, {nota: number|null, aguardando: boolean}>>} Notas por página.
 */
async function buscarNotasParaProfessor(alunoId, paginas) {
    return chamarRpcNotasCard(RPC_NOTAS_PROFESSOR_CARD,
        { p_aluno: alunoId, p_paginas: paginas });
}

/**
 * Média de perguntas respondidas por atividade entre os alunos de uma turma (só professor).
 * @param {string} turma - Código da turma.
 * @param {string[]} paginas - Caminhos das páginas de atividade.
 * @returns {Promise<Map<string, {media: number, total: number}>>} Média e total por página.
 * @throws {Error} Se não houver cliente ou o banco responder com erro.
 */
async function buscarMediaPerguntasTurma(turma, paginas) {
    const cliente = obterClienteSupabase();
    if (!cliente) throw new Error(MSG_SEM_CLIENTE_CARD);

    const { data, error } = await cliente.rpc(RPC_MEDIA_PERGUNTAS_CARD,
        { p_turma: turma, p_paginas: paginas });
    if (error) throw new Error(error.message);

    const mapa = new Map();
    (data || []).forEach((linha) => mapa.set(linha.pagina,
        { media: Number(linha.media), total: Number(linha.total) }));
    return mapa;
}

/**
 * Ids, nomes e tipos das atividades cadastradas para as páginas informadas.
 * @param {string[]} paginas - Caminhos das páginas de atividade.
 * @returns {Promise<Map<string, {id: number, nome: string, tipo: number|null}>>} Id,
 *     nome_atividade (vem "" quando vazio) e tipo_avaliacao (null = sem tipo) por página.
 */
async function buscarIdsDasAtividades(paginas) {
    const mapa = new Map();
    if (!paginas.length) return mapa;

    const lista = paginas.map((pagina) => '"' + pagina.replace(/"/g, '') + '"').join(',');
    const linhas = await sbGet('atividade', 'select=id,pagina,nome_atividade,tipo_avaliacao' +
        '&pagina=in.(' + encodeURIComponent(lista) + ')');
    linhas.forEach((linha) => mapa.set(linha.pagina, { id: Number(linha.id),
        nome: linha.nome_atividade || '', tipo: linha.tipo_avaliacao ?? null }));
    return mapa;
}

/**
 * Chave de comparação de uma página: as duas últimas partes do caminho, em minúsculas.
 * @param {string} caminho - Caminho da página.
 * @returns {string} Pasta/arquivo em minúsculas.
 */
function chaveDaPaginaProvasCard(caminho) {
    return decodeURIComponent(String(caminho)).toLowerCase().split('/').filter(Boolean)
        .slice(-SEGMENTOS_CHAVE_PROVAS_CARD).join('/');
}

/**
 * Lê no banco as provas (objetiva e prática) ativas da pasta deste índice que ainda não têm botão
 * em nenhum card (ex.: a prova só existe no banco), para entrarem na tabela de notas.
 * @param {{pagina: string}[]} atividadesDoIndice - Atividades que já vieram dos cards.
 * @returns {Promise<{pagina: string, titulo: string, aulaId: number, rotuloAula: string}[]>}
 *     Provas que faltam, no mesmo formato de lerAtividadesDoIndice.
 */
async function lerProvasDoBancoCard(atividadesDoIndice) {
    const pasta = decodeURIComponent(location.pathname).replace(/[^/]*$/, '');
    const linhas = await sbGet('atividade', 'select=pagina,nome_atividade,tipo_avaliacao,aula_id' +
        '&ativo=eq.true&pagina=like.' + encodeURIComponent(pasta + '*') + '&order=id');
    const jaNaLista = new Set(atividadesDoIndice.map((atividade) =>
        chaveDaPaginaProvasCard(atividade.pagina)));
    const provas = linhas.filter((linha) => TIPOS_PROVA_CARD.includes(linha.tipo_avaliacao)
        && !jaNaLista.has(chaveDaPaginaProvasCard(linha.pagina)));
    if (!provas.length) return [];

    const idsAulas = [...new Set(provas.map((prova) => prova.aula_id).filter(Boolean))];
    const aulas = idsAulas.length ? await sbGet('aulas',
        'select=id,numero&id=in.(' + idsAulas.join(',') + ')') : [];
    const numeroPorAula = new Map(aulas.map((aula) => [aula.id, aula.numero]));
    return provas.map((prova) => ({ pagina: prova.pagina,
        titulo: prova.nome_atividade || prova.pagina.split('/').pop(), aulaId: prova.aula_id,
        rotuloAula: numeroPorAula.has(prova.aula_id)
            ? 'AULA ' + String(numeroPorAula.get(prova.aula_id)).padStart(2, '0') : '' }));
}

/**
 * Junta as provas do banco à lista dos cards: cada prova vai logo depois da última atividade da
 * própria aula (ou no fim, se a aula não tiver atividade na lista).
 * @param {Object[]} atividades - Atividades lidas dos cards.
 * @param {Object[]} provas - Provas lidas do banco (lerProvasDoBancoCard).
 * @returns {Object[]} Nova lista, sem alterar a original.
 */
function juntarProvasAsAtividadesCard(atividades, provas) {
    const lista = [...atividades];
    provas.forEach((prova) => {
        const ultimo = lista.map((atividade) => atividade.aulaId).lastIndexOf(prova.aulaId);
        lista.splice(ultimo >= 0 ? ultimo + 1 : lista.length, 0, prova);
    });
    return lista;
}

/**
 * Id do curso de uma matéria.
 * @param {number|null} materiaId - Id da matéria.
 * @returns {Promise<number|null>} Id do curso ou null se a matéria não tiver curso.
 */
async function lerCursoIdDaMateriaCard(materiaId) {
    if (!materiaId) return null;

    const linhas = await sbGet(TABELA_MATERIA_NOTAS, 'select=curso_id&id=eq.' + materiaId);
    return linhas[0]?.curso_id ? Number(linhas[0].curso_id) : null;
}

/**
 * Turmas oferecidas ao professor no card: só as do curso da matéria da página; sem curso
 * conhecido, todas.
 * @param {number|null} materiaId - Id da matéria da página.
 * @returns {Promise<Object[]>} Turmas (codigo, nome, turno, unidade, favorito, lider_aluno_id).
 */
async function listarTurmasCard(materiaId) {
    const cursoId = await lerCursoIdDaMateriaCard(materiaId);
    const filtroCurso = cursoId ? '&curso_id=eq.' + cursoId : '';
    return sbGet('turma', CONSULTA_TURMAS_CARD + filtroCurso);
}

/**
 * Alunos ativos de uma turma, na ordem da chamada. Vem do helper único alunosAtivosDaTurma
 * (js/supabase.js, vínculo turmaaluno sem desistente): o mesmo conjunto alimenta o combo Aluno,
 * o "Listar todos" e os totais Tarefas OK / Tarefas Pendentes (NOTAS-SEM-DESISTENTES).
 * @param {string} codigoTurma - Código da turma.
 * @returns {Promise<Object[]>} Alunos (id, nome, numero_chamada, na_chamada).
 */
async function listarAlunosDaTurmaCard(codigoTurma) {
    if (!codigoTurma) return [];

    const alunos = await alunosAtivosDaTurma(codigoTurma, COLUNAS_ALUNOS_CARD, ORDEM_ALUNOS_CARD);
    return alunos.sort(compararAlunosPelaChamadaCard);
}

/**
 * Ordem da chamada (número; sem número, no fim), depois o nome.
 * @param {Object} a - Aluno.
 * @param {Object} b - Aluno.
 * @returns {number} Comparação para sort.
 */
function compararAlunosPelaChamadaCard(a, b) {
    const na = a.numero_chamada ?? Infinity;
    const nb = b.numero_chamada ?? Infinity;
    if (na !== nb) return na < nb ? -1 : 1;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
}

/**
 * Configuração da média por atividade para uma turma.
 * @param {string} codigoTurma - Código da turma.
 * @returns {Promise<Map<number, {naMedia: boolean, peso: number}>>} Config por atividade; sem
 *     linha, o chamador assume ON e peso 1.
 */
async function lerConfigDaTurma(codigoTurma) {
    const mapa = new Map();
    if (!codigoTurma) return mapa;

    const linhas = await sbGet(TABELA_CONFIG_CARD,
        'select=atividade_id,calcula_media,peso&turma_codigo=eq.' +
        encodeURIComponent(codigoTurma));
    linhas.forEach((linha) => mapa.set(Number(linha.atividade_id), {
        naMedia: linha.calcula_media !== false,
        peso: linha.peso === null ? PESO_PADRAO_CARD : Number(linha.peso),
    }));
    return mapa;
}

/**
 * Grava (upsert) se a atividade calcula média na turma (coluna calcula_media) e o peso.
 * @param {{atividadeId: number, turma: string, naMedia: boolean, peso: number}} config - Dados;
 *     naMedia vira a coluna calcula_media.
 * @returns {Promise<void>}
 * @throws {Error} Se o peso for inválido ou o banco recusar a gravação.
 */
async function gravarConfigDaAtividade({ atividadeId, turma, naMedia, peso }) {
    const pesoNumero = Number(peso);
    const pesoValido = peso !== '' && peso !== null && Number.isFinite(pesoNumero)
        && pesoNumero >= 0;
    if (!pesoValido) throw new Error(MSG_PESO_INVALIDO_CARD);

    const resposta = await fetch(SUPABASE.URL + '/rest/v1/' + TABELA_CONFIG_CARD +
        '?on_conflict=atividade_id,turma_codigo', {
        method: 'POST',
        headers: { ...(await sbH()),
            Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ atividade_id: atividadeId, turma_codigo: turma,
            calcula_media: Boolean(naMedia), peso: pesoNumero,
            atualizado_em: new Date().toISOString() }),
    });
    if (resposta.ok) return;

    const detalhe = await resposta.text();
    throw new Error(detalhe || MSG_FALHA_GRAVAR_CARD);
}

/**
 * Id da matéria da página pela pasta imediatamente antes de ATIVIDADES no endereço
 * (.../<MATERIA>/ATIVIDADES/index.html), com espaços no lugar dos hífens, como em
 * materia.descricao.
 * @returns {Promise<number|null>} Id da matéria ou null quando não há pasta ATIVIDADES
 *     no caminho ou a busca não devolve exatamente uma linha.
 */
async function lerMateriaIdDaPagina() {
    const partes = decodeURIComponent(location.pathname).split('/').filter(Boolean);
    const posicao = partes.map((parte) => parte.toUpperCase())
        .lastIndexOf(PASTA_ATIVIDADES_CARD);
    if (posicao < 1) return null;

    const nome = partes[posicao - 1].replace(/-/g, ' ');
    const linhas = await sbGet(TABELA_MATERIA_NOTAS,
        CONSULTA_MATERIA_CARD + encodeURIComponent(nome));
    if (linhas.length !== 1) return null;

    return Number(linhas[0].id);
}

/**
 * Alunos com a média confirmada pelo professor na matéria.
 * @param {number} materiaId - Id da matéria.
 * @returns {Promise<Set<string>>} Ids dos alunos com media_finalizada = true.
 */
async function listarMediaFinalizadaDaMateria(materiaId) {
    if (!materiaId) return new Set();

    const linhas = await sbGet(TABELA_MEDIA_FINALIZADA_CARD,
        'select=aluno_id&materia_id=eq.' + materiaId + '&media_finalizada=eq.true');
    return new Set(linhas.map((linha) => String(linha.aluno_id)));
}

/**
 * Grava (upsert) a confirmação da média do aluno na matéria.
 * @param {{alunoId: string, materiaId: number, turma: string, finalizada: boolean}} dados -
 *     Dados da confirmação.
 * @returns {Promise<void>}
 * @throws {Error} Se faltar aluno, matéria ou turma, ou o banco recusar a gravação.
 */
async function gravarMediaFinalizada({ alunoId, materiaId, turma, finalizada }) {
    if (!alunoId) throw new Error(MSG_SEM_ALUNO_MEDIA_CARD);
    if (!materiaId) throw new Error(MSG_SEM_MATERIA_MEDIA_CARD);
    if (!turma) throw new Error(MSG_SEM_TURMA_MEDIA_CARD);

    const resposta = await fetch(SUPABASE.URL + '/rest/v1/' + TABELA_MEDIA_FINALIZADA_CARD +
        '?on_conflict=aluno_id,materia_id', {
        method: 'POST',
        headers: { ...(await sbH()),
            Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ aluno_id: alunoId, materia_id: materiaId,
            turma_codigo: turma, media_finalizada: Boolean(finalizada) }),
    });
    if (resposta.ok) return;

    const detalhe = await resposta.text();
    throw new Error(detalhe || MSG_FALHA_GRAVAR_MEDIA_CARD);
}
