// Atividade Dinâmica (tarefa #381): painel do PROFESSOR para lançar a nota (0 a 10) de cada aluno,
// por critério, com formato (individual, duplas, grupos, turma toda) e grupo. "Salvar grupo" aplica
// os mesmos critérios a todos os alunos com o mesmo nome de grupo. "Confirmar" grava a nota para
// sempre (nota_gravada) e trava a linha. O aluno nunca vê este painel.
// Correção por IA (2026-11-09, DINAMICA-CORRECAO-IA): igual à Prática, a IA grava uma SUGESTÃO por
// critério (nota_dinamica.criterios_ia: nota + motivo, e motivo_ia geral) sem confirmar. Cada
// critério já abre com a nota e o motivo da IA; o professor edita, complementa ou só confirma.
// "Pedir correção de IA" grava um pedido em pedido_correcao_ia; "Confirmar todas as sugestões da
// IA" confirma, linha a linha, o que está na tela. Sem a migration 2026-11-09-dinamica-correcao-ia
// não há sugestão e o painel funciona como antes.
// Depende de nota-dinamica-repositorio.js. Regra: docs/regras/atividade-dinamica.md

const ID_ROTEIRO_DINAMICA = 'dinamica-roteiro';
const ID_NOTAS_DINAMICA = 'dinamica-notas';
const CLASSE_TEXTO_DINAMICA = 'dinamica__texto';
const MSG_SEM_ATIVIDADE_DINAMICA = 'Esta dinâmica ainda não está cadastrada no banco. ' +
    'Peça para aplicar o seed da atividade.';
const MSG_SEM_ALUNOS_DINAMICA = 'Nenhum aluno encontrado nesta turma.';
const MSG_ERRO_DINAMICA = 'Não foi possível carregar as notas: ';
const NOTA_MAXIMA_DINAMICA = 10;
const CASAS_NOTA_DINAMICA = 2;
const MSG_AVISO_CONFIRMAR_DINAMICA =
    'Depois de confirmada, a nota será gravada e NUNCA mais poderá ser mudada. Confirmar?';
const MSG_CONFIRMADA_DINAMICA = '🔒 Confirmada (não pode mais mudar)';
const MSG_SUGESTAO_IA_DINAMICA = '🤖 Sugestão da IA: revise, edite se quiser e confirme';
const TAMANHO_MOTIVO_DINAMICA = 500;
const TAMANHO_COMENTARIO_DINAMICA = 1000;
const LINHAS_MOTIVO_DINAMICA = 2;
const TEXTO_PEDIR_IA_DINAMICA = '🤖 Pedir correção de IA';
const TITULOS_TABELA_DINAMICA = ['Aluno', 'Nota sugerida', 'Comentário', 'Ações'];
const TEXTO_DETALHE_CRITERIOS_DINAMICA = 'Ver critérios, formato e grupo';
const TAMANHO_GRUPO_DINAMICA = 80;
const TEXTO_CONFIRMAR_TODAS_IA_DINAMICA = '✅ Confirmar todas as sugestões da IA';
const MSG_PEDIDO_IA_ENVIADO_DINAMICA =
    'Pedido enviado: a IA corrige as entregas pelo comando /corrigir-ia-dinamica.';
const MSG_PEDIDO_IA_PENDENTE_DINAMICA = 'Já existe um pedido de correção de IA pendente.';
const MSG_PEDIDO_IA_CONCLUIDO_DINAMICA = 'Último pedido de correção de IA: concluído.';
const MSG_NADA_CONFIRMAR_IA_DINAMICA = 'Nenhuma linha com sugestão da IA para confirmar.';
const MSG_AVISO_CONFIRMAR_TODAS_IA_DINAMICA = 'Confirmar {n} aluno(s) com os valores que estão ' +
    'na tela (sugestão da IA ou o que você editou)? Depois de confirmadas, as notas NUNCA mais ' +
    'poderão ser mudadas.';

const estadoProfessorDinamica = { atividadeId: null, criterios: [], notas: new Map() };

