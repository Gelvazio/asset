// Card "Notas e média" do índice de atividades: botões "Media das Atividades", "Prova Objetiva",
// "Prova Pratica" e "Media Final" no rodapé. Qualquer um deles abre/fecha uma tabela com as quatro
// notas:
// - Média das Atividades: média simples das notas das atividades que não são prova;
// - Prova Objetiva e Prova Prática: a nota de cada prova (média, se houver mais de uma);
// - Média Final: (Média das Atividades + Prova Objetiva + Prova Prática) ÷ 3; sem uma das três
//   notas (ex.: prova aguardando correção) a Média Final não é calculada.
// - Aluno que não fez nenhuma atividade da coluna (nem entregou) aparece com 0,0, e não com o
//   traço; o traço fica para coluna sem atividade ou entregue e aguardando correção.
// A tabela já abre sozinha; os botões a escondem e mostram de novo.
// Com o professor e NENHUM aluno escolhido no combo, a tabela lista a média de TODOS os alunos da
// turma (uma linha por aluno, com as mesmas quatro notas).
// As provas (objetiva e prática) entram mesmo quando a página delas não tem linha no card: o módulo
// procura no banco as páginas da pasta ATIVIDADES e lê a nota das provas também.
// Só mostra números na tela: não muda a média ponderada do card nem grava nada. Consumido por
// card-notas-media.js. Quem é prova vem do campo atividade.tipo_avaliacao (3 = prova objetiva, 4 = prova prática;
// 1 e 2 = atividades de sala); só a atividade sem tipo (nulo) cai no nome da página.

const CLASSE_MEDIA_ATIVIDADES = 'card-notas-media__media-atividades';
const TEXTO_SEM_VALOR_MEDIA_ATIVIDADES = '—';
// Aluno que não fez nenhuma atividade da coluna fica com 0,0 (e não com o traço).
const NOTA_ALUNO_NAO_FEZ_MEDIA_ATIVIDADES = 0;
const DIVISOR_MEDIA_FINAL_ATIVIDADES = 3;
const TIPO_PROVA_OBJETIVA_MEDIA_ATIVIDADES = 3;
const TIPO_PROVA_PRATICA_MEDIA_ATIVIDADES = 4;
const PADRAO_OBJETIVA_MEDIA_ATIVIDADES =
    /(avaliacao|prova)\s+objetiva|objetiva\s+(avaliacao|prova)/;
const PADRAO_PRATICA_MEDIA_ATIVIDADES =
    /(avaliacao|prova)\s+pratica|pratica\s+(avaliacao|prova)/;
const BOTOES_MEDIA_ATIVIDADES = [
    { chave: 'atividades', rotulo: 'Media das Atividades' },
    { chave: 'objetiva', rotulo: 'Prova Objetiva' },
    { chave: 'pratica', rotulo: 'Prova Pratica' },
    { chave: 'final', rotulo: 'Media Final' },
];
const DICA_MEDIA_ATIVIDADES = 'Mostra a tabela: média das atividades (sem as provas), prova ' +
    'objetiva, prova prática e a média final = (atividades + objetiva + prática) ÷ 3.';

const PARALELO_BUSCA_MEDIA_ATIVIDADES = 5;
const TEXTO_CARREGANDO_MEDIA_ATIVIDADES = 'Carregando as notas de todos os alunos...';
const TEXTO_ERRO_MEDIA_ATIVIDADES = 'Não foi possível carregar as notas de todos os alunos.';
const COLUNA_ALUNO_MEDIA_ATIVIDADES = 'Aluno';
const TEXTO_SEM_ALUNOS_MEDIA_ATIVIDADES = 'Nenhum aluno cadastrado nesta turma.';

// mostrando: a tabela já abre ligada (os botões abrem/fecham); turmas: notas já lidas de cada turma (Map turma -> linhas); carregando: turma em leitura.
const PREFIXO_CURINGA_MEDIA_ATIVIDADES = '*';
// filtros: opção escolhida em cada coluna (chave da coluna -> FILTRO_*), mantida ao redesenhar.
const estadoMediaAtividades = { mostrando: true, leituras: new Map(), carregando: '', erro: '',
    tipos: null, filtros: {} };
