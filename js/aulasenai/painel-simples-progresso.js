// Professor: ON/OFF "PAINEL SIMPLES" do Progresso da turma GLOBAL (progresso-turma-global.js).
// Ligado, a lista de alunos vira uma tabela só com Aluno, Lançado AVA e Nota; todos os outros
// campos (questões, barra, situação, nota parcial, botões, suspeita de cópia) ficam escondidos.
// Desligado (padrão), volta a lista completa. A escolha fica guardada no navegador. Só muda a tela:
// nada é gravado aqui (o "Lançado AVA" da tabela é o mesmo controle de lancado-ava-progresso.js).
// Carregado por progresso-turma-global.js. Estilo: assets/css/progresso-turma-global.css.

const CLASSE_PAINEL_SIMPLES = 'progresso-turma__painel-simples';
const CLASSE_INTERRUPTOR_PAINEL_SIMPLES = 'progresso-turma__interruptor';
const MEMORIA_PAINEL_SIMPLES = 'progresso-turma:painel-simples';
const TEXTO_PAINEL_SIMPLES = 'PAINEL SIMPLES';
const DICA_PAINEL_SIMPLES = 'Ligado: lista só o nome do aluno, o Lançado AVA e a nota.';
const DICA_PAINEL_SIMPLES_TRAVADO = DICA_PAINEL_SIMPLES +
    ' Fixo ligado para o professor sem ser administrador.';
const COLUNAS_PAINEL_SIMPLES = ['Aluno', 'Lançado AVA', 'Nota'];

/**
 * Lê a escolha guardada no navegador (falha ao ler = desligado).
 * @returns {boolean} true se o painel simples estava ligado.
 */
function lerPainelSimplesGuardado() {
    try {
        return localStorage.getItem(MEMORIA_PAINEL_SIMPLES) === 'sim';
    } catch (erro) {
        return false;
    }
}

/**
 * Guarda a escolha no navegador (se o navegador recusar, só não guarda).
 * @param {boolean} ligado - Estado do painel simples.
 */
function gravarPainelSimplesGuardado(ligado) {
    try {
        localStorage.setItem(MEMORIA_PAINEL_SIMPLES, ligado ? 'sim' : 'nao');
    } catch (erro) {
        console.warn('Painel simples: escolha não guardada.', erro.message);
    }
}

/**
 * Monta a tabela do painel simples.
 * @param {Object[]} alunos - Alunos visíveis, já na ordem da lista.
 * @param {{criarLancadoAva: function(Object): (HTMLElement|undefined),
 *     montarNota: function(Object): HTMLElement}} fabricas - Controles de cada célula.
 * @returns {HTMLTableElement} Tabela pronta.
 */
function montarTabelaPainelSimples(alunos, fabricas) {
    const tabela = document.createElement('table');
    tabela.className = CLASSE_PAINEL_SIMPLES;
    const cabecalho = tabela.createTHead().insertRow();
    COLUNAS_PAINEL_SIMPLES.forEach((titulo) => {
        const celula = document.createElement('th');
        celula.textContent = titulo;
        cabecalho.appendChild(celula);
    });
    const corpo = tabela.createTBody();
    alunos.forEach((aluno) => {
        const linha = corpo.insertRow();
        linha.insertCell().textContent = aluno.nome;
        const celulaAva = linha.insertCell();
        const lancado = fabricas.criarLancadoAva(aluno);
        if (lancado) celulaAva.appendChild(lancado);
        linha.insertCell().appendChild(fabricas.montarNota(aluno));
    });
    return tabela;
}

/**
 * Cria o ON/OFF "PAINEL SIMPLES" e o estado dele.
 * @param {{aoMudar: function(): void, travado?: boolean}} dados - O que fazer depois de ligar
 *     ou desligar. travado=true: nasce ligado e desabilitado (professor sem ser administrador,
 *     #554) e a escolha guardada não manda.
 * @returns {{elemento: HTMLLabelElement, ligado: function(): boolean,
 *     montarTabela: function(Object[], Object): HTMLTableElement}} Controle pronto.
 */
function criarPainelSimplesProgresso(dados) {
    const etiqueta = document.createElement('label');
    etiqueta.className = CLASSE_INTERRUPTOR_PAINEL_SIMPLES;
    etiqueta.title = dados.travado ? DICA_PAINEL_SIMPLES_TRAVADO : DICA_PAINEL_SIMPLES;
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = dados.travado === true || lerPainelSimplesGuardado();
    caixa.disabled = dados.travado === true;
    caixa.addEventListener('change', () => {
        gravarPainelSimplesGuardado(caixa.checked);
        dados.aoMudar();
    });
    const chave = document.createElement('span');
    chave.className = CLASSE_INTERRUPTOR_PAINEL_SIMPLES + '-chave';
    const texto = document.createElement('span');
    texto.textContent = TEXTO_PAINEL_SIMPLES;
    etiqueta.append(caixa, chave, texto);
    return { elemento: etiqueta, ligado: () => caixa.checked,
        montarTabela: montarTabelaPainelSimples };
}

window.criarPainelSimplesProgresso = criarPainelSimplesProgresso;