/**
 * Cria um elemento com classe e texto.
 * @param {string} etiqueta - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto (nunca HTML).
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoDinamica(etiqueta, classe, texto) {
    const elemento = document.createElement(etiqueta);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

/**
 * Converte o texto digitado em nota entre 0 e o máximo do critério.
 * @param {string} valor - Texto do campo (aceita vírgula).
 * @param {number} maximo - Pontos do critério.
 * @returns {number} Nota válida (0 se vazio ou inválido).
 */
function converterNotaDinamica(valor, maximo) {
    const numero = parseFloat(String(valor).replace(',', '.'));
    if (Number.isNaN(numero) || numero < 0) return 0;
    return Math.min(numero, maximo);
}

/**
 * Cria o campo numérico de um critério já preenchido com a nota anterior.
 * @param {{nome: string, pontos: number}} criterio - Critério.
 * @param {number|undefined} valorAnterior - Nota já lançada no critério.
 * @returns {HTMLInputElement} Campo.
 */
function criarCampoCriterioDinamica(criterio, valorAnterior) {
    const campo = criarElementoDinamica('input', 'dinamica__campo-nota');
    Object.assign(campo, { type: 'number', min: 0, max: criterio.pontos, step: 0.25,
        title: criterio.nome + ' (máx. ' + criterio.pontos + ')' });
    campo.dataset.criterio = criterio.nome;
    if (valorAnterior !== undefined) campo.value = valorAnterior;
    return campo;
}

/**
 * Sugestão da IA para um critério (nota_dinamica.criterios_ia), se houver.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @param {string} nomeCriterio - Nome do critério (data-criterios).
 * @returns {{nome: string, nota: number, motivo: string}|null} Sugestão ou null.
 */
function lerSugestaoIaDinamica(nota, nomeCriterio) {
    const lista = Array.isArray(nota?.criterios_ia) ? nota.criterios_ia : [];
    return lista.find((item) => item?.nome === nomeCriterio) || null;
}

/**
 * Diz se a linha já tem nota lançada pelo professor (rascunho ou confirmada).
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @returns {boolean} true se `nota` está preenchida.
 */
function temNotaProfessorDinamica(nota) {
    return nota?.nota !== null && nota?.nota !== undefined;
}

/**
 * Diz se a linha tem sugestão da IA.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @returns {boolean} true se a IA já gravou a correção.
 */
function temSugestaoIaDinamica(nota) {
    return Boolean(nota?.nota_ia_em) || (Array.isArray(nota?.criterios_ia) &&
        nota.criterios_ia.length > 0);
}

/**
 * Valores com que o critério abre: os do professor, se já lançou; senão os da IA.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @param {{nome: string}} criterio - Critério.
 * @returns {{nota: number|undefined, motivo: string, ia: Object|null}} Valores iniciais.
 */
function valoresIniciaisCriterioDinamica(nota, criterio) {
    const doProfessor = temNotaProfessorDinamica(nota)
        ? (nota.criterios || []).find((item) => item.nome === criterio.nome) : undefined;
    const ia = lerSugestaoIaDinamica(nota, criterio.nome);
    return {
        nota: doProfessor ? doProfessor.nota : ia?.nota,
        motivo: doProfessor?.motivo ?? ia?.motivo ?? '',
        ia,
    };
}

/**
 * Cria o campo do motivo da nota do critério (texto editável pelo professor).
 * @param {{nome: string}} criterio - Critério.
 * @param {string} texto - Motivo inicial (do professor ou da IA).
 * @returns {HTMLTextAreaElement} Campo.
 */
function criarCampoMotivoDinamica(criterio, texto) {
    const campo = criarElementoDinamica('textarea', 'dinamica__campo-motivo');
    Object.assign(campo, { rows: LINHAS_MOTIVO_DINAMICA, maxLength: TAMANHO_MOTIVO_DINAMICA,
        placeholder: 'Motivo da nota', value: texto || '' });
    campo.dataset.motivo = criterio.nome;
    return campo;
}

/**
 * Cria o bloco de um critério (dentro do detalhe do aluno): nome, nota, sugestão da IA e motivo.
 * @param {HTMLTableRowElement} linha - Linha do aluno (para atualizar o total).
 * @param {{nome: string, pontos: number}} criterio - Critério.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @returns {HTMLDivElement} Bloco do critério.
 */