const NOTA_CORTE_MEDIA_ATIVIDADES = 7;
const FILTRO_TODOS_MEDIA_ATIVIDADES = 'todos';
const FILTRO_ACIMA_MEDIA_ATIVIDADES = 'acima';
const FILTRO_ABAIXO_MEDIA_ATIVIDADES = 'abaixo';
const FILTRO_FALTA_CORRIGIR_MEDIA_ATIVIDADES = 'falta-corrigir';
const OPCOES_FILTRO_MEDIA_ATIVIDADES = [
    { valor: FILTRO_TODOS_MEDIA_ATIVIDADES, rotulo: 'Todos' },
    { valor: FILTRO_ACIMA_MEDIA_ATIVIDADES, rotulo: 'Acima da média (≥ 7)' },
    { valor: FILTRO_ABAIXO_MEDIA_ATIVIDADES, rotulo: 'Abaixo da média (< 7)' },
    { valor: FILTRO_FALTA_CORRIGIR_MEDIA_ATIVIDADES, rotulo: 'Falta Corrigir' },
];

/**
 * Deixa o texto sem acento, em minúsculas e com hífens/sublinhados virando espaço.
 * @param {string} texto - Nome ou caminho da atividade.
 * @returns {string} Texto normalizado.
 */
function normalizarTextoMediaAtividades(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[-_]+/g, ' ');
}

/**
 * Diz de que prova é a atividade: pelo campo tipo_avaliacao; sem tipo (nulo), pelo nome da página.
 * @param {{titulo: string, pagina: string, tipo?: number|null}} atividade - Atividade do card.
 * @returns {'objetiva'|'pratica'|null} Tipo da prova, ou null se for atividade de sala.
 */
function tipoDeProvaMediaAtividades(atividade) {
    if (atividade.tipo === TIPO_PROVA_OBJETIVA_MEDIA_ATIVIDADES) return 'objetiva';
    if (atividade.tipo === TIPO_PROVA_PRATICA_MEDIA_ATIVIDADES) return 'pratica';
    if (atividade.tipo !== null && atividade.tipo !== undefined) return null;

    const nome = normalizarTextoMediaAtividades(atividade.titulo + ' ' + atividade.pagina);
    if (PADRAO_OBJETIVA_MEDIA_ATIVIDADES.test(nome)) return 'objetiva';
    if (PADRAO_PRATICA_MEDIA_ATIVIDADES.test(nome)) return 'pratica';
    return null;
}

/**
 * Média simples das notas informadas; ignora o que não é número.
 * @param {(number|null|undefined)[]} notas - Notas.
 * @returns {number|null} Média, ou null se não houver nenhuma nota.
 */
function mediaSimplesMediaAtividades(notas) {
    const validas = notas.filter((nota) => nota !== null && nota !== undefined
        && !Number.isNaN(Number(nota))).map(Number);
    if (!validas.length) return null;

    return validas.reduce((soma, nota) => soma + nota, 0) / validas.length;
}

/**
 * Nota de uma coluna: média das notas das atividades do grupo; 0 quando o aluno não fez nenhuma
 * delas; null quando falta nota por outro motivo (ex.: entregue e aguardando correção) ou quando a
 * coluna não tem nenhuma atividade.
 * @param {{nota: number|null, fez?: boolean}[]} grupo - Atividades da coluna.
 * @returns {number|null} Nota da coluna.
 */
function notaDoGrupoMediaAtividades(grupo) {
    const media = mediaSimplesMediaAtividades(grupo.map((item) => item.nota));
    if (media !== null) return media;

    const alunoNaoFezNenhuma = grupo.length > 0 && grupo.every((item) => item.fez === false);
    return alunoNaoFezNenhuma ? NOTA_ALUNO_NAO_FEZ_MEDIA_ATIVIDADES : null;
}

/**
 * Calcula as quatro notas da tabela.
 * @param {{titulo: string, pagina: string, nota: number|null, naMedia?: boolean,
 *     fez?: boolean}[]} todosItens - Atividades com a nota (fez = o aluno entregou ou tem nota);
 *     as com naMedia falso (Calcula Media desligado) ficam de fora.
 * @returns {{atividades: number|null, objetiva: number|null, pratica: number|null,
 *     final: number|null}} Notas (null quando não existem).
 */