function criarCelulaCriterioDinamica(linha, criterio, nota) {
    const valores = valoresIniciaisCriterioDinamica(nota, criterio);
    const celula = criarElementoDinamica('div', 'dinamica__celula-criterio');
    celula.append(criarElementoDinamica('div', 'dinamica__rotulo',
        criterio.nome + ' (' + criterio.pontos + ')'));
    const campo = criarCampoCriterioDinamica(criterio, valores.nota);
    campo.addEventListener('input', () => atualizarTotalDinamica(linha));
    celula.append(campo);
    if (valores.ia) {
        const sugestao = criarElementoDinamica('span', 'dinamica__sugestao-ia',
            '🤖 IA: ' + String(valores.ia.nota).replace('.', ','));
        sugestao.title = 'Nota sugerida pela IA (ainda não confirmada)';
        celula.append(sugestao);
    }
    celula.append(criarCampoMotivoDinamica(criterio, valores.motivo));
    return celula;
}

/**
 * Soma os campos de critério de uma linha.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {number} Nota total (0 a 10).
 */
function somarCriteriosDinamica(linha) {
    const campos = [...linha.querySelectorAll('input[data-criterio]')];
    const total = campos.reduce((soma, campo) =>
        soma + converterNotaDinamica(campo.value, parseFloat(campo.max)), 0);
    return Math.min(total, NOTA_MAXIMA_DINAMICA);
}

/**
 * Atualiza a célula de total da linha.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 */
function atualizarTotalDinamica(linha) {
    const total = somarCriteriosDinamica(linha);
    linha.querySelector('.dinamica__total-aluno').textContent =
        total.toFixed(CASAS_NOTA_DINAMICA).replace('.', ',');
}

/**
 * Cria o seletor de formato.
 * @param {string|null|undefined} formatoAtual - Formato já lançado.
 * @returns {HTMLSelectElement} Seletor.
 */
function criarSeletorFormatoDinamica(formatoAtual) {
    const seletor = criarElementoDinamica('select', 'dinamica__combo');
    seletor.dataset.campo = 'formato';
    FORMATOS_DINAMICA.forEach(({ valor, texto }) => {
        const opcao = criarElementoDinamica('option', '', texto);
        opcao.value = valor;
        opcao.selected = valor === formatoAtual;
        seletor.append(opcao);
    });
    return seletor;
}

/**
 * Cria um campo de texto da linha (grupo ou comentário).
 * @param {string} campo - Nome do campo (grupo ou comentario).
 * @param {string|null|undefined} valor - Valor atual.
 * @param {number} maximo - Limite de caracteres.
 * @returns {HTMLInputElement} Campo de texto.
 */
function criarCampoTextoDinamica(campo, valor, maximo) {
    const entrada = criarElementoDinamica('input', 'dinamica__campo-texto');
    Object.assign(entrada, { type: 'text', maxLength: maximo, value: valor || '' });
    entrada.dataset.campo = campo;
    return entrada;
}

/**
 * Lê o que o professor preencheu na linha.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {Object} Registro pronto para nota_dinamica.
 */
function lerLinhaDinamica(linha) {
    const campo = (nome) => linha.querySelector('[data-campo="' + nome + '"]').value.trim();
    const criterios = [...linha.querySelectorAll('input[data-criterio]')].map((entrada) => ({
        nome: entrada.dataset.criterio,
        nota: converterNotaDinamica(entrada.value, parseFloat(entrada.max)),
        motivo: entrada.closest('.dinamica__celula-criterio')
            .querySelector('textarea[data-motivo]')?.value.trim() || '',
    }));
    return {
        aluno_id: linha.dataset.alunoId, atividade_id: estadoProfessorDinamica.atividadeId,
        nota: Number(somarCriteriosDinamica(linha).toFixed(CASAS_NOTA_DINAMICA)), criterios,
        formato: campo('formato'), grupo: campo('grupo') || null,
        comentario: campo('comentario') || null,
    };
}

/**
 * Grava a linha e mostra a situação na própria linha.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {Promise<void>}
 */
async function salvarLinhaDinamica(linha) {
    const situacao = linha.querySelector('.dinamica__situacao');
    try {
        await gravarNotaDaDinamica(lerLinhaDinamica(linha));
        situacao.className = 'dinamica__situacao dinamica__situacao--ok';
        situacao.textContent = '✅ Gravada';
    } catch (erro) {
        situacao.className = 'dinamica__situacao dinamica__situacao--erro';
        situacao.textContent = '❌ ' + erro.message;
    }
}

/**
 * Trava a linha: a nota confirmada não pode mais ser editada nem salva.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 */
function travarLinhaDinamica(linha) {
    linha.dataset.confirmada = 'sim';
    linha.querySelectorAll('input, select, textarea, button').forEach((controle) => {
        controle.disabled = true;
    });
    const situacao = linha.querySelector('.dinamica__situacao');
    situacao.className = 'dinamica__situacao dinamica__situacao--ok';
    situacao.textContent = MSG_CONFIRMADA_DINAMICA;
}

/**
 * Mostra um erro na situação da linha.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @param {Error} erro - Erro ocorrido.
 */
function mostrarErroLinhaDinamica(linha, erro) {
    const situacao = linha.querySelector('.dinamica__situacao');
    situacao.className = 'dinamica__situacao dinamica__situacao--erro';
    situacao.textContent = '❌ ' + erro.message;
}

/**
 * Grava o que está na linha como nota do professor e confirma (trava para sempre). Sem aviso.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {Promise<void>}
 * @throws {Error} Se o banco recusar a gravação ou a confirmação.
 */
async function gravarEConfirmarLinhaDinamica(linha) {
    await gravarNotaDaDinamica(lerLinhaDinamica(linha));
    const resposta = await confirmarNotaDaDinamica(
        estadoProfessorDinamica.atividadeId, linha.dataset.alunoId);
    if (!resposta.ok) throw new Error(resposta.motivo);
    travarLinhaDinamica(linha);
}

/**
 * Salva a linha, pede confirmação e confirma a nota (grava e trava para sempre).
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {Promise<void>}
 */
async function confirmarLinhaDinamica(linha) {
    if (!window.confirm(MSG_AVISO_CONFIRMAR_DINAMICA)) return;

    try {
        await gravarEConfirmarLinhaDinamica(linha);
    } catch (erro) {
        mostrarErroLinhaDinamica(linha, erro);
    }
}

/**
 * Copia critérios, formato e comentário da linha para as outras do mesmo grupo e grava todas.
 * @param {HTMLTableRowElement} linhaOrigem - Linha usada como modelo.
 * @returns {Promise<void>}
 */
async function salvarGrupoDinamica(linhaOrigem) {
    const grupo = linhaOrigem.querySelector('[data-campo="grupo"]').value.trim();
    if (!grupo) return;

    const linhas = [...linhaOrigem.closest('tbody').querySelectorAll('tr')].filter((linha) =>
        linha.dataset.confirmada !== 'sim' &&
        linha.querySelector('[data-campo="grupo"]').value.trim() === grupo);
    const seletor = 'input[data-criterio], textarea[data-motivo]';
    const modelo = [...linhaOrigem.querySelectorAll(seletor)].map((c) => c.value);
    for (const linha of linhas) {
        linha.querySelectorAll(seletor).forEach((c, i) => { c.value = modelo[i]; });
        linha.querySelector('[data-campo="formato"]').value =
            linhaOrigem.querySelector('[data-campo="formato"]').value;
        atualizarTotalDinamica(linha);
        await salvarLinhaDinamica(linha);
    }
}

/**
 * Cria o botão de uma linha.
 * @param {string} texto - Texto do botão.
 * @param {Function} acao - Função chamada ao clicar.
 * @returns {HTMLButtonElement} Botão.
 */