function calcularNotasMediaAtividades(todosItens) {
    const itens = todosItens.filter((item) => item.naMedia !== false);
    const doTipo = (tipo) => itens.filter((item) => tipoDeProvaMediaAtividades(item) === tipo);
    const notas = { atividades: notaDoGrupoMediaAtividades(doTipo(null)),
        objetiva: notaDoGrupoMediaAtividades(doTipo('objetiva')),
        pratica: notaDoGrupoMediaAtividades(doTipo('pratica')), final: null };
    const componentes = [notas.atividades, notas.objetiva, notas.pratica];
    if (componentes.every((nota) => nota !== null)) {
        notas.final = componentes.reduce((soma, nota) => soma + nota, 0) /
            DIVISOR_MEDIA_FINAL_ATIVIDADES;
    }
    return notas;
}

/**
 * Lê o mapa página -> {naMedia, peso} da turma escolhida (vazio se ainda não carregado).
 * @returns {Map<string, {naMedia: boolean}>} Configuração por página da atividade.
 */
function lerConfiguracaoMediaAtividades() {
    const configuracao = typeof estadoNotas !== 'undefined' ? estadoNotas.configuracao : null;
    return configuracao instanceof Map ? configuracao : new Map();
}

/**
 * Diz se a atividade conta na média (Calcula Media ligado na turma); sem marcação = ligado.
 * @param {string} pagina - Página da atividade.
 * @returns {boolean} false só quando a marcação está desligada.
 */
function estaNaMediaMediaAtividades(pagina) {
    return lerConfiguracaoMediaAtividades().get(pagina)?.naMedia !== false;
}

/**
 * Assinatura curta das atividades desligadas da média; muda quando o professor liga/desliga.
 * @returns {string} Páginas desligadas, ordenadas e unidas por '|'.
 */
function assinaturaConfiguracaoMediaAtividades() {
    return [...lerConfiguracaoMediaAtividades()].filter(([, dados]) => dados?.naMedia === false)
        .map(([pagina]) => pagina).sort().join('|');
}

/**
 * Formata uma nota da tabela.
 * @param {number|null} nota - Nota ou null.
 * @returns {string} Nota com uma casa decimal, ou o traço.
 */
function formatarValorMediaAtividades(nota) {
    return nota === null ? TEXTO_SEM_VALOR_MEDIA_ATIVIDADES : formatarNotaCard(nota);
}

/**
 * Monta a tabela: uma linha de títulos e uma linha de notas por aluno (ou uma só, sem coluna
 * Aluno, quando é o aluno escolhido).
 * @param {{rotulo: string, notas: Object}[]} linhas - Linhas (rotulo vazio = sem coluna Aluno).
 * @returns {HTMLTableElement} Tabela pronta.
 */
function montarTabelaMediaAtividades(linhas) {
    const tabela = document.createElement('table');
    tabela.className = CLASSE_MEDIA_ATIVIDADES;
    const cabecalho = tabela.createTHead();
    const corpo = tabela.createTBody();
    const comAluno = linhas.some((linha) => linha.rotulo);
    const filtrar = () => aplicarFiltrosMediaAtividades(corpo, linhas);
    if (comAluno) cabecalho.appendChild(montarLinhaFiltrosMediaAtividades(filtrar));
    const titulos = cabecalho.insertRow();
    if (comAluno) titulos.appendChild(criarTituloMediaAtividades(COLUNA_ALUNO_MEDIA_ATIVIDADES));
    BOTOES_MEDIA_ATIVIDADES.forEach((coluna) => {
        titulos.appendChild(criarTituloMediaAtividades(coluna.rotulo));
    });
    linhas.forEach((linha) => {
        const valores = corpo.insertRow();
        if (comAluno) valores.insertCell().textContent = linha.rotulo;
        BOTOES_MEDIA_ATIVIDADES.forEach((coluna) => {
            valores.insertCell().textContent = formatarValorMediaAtividades(
                linha.notas[coluna.chave]);
        });
    });
    if (comAluno) filtrar();
    return tabela;
}