function criarBotaoDinamica(texto, acao) {
    const botao = criarElementoDinamica('button', 'dinamica__botao', texto);
    botao.type = 'button';
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        await acao();
        const linhaTravada = botao.closest('tr')?.dataset.confirmada === 'sim';
        if (!linhaTravada) botao.disabled = false;
    });
    return botao;
}

/**
 * Cria um campo do detalhe com o rótulo em cima.
 * @param {string} rotulo - Texto do rótulo.
 * @param {HTMLElement} controle - Campo (seletor ou texto).
 * @returns {HTMLLabelElement} Rótulo com o campo dentro.
 */
function criarCampoRotuladoDinamica(rotulo, controle) {
    const caixa = criarElementoDinamica('label', 'dinamica__campo-rotulado');
    caixa.append(criarElementoDinamica('span', 'dinamica__rotulo', rotulo), controle);
    return caixa;
}

/**
 * Cria a célula da nota sugerida: o total e, num detalhe que abre por aluno, o formato,
 * o grupo e os critérios (os campos ficam dentro da linha, então a gravação não muda).
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 * @returns {HTMLTableCellElement} Célula.
 */
function criarCelulaNotaDinamica(linha, nota) {
    const celula = criarElementoDinamica('td', 'dinamica__celula-nota');
    const detalhe = criarElementoDinamica('details', 'dinamica__detalhe');
    detalhe.append(criarElementoDinamica('summary', '', TEXTO_DETALHE_CRITERIOS_DINAMICA),
        criarCampoRotuladoDinamica('Formato', criarSeletorFormatoDinamica(nota?.formato)),
        criarCampoRotuladoDinamica('Grupo',
            criarCampoTextoDinamica('grupo', nota?.grupo, TAMANHO_GRUPO_DINAMICA)));
    estadoProfessorDinamica.criterios.forEach((criterio) =>
        detalhe.append(criarCelulaCriterioDinamica(linha, criterio, nota)));
    celula.append(criarElementoDinamica('div', 'dinamica__total-aluno', '—'), detalhe);
    return celula;
}

/**
 * Monta a linha de um aluno.
 * @param {{id: string, nome: string}} aluno - Aluno.
 * @param {Object|undefined} nota - Nota já lançada.
 * @returns {HTMLTableRowElement} Linha da tabela.
 */
function criarLinhaAlunoDinamica(aluno, nota) {
    const linha = criarElementoDinamica('tr');
    linha.dataset.alunoId = aluno.id;
    linha.append(criarElementoDinamica('td', '', aluno.nome),
        criarCelulaNotaDinamica(linha, nota));
    const celulaComentario = criarElementoDinamica('td');
    celulaComentario.append(criarCampoTextoDinamica('comentario',
        nota?.comentario || nota?.motivo_ia, TAMANHO_COMENTARIO_DINAMICA));
    linha.append(celulaComentario, criarCelulaAcoesDinamica(linha));
    finalizarLinhaAlunoDinamica(linha, nota);
    return linha;
}

/**
 * Cria a célula de ações da linha (Salvar, Salvar grupo, Confirmar e situação).
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @returns {HTMLTableCellElement} Célula.
 */
function criarCelulaAcoesDinamica(linha) {
    const celulaAcoes = criarElementoDinamica('td', 'dinamica__celula-acoes');
    const pilhaBotoes = criarElementoDinamica('div', 'dinamica__acoes');
    pilhaBotoes.append(criarBotaoDinamica('Salvar', () => salvarLinhaDinamica(linha)),
        criarBotaoDinamica('Salvar grupo', () => salvarGrupoDinamica(linha)),
        criarBotaoDinamica('Confirmar', () => confirmarLinhaDinamica(linha)));
    celulaAcoes.append(pilhaBotoes, criarElementoDinamica('div', 'dinamica__situacao'));
    return celulaAcoes;
}

/**
 * Calcula o total inicial, marca a sugestão da IA e trava a linha já confirmada.
 * @param {HTMLTableRowElement} linha - Linha do aluno.
 * @param {Object|undefined} nota - Linha de nota_dinamica.
 */