/**
 * Diz se a nota passa no filtro da coluna: "acima" = nota ≥ 7, "abaixo" = nota < 7, "falta
 * corrigir" = só quem está com traço (sem nota); sem nota fica só no "todos" e no "falta corrigir".
 * @param {number|null} nota - Nota da coluna.
 * @param {string} filtro - FILTRO_TODOS, FILTRO_ACIMA, FILTRO_ABAIXO ou FILTRO_FALTA_CORRIGIR.
 * @returns {boolean} true se o aluno continua na lista.
 */
function notaPassaNoFiltroMediaAtividades(nota, filtro) {
    if (filtro === FILTRO_TODOS_MEDIA_ATIVIDADES) return true;
    if (filtro === FILTRO_FALTA_CORRIGIR_MEDIA_ATIVIDADES) return nota === null;
    if (nota === null) return false;
    if (filtro === FILTRO_ACIMA_MEDIA_ATIVIDADES) return nota >= NOTA_CORTE_MEDIA_ATIVIDADES;
    return nota < NOTA_CORTE_MEDIA_ATIVIDADES;
}

/**
 * Esconde as linhas dos alunos que não passam em todos os filtros escolhidos nas colunas.
 * @param {HTMLTableSectionElement} corpo - Corpo da tabela (uma linha por aluno).
 * @param {{notas: Object}[]} linhas - Dados de cada aluno, na mesma ordem das linhas do corpo.
 */
function aplicarFiltrosMediaAtividades(corpo, linhas) {
    linhas.forEach((linha, indice) => {
        const passaEmTodas = BOTOES_MEDIA_ATIVIDADES.every((coluna) => {
            const filtro = estadoMediaAtividades.filtros[coluna.chave]
                || FILTRO_TODOS_MEDIA_ATIVIDADES;
            return notaPassaNoFiltroMediaAtividades(linha.notas[coluna.chave], filtro);
        });
        corpo.rows[indice].hidden = !passaEmTodas;
    });
}

/**
 * Cria o combo (Todos / Acima da média / Abaixo da média / Falta Corrigir) de uma coluna.
 * @param {{chave: string, rotulo: string}} coluna - Coluna da tabela.
 * @param {function(): void} aoFiltrar - Reaplica os filtros nas linhas.
 * @returns {HTMLSelectElement} Combo pronto.
 */
function criarComboFiltroMediaAtividades(coluna, aoFiltrar) {
    const combo = document.createElement('select');
    combo.className = CLASSE_MEDIA_ATIVIDADES + '__filtro';
    combo.setAttribute('aria-label', 'Filtrar alunos pela coluna ' + coluna.rotulo);
    OPCOES_FILTRO_MEDIA_ATIVIDADES.forEach((opcao) => {
        combo.appendChild(new Option(opcao.rotulo, opcao.valor));
    });
    combo.value = estadoMediaAtividades.filtros[coluna.chave] || FILTRO_TODOS_MEDIA_ATIVIDADES;
    combo.addEventListener('change', () => {
        estadoMediaAtividades.filtros[coluna.chave] = combo.value;
        aoFiltrar();
    });
    return combo;
}

/**
 * Monta a linha de combos de filtro, uma célula acima de cada coluna de nota.
 * @param {function(): void} aoFiltrar - Reaplica os filtros nas linhas.
 * @returns {HTMLTableRowElement} Linha de filtros (a 1ª célula, da coluna Aluno, fica vazia).
 */
function montarLinhaFiltrosMediaAtividades(aoFiltrar) {
    const linha = document.createElement('tr');
    linha.appendChild(document.createElement('th'));
    BOTOES_MEDIA_ATIVIDADES.forEach((coluna) => {
        const celula = document.createElement('th');
        celula.appendChild(criarComboFiltroMediaAtividades(coluna, aoFiltrar));
        linha.appendChild(celula);
    });
    return linha;
}

/**
 * Cria uma célula de título da tabela.
 * @param {string} texto - Título.
 * @returns {HTMLTableCellElement} Célula.
 */
function criarTituloMediaAtividades(texto) {
    const titulo = document.createElement('th');
    titulo.textContent = texto;
    return titulo;
}

/**
 * Lê no banco, uma vez só, o tipo de avaliação das atividades da pasta ATIVIDADES e acha as
 * provas (tipo 3 ou 4) que não têm linha no card, para a nota delas entrar nas colunas.
 * @param {{atividades: Object[]}} contexto - Dados do card.
 * @returns {Promise<{tipos: Map<string, number|null>, extras: Object[]}>} Tipo por página e as
 *     provas que faltam no card.
 */
async function lerTiposMediaAtividades(contexto) {
    if (estadoMediaAtividades.tipos) return estadoMediaAtividades.tipos;

    const pasta = decodeURIComponent(location.pathname).replace(/[^/]*$/, '');
    const linhas = await sbGet('atividade', 'select=pagina,tipo_avaliacao&ativo=eq.true' +
        '&pagina=like.' + encodeURIComponent(pasta) + PREFIXO_CURINGA_MEDIA_ATIVIDADES);
    const tipos = new Map(linhas.map((linha) => [linha.pagina, linha.tipo_avaliacao]));
    const jaNoCard = new Set(contexto.atividades.map((atividade) => atividade.pagina));
    const extras = linhas.filter((linha) => !jaNoCard.has(linha.pagina)
        && [TIPO_PROVA_OBJETIVA_MEDIA_ATIVIDADES, TIPO_PROVA_PRATICA_MEDIA_ATIVIDADES]
            .includes(linha.tipo_avaliacao))
        .map((linha) => ({ titulo: linha.pagina, pagina: linha.pagina }));
    estadoMediaAtividades.tipos = { tipos, extras };
    return estadoMediaAtividades.tipos;
}

/**
 * Lê, alguns alunos por vez, as notas dos alunos e guarda o cálculo de cada um.
 * @param {Object} contexto - Contexto do card (alunos, atividades, buscarNotas, rotuloAluno).
 * @param {Object[]} alunos - Alunos a calcular.
 * @param {boolean} comRotulo - false para a tabela de um aluno só (sem coluna Aluno).
 * @returns {Promise<{rotulo: string, notas: Object}[]>} Uma linha por aluno, na ordem recebida.
 */
async function lerNotasDosAlunosMediaAtividades(contexto, alunos, comRotulo) {
    const { tipos, extras } = await lerTiposMediaAtividades(contexto);
    const todas = [...contexto.atividades, ...extras];
    const paginas = todas.map((atividade) => atividade.pagina);
    const linhas = new Array(alunos.length);
    let proximo = 0;
    const trabalhador = async () => {
        while (proximo < alunos.length) {
            const indice = proximo;
            proximo += 1;
            const notas = await contexto.buscarNotas(alunos[indice].id, paginas);
            const itens = todas.map((atividade) => ({ titulo: atividade.titulo,
                pagina: atividade.pagina, tipo: tipos.get(atividade.pagina) ?? null,
                nota: notas.get(atividade.pagina)?.nota ?? null,
                fez: notas.has(atividade.pagina),
                naMedia: estaNaMediaMediaAtividades(atividade.pagina) }));
            linhas[indice] = { rotulo: comRotulo ? contexto.rotuloAluno(alunos[indice]) : '',
                notas: calcularNotasMediaAtividades(itens) };
        }
    };
    await Promise.all(Array.from({ length: PARALELO_BUSCA_MEDIA_ATIVIDADES }, trabalhador));
    return linhas;
}

/**
 * Diz quais alunos entram na tabela: o aluno escolhido, ou todos os da turma.
 * @param {{ehProfessor: boolean, alunoId: string, alunos: Object[]}} contexto - Dados do card.
 * @returns {{chave: string, alunos: Object[], comRotulo: boolean}} Alvo da leitura.
 */