function finalizarLinhaAlunoDinamica(linha, nota) {
    const temValor = [...linha.querySelectorAll('input[data-criterio]')]
        .some((campo) => campo.value !== '');
    if (temValor) atualizarTotalDinamica(linha);
    if (nota?.confirmada_em) { travarLinhaDinamica(linha); return; }
    if (!temSugestaoIaDinamica(nota)) return;

    linha.dataset.temIa = 'sim';
    const situacao = linha.querySelector('.dinamica__situacao');
    situacao.className = 'dinamica__situacao dinamica__situacao--ia';
    situacao.textContent = MSG_SUGESTAO_IA_DINAMICA;
}

/**
 * Monta a tabela de notas da turma: aluno, nota sugerida (com o detalhe), comentário e ações.
 * @param {{id: string, nome: string}[]} alunos - Alunos da turma.
 * @returns {HTMLElement} Área rolável com a tabela.
 */
function criarTabelaDinamica(alunos) {
    const tabela = criarElementoDinamica('table', 'dinamica__tabela');
    const cabecalho = criarElementoDinamica('tr');
    TITULOS_TABELA_DINAMICA.forEach((titulo) =>
        cabecalho.append(criarElementoDinamica('th', '', titulo)));
    const corpo = criarElementoDinamica('tbody');
    alunos.forEach((aluno) => corpo.append(
        criarLinhaAlunoDinamica(aluno, estadoProfessorDinamica.notas.get(aluno.id))));
    tabela.append(criarElementoDinamica('thead'), corpo);
    tabela.firstChild.append(cabecalho);
    const area = criarElementoDinamica('div', 'dinamica__tabela-rolagem');
    area.append(tabela);
    return area;
}

/**
 * Carrega os alunos e as notas da turma e redesenha a tabela.
 * @param {HTMLElement} painel - Seção do painel de notas.
 * @param {string} turmaCodigo - Código da turma escolhida.
 * @returns {Promise<void>}
 */
async function carregarTurmaDinamica(painel, turmaCodigo) {
    painel.querySelector('.dinamica__tabela-rolagem')?.remove();
    const aviso = painel.querySelector('.' + CLASSE_TEXTO_DINAMICA);
    const [alunos, notas] = await Promise.all([lerAlunosDaDinamica(turmaCodigo),
        lerNotasDaDinamica(estadoProfessorDinamica.atividadeId)]);
    estadoProfessorDinamica.notas = new Map(notas.map((nota) => [nota.aluno_id, nota]));
    aviso.textContent = alunos.length ? '' : MSG_SEM_ALUNOS_DINAMICA;
    if (alunos.length) painel.append(criarTabelaDinamica(alunos));
}

/**
 * Cria o combo de turmas e carrega a favorita.
 * @param {HTMLElement} painel - Seção do painel de notas.
 * @param {{codigo: string, nome: string}[]} turmas - Turmas do curso.
 * @returns {Promise<void>}
 */
async function montarComboTurmaDinamica(painel, turmas) {
    const combo = criarElementoDinamica('select', 'dinamica__combo');
    turmas.forEach((turma) => {
        const opcao = criarElementoDinamica('option', '', turma.nome);
        opcao.value = turma.codigo;
        combo.append(opcao);
    });
    combo.addEventListener('change', () => carregarTurmaDinamica(painel, combo.value));
    painel.querySelector('.' + CLASSE_TEXTO_DINAMICA).before(combo);
    await carregarTurmaDinamica(painel, combo.value);
}

/**
 * Confirma, linha a linha, todas as linhas da turma com sugestão da IA ainda não confirmadas,
 * com os valores que estão na tela (a sugestão da IA ou o que o professor editou).
 * @param {HTMLElement} painel - Seção do painel de notas.
 * @param {HTMLElement} saida - Onde mostrar o resultado.
 * @returns {Promise<void>}
 */