function alvoDaTabelaMediaAtividades(contexto) {
    const assinatura = '|' + assinaturaConfiguracaoMediaAtividades();
    if (!contexto.ehProfessor) {
        return { chave: contexto.turma + '|proprio' + assinatura, alunos: [{ id: 'proprio' }],
            comRotulo: false };
    }
    if (contexto.alunoId) {
        const aluno = contexto.alunos.find((item) => String(item.id) === String(contexto.alunoId));
        return { chave: contexto.turma + '|' + contexto.alunoId + assinatura,
            alunos: aluno ? [aluno] : [{ id: contexto.alunoId }], comRotulo: false };
    }
    return { chave: contexto.turma + '|*' + assinatura, alunos: contexto.alunos,
        comRotulo: true };
}

/**
 * Começa a ler as notas (uma leitura por vez) e redesenha o card ao terminar.
 * @param {Object} contexto - Contexto do card.
 * @param {{chave: string, alunos: Object[], comRotulo: boolean}} alvo - Alunos a calcular.
 * @param {function(): void} aoMudar - Redesenha o rodapé do card.
 */
async function carregarMediasMediaAtividades(contexto, alvo, aoMudar) {
    estadoMediaAtividades.carregando = alvo.chave;
    estadoMediaAtividades.erro = '';
    try {
        estadoMediaAtividades.leituras.set(alvo.chave,
            await lerNotasDosAlunosMediaAtividades(contexto, alvo.alunos, alvo.comRotulo));
    } catch (erro) {
        console.warn('Médias dos alunos:', erro.message);
        estadoMediaAtividades.erro = TEXTO_ERRO_MEDIA_ATIVIDADES;
    } finally {
        estadoMediaAtividades.carregando = '';
        aoMudar();
    }
}

/**
 * Cria a tabela (de um aluno ou de todos), ou o aviso de que ainda está carregando / deu erro.
 * @param {Object} contexto - Contexto do card.
 * @param {function(): void} aoMudar - Redesenha o rodapé do card.
 * @returns {HTMLElement} Tabela ou aviso.
 */
function criarTabelaMediaAtividades(contexto, aoMudar) {
    const alvo = alvoDaTabelaMediaAtividades(contexto);
    const linhas = estadoMediaAtividades.leituras.get(alvo.chave);
    if (linhas) return montarTabelaMediaAtividades(linhas);

    const aviso = document.createElement('p');
    aviso.textContent = estadoMediaAtividades.erro || (alvo.alunos.length
        ? TEXTO_CARREGANDO_MEDIA_ATIVIDADES : TEXTO_SEM_ALUNOS_MEDIA_ATIVIDADES);
    const semLeitura = estadoMediaAtividades.carregando !== alvo.chave
        && !estadoMediaAtividades.erro && alvo.alunos.length;
    if (semLeitura) carregarMediasMediaAtividades(contexto, alvo, aoMudar);
    return aviso;
}

/**
 * Cria os quatro botões e, com a tabela aberta, a tabela (que continua aberta quando o card é
 * redesenhado). Sem aluno escolhido, a tabela lista todos os alunos da turma.
 * @param {{ehProfessor: boolean, alunoId: string, turma: string, alunos: Object[],
 *     atividades: Object[], buscarNotas: Function, rotuloAluno: function(Object): string}} contexto - Dados do card,
 *     lidos na hora de desenhar.
 * @param {function(): void} aoMudar - Redesenha o rodapé do card.
 * @returns {HTMLElement[]} Botões e, se aberta, a tabela.
 */
function criarControleMediaAtividades(contexto, aoMudar) {
    const botoes = BOTOES_MEDIA_ATIVIDADES.map((coluna) => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn ' + CLASSE_MEDIA_ATIVIDADES + '__botao';
        botao.textContent = coluna.rotulo;
        botao.title = DICA_MEDIA_ATIVIDADES;
        botao.addEventListener('click', () => {
            estadoMediaAtividades.mostrando = !estadoMediaAtividades.mostrando;
            estadoMediaAtividades.leituras.clear();
            estadoMediaAtividades.erro = '';
            aoMudar();
        });
        return botao;
    });
    if (!estadoMediaAtividades.mostrando) return botoes;

    return [...botoes, criarTabelaMediaAtividades(contexto, aoMudar)];
}

window.criarControleMediaAtividades = criarControleMediaAtividades;