async function confirmarTodasSugestoesIaDinamica(painel, saida) {
    const linhas = [...painel.querySelectorAll('.dinamica__tabela tbody tr')].filter((linha) =>
        linha.dataset.temIa === 'sim' && linha.dataset.confirmada !== 'sim');
    if (!linhas.length) { saida.textContent = MSG_NADA_CONFIRMAR_IA_DINAMICA; return; }
    if (!window.confirm(MSG_AVISO_CONFIRMAR_TODAS_IA_DINAMICA.replace('{n}', linhas.length))) {
        return;
    }

    let confirmadas = 0;
    for (const linha of linhas) {
        try {
            await gravarEConfirmarLinhaDinamica(linha);
            confirmadas += 1;
        } catch (erro) {
            mostrarErroLinhaDinamica(linha, erro);
        }
    }
    saida.textContent = '✅ ' + confirmadas + ' de ' + linhas.length + ' confirmada(s).';
}

/**
 * Grava o pedido de correção por IA desta atividade e mostra o resultado.
 * @param {HTMLElement} saida - Onde mostrar o resultado.
 * @returns {Promise<void>}
 */
async function pedirCorrecaoIaPainelDinamica(saida) {
    try {
        const gravou = await pedirCorrecaoIaDaDinamica(estadoProfessorDinamica.atividadeId);
        saida.textContent = gravou
            ? MSG_PEDIDO_IA_ENVIADO_DINAMICA : MSG_PEDIDO_IA_PENDENTE_DINAMICA;
    } catch (erro) {
        saida.textContent = '❌ ' + erro.message;
    }
}

/**
 * Mostra o estado do último pedido de correção por IA (sem pedido: nada).
 * @param {HTMLElement} saida - Onde mostrar o estado.
 * @returns {Promise<void>}
 */
async function mostrarUltimoPedidoIaDinamica(saida) {
    try {
        const estado = await lerUltimoPedidoIaDaDinamica(estadoProfessorDinamica.atividadeId);
        if (!estado) return;
        saida.textContent = estado === ESTADO_PENDENTE_IA_DINAMICA
            ? MSG_PEDIDO_IA_PENDENTE_DINAMICA : MSG_PEDIDO_IA_CONCLUIDO_DINAMICA;
    } catch (erro) {
        saida.textContent = '';
    }
}

/**
 * Cria a barra da correção por IA: pedir correção, confirmar todas as sugestões e situação.
 * @param {HTMLElement} painel - Seção do painel de notas.
 * @returns {HTMLElement} Barra (já inserida antes do texto do painel).
 */
function montarBarraIaDinamica(painel) {
    const barra = criarElementoDinamica('div', 'dinamica__barra-ia');
    const saida = criarElementoDinamica('span', 'dinamica__barra-ia-texto');
    barra.append(
        criarBotaoDinamica(TEXTO_PEDIR_IA_DINAMICA, () => pedirCorrecaoIaPainelDinamica(saida)),
        criarBotaoDinamica(TEXTO_CONFIRMAR_TODAS_IA_DINAMICA,
            () => confirmarTodasSugestoesIaDinamica(painel, saida)),
        saida);
    painel.querySelector('.' + CLASSE_TEXTO_DINAMICA).before(barra);
    mostrarUltimoPedidoIaDinamica(saida);
    return barra;
}

/**
 * Inicia o painel do professor: mostra roteiro e notas e carrega a turma.
 * @returns {Promise<void>}
 */
async function iniciarNotasDaDinamica() {
    if (!(await ehProfessorDinamica())) return;

    const painel = document.getElementById(ID_NOTAS_DINAMICA);
    document.getElementById(ID_ROTEIRO_DINAMICA).hidden = false;
    painel.hidden = false;
    const aviso = painel.querySelector('.' + CLASSE_TEXTO_DINAMICA);
    try {
        const atividade = await lerAtividadeDaDinamica();
        if (!atividade) { aviso.textContent = MSG_SEM_ATIVIDADE_DINAMICA; return; }
        estadoProfessorDinamica.atividadeId = atividade.id;
        estadoProfessorDinamica.criterios = lerCriteriosDaDinamica();
        montarBarraIaDinamica(painel);
        await montarComboTurmaDinamica(painel, await lerTurmasDaDinamica(atividade.cursoId));
    } catch (erro) {
        aviso.textContent = MSG_ERRO_DINAMICA + erro.message;
    }
}

document.addEventListener('DOMContentLoaded', iniciarNotasDaDinamica);
