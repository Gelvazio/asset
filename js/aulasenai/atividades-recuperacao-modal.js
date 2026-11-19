// Aba "Recuperação" do modal de editar atividade (atividades-crud-modal.js). Só aparece para
// atividade já cadastrada que seja atividade de sala (tipo 1), prova objetiva (tipo 3) ou prática
// (tipo 4). Nela o professor escolhe a atividade original que esta atividade recupera (1
// recuperação por original, do mesmo tipo) e os alunos em recuperação (só eles veem e fazem a
// atividade).
// Separação: estado e regras (funções puras) · DOM (montar/renderizar) · AbaRecuperacaoModal
// (controla o fluxo e recebe o repositório injetado).
// Depende de: js/supabase.js (obterClienteSupabase) e js/recuperacao-repositorio.js.
// Orientação: docs/ORIENTACAO_JS_RECUPERACAO.md

const TEXTO_ABA_ATIVIDADE_RECUPERACAO = 'Atividade';
const TEXTO_ABA_RECUPERACAO = 'Recuperação';
const TEXTO_SEM_ORIGINAL_RECUPERACAO = 'Nenhuma (não é recuperação)';
const TEXTO_BOTAO_SALVAR_RECUPERACAO = 'Salvar recuperação';
const TEXTO_BUSCA_ALUNOS_RECUPERACAO = 'Buscar aluno ou turma';
const MSG_CARREGANDO_RECUPERACAO = 'Carregando a recuperação...';
const MSG_SALVA_RECUPERACAO = '✅ Recuperação salva.';
const MSG_SALVA_SEM_ALUNOS_RECUPERACAO =
    '✅ Recuperação salva. Nenhum aluno marcado: ninguém verá esta atividade.';
const MSG_VINCULO_REMOVIDO_RECUPERACAO = '✅ Vínculo de recuperação removido.';
const MSG_ERRO_RECUPERACAO = 'Não foi possível concluir. Confira o login de professor e o banco.';
const MSG_SEM_ALUNOS_RECUPERACAO = 'Nenhum aluno encontrado.';
const MSG_ESCOLHA_PROVA_RECUPERACAO = 'Escolha a atividade original para marcar os alunos.';
const MSG_ABA_BANCO_RECUPERACAO = 'Conexão com o banco indisponível.';
const MSG_PLURAL_ALUNOS_RECUPERACAO = ' aluno(s) em recuperação';
const SELETOR_ACENTOS_RECUPERACAO = /[̀-ͯ]/g;
const CLASSE_ABA_ATIVA_RECUPERACAO = 'recuperacao-abas__botao--ativo';
const TEXTO_BOTAO_FECHAR_RECUPERACAO = 'Fechar';
// Caixa do modal com a aba aberta: só a lista de alunos rola e o rodapé (Salvar e Fechar) fica fixo.
const CLASSE_CAIXA_RECUPERACAO = 'crud-caixa--recuperacao';
const SELETOR_CAIXA_MODAL_RECUPERACAO = '.crud-caixa';

/**
 * Cria um elemento HTML com classe e texto.
 * @param {string} tag - Nome da tag.
 * @param {string} [classe] - Classe CSS.
 * @param {string} [texto] - Texto do elemento.
 * @returns {HTMLElement} Elemento criado.
 */
function criarElementoRecuperacao(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

/**
 * Estado inicial da aba (nada carregado, nada selecionado).
 * @returns {{atividadeId: (number|null), carregado: boolean, salvando: boolean,
 *   originalId: (number|null), provas: Object[], alunos: Object[], selecionados: Set<string>,
 *   termo: string}} Estado vazio.
 */
function criarEstadoRecuperacao() {
    return {
        atividadeId: null,
        carregado: false,
        salvando: false,
        originalId: null,
        provas: [],
        alunos: [],
        selecionados: new Set(),
        termo: '',
    };
}

/**
 * Diz se a atividade em edição pode ser uma recuperação: já cadastrada e atividade de sala,
 * prova objetiva ou prática (o tipo vem de atividade.tipo_avaliacao).
 * @param {Object|null} atividade - Atividade do formulário.
 * @returns {boolean} true se a aba Recuperação deve aparecer.
 */
function ehAtividadeRecuperavel(atividade) {
    if (!atividade?.id) return false;

    const tiposRecuperaveis = [window.TIPO_ATIVIDADE_SALA, window.TIPO_PROVA_OBJETIVA,
        window.TIPO_PROVA_PRATICA];
    return tiposRecuperaveis.includes(atividade.tipo_avaliacao);
}

/**
 * Tira acentos e caixa de um texto, para a busca não depender deles.
 * @param {string} texto - Texto original.
 * @returns {string} Texto normalizado.
 */
function normalizarTextoRecuperacao(texto) {
    return String(texto || '').normalize('NFD').replace(SELETOR_ACENTOS_RECUPERACAO, '')
        .toLowerCase();
}

/**
 * Filtra os alunos pelo nome ou pela turma.
 * @param {{nome: string, turmaCodigo: string}[]} alunos - Alunos elegíveis.
 * @param {string} termo - Texto digitado na busca.
 * @returns {Object[]} Alunos que combinam com o termo (todos, se o termo for vazio).
 */
function filtrarAlunosRecuperacao(alunos, termo) {
    const busca = normalizarTextoRecuperacao(termo).trim();
    if (!busca) return alunos;

    return alunos.filter((aluno) =>
        normalizarTextoRecuperacao(aluno.nome + ' ' + aluno.turmaCodigo).includes(busca));
}

/**
 * Texto de uma prova original no combo: "ID 07 · Nome (Prova objetiva)".
 * @param {{id: number, nome: string, tipo: number, pagina: string}} prova - Prova candidata.
 * @returns {string} Rótulo da opção.
 */
function rotularProvaRecuperacao(prova) {
    const nome = prova.nome || String(prova.pagina || '').split('/').pop() || '';
    const tipo = window.ROTULOS_TIPO_PROVA?.[prova.tipo];
    const sufixo = tipo ? ' (' + tipo + ')' : '';
    return 'ID ' + String(prova.id).padStart(2, '0') + ' · ' + nome + sufixo;
}

/**
 * Monta a barra de abas (Atividade | Recuperação).
 * @returns {{barra: HTMLElement, botaoAtividade: HTMLButtonElement,
 *   botaoRecuperacao: HTMLButtonElement}} Barra e botões.
 */
function montarAbasRecuperacao() {
    const barra = criarElementoRecuperacao('div', 'recuperacao-abas');
    barra.setAttribute('role', 'tablist');
    const criarBotao = (texto) => {
        const botao = criarElementoRecuperacao('button', 'recuperacao-abas__botao', texto);
        botao.type = 'button';
        botao.setAttribute('role', 'tab');
        return botao;
    };
    const botaoAtividade = criarBotao(TEXTO_ABA_ATIVIDADE_RECUPERACAO);
    const botaoRecuperacao = criarBotao(TEXTO_ABA_RECUPERACAO);
    barra.append(botaoAtividade, botaoRecuperacao);
    barra.hidden = true;
    return { barra, botaoAtividade, botaoRecuperacao };
}

/**
 * Monta o bloco dos alunos (busca, contador e lista de chaves ON/OFF).
 * @returns {{bloco: HTMLElement, busca: HTMLInputElement, resumo: HTMLElement,
 *   lista: HTMLElement}} Bloco e controles.
 */
function montarBlocoAlunosRecuperacao() {
    const bloco = criarElementoRecuperacao('div', 'recuperacao-alunos');
    const busca = criarElementoRecuperacao('input', 'recuperacao-alunos__busca');
    busca.type = 'search';
    busca.placeholder = TEXTO_BUSCA_ALUNOS_RECUPERACAO;
    busca.setAttribute('aria-label', TEXTO_BUSCA_ALUNOS_RECUPERACAO);
    const resumo = criarElementoRecuperacao('small', 'recuperacao-alunos__resumo');
    const lista = criarElementoRecuperacao('div', 'recuperacao-alunos__lista');
    bloco.append(
        criarElementoRecuperacao('span', 'crud-campo__rotulo', 'Alunos em recuperação'),
        busca, resumo, lista);
    return { bloco, busca, resumo, lista };
}

/**
 * Monta o painel da aba Recuperação (escondido até a aba ser aberta).
 * @returns {Object} Referências: raiz, selectProva, alunos, botaoSalvar e mensagem.
 */
function montarPainelRecuperacao() {
    const raiz = criarElementoRecuperacao('section', 'recuperacao-painel');
    raiz.setAttribute('role', 'tabpanel');
    const selectProva = criarElementoRecuperacao('select', 'recuperacao-painel__prova');
    const campoProva = criarElementoRecuperacao('label', 'crud-campo');
    campoProva.append(criarElementoRecuperacao('span', 'crud-campo__rotulo',
        'Atividade original que esta atividade recupera'), selectProva);
    const alunos = montarBlocoAlunosRecuperacao();
    const botaoSalvar = criarElementoRecuperacao('button', 'crud-btn crud-btn--principal',
        TEXTO_BOTAO_SALVAR_RECUPERACAO);
    botaoSalvar.type = 'button';
    const mensagem = criarElementoRecuperacao('p', 'crud-mensagem');
    const botaoFechar = criarElementoRecuperacao('button', 'crud-btn',
        TEXTO_BOTAO_FECHAR_RECUPERACAO);
    botaoFechar.type = 'button';
    // data-acao="fechar": o clique é tratado por atividades-crud-modal.js (aoClicarModalCrud).
    botaoFechar.dataset.acao = 'fechar';
    const rodape = criarElementoRecuperacao('div', 'recuperacao-rodape');
    rodape.append(botaoSalvar, botaoFechar, mensagem);
    raiz.append(campoProva, alunos.bloco, rodape);
    raiz.hidden = true;
    return { raiz, selectProva, alunos, botaoSalvar, mensagem };
}

/**
 * Preenche o combo com "Nenhuma" e as provas candidatas; garante a prova já ligada.
 * @param {HTMLSelectElement} select - Combo da prova original.
 * @param {{provas: Object[], originalId: (number|null)}} estado - Estado da aba.
 */
function renderizarProvasRecuperacao(select, estado) {
    const provas = [...estado.provas];
    const faltaLigada = estado.originalId && !provas.some((p) => p.id === estado.originalId);
    if (faltaLigada) provas.unshift({ id: estado.originalId, nome: '', tipo: null, pagina: '' });

    const opcoes = [{ valor: '', texto: TEXTO_SEM_ORIGINAL_RECUPERACAO },
        ...provas.map((prova) => (
            { valor: String(prova.id), texto: rotularProvaRecuperacao(prova) }))];
    select.replaceChildren(...opcoes.map(({ valor, texto }) => {
        const opcao = criarElementoRecuperacao('option', '', texto);
        opcao.value = valor;
        return opcao;
    }));
    select.value = estado.originalId ? String(estado.originalId) : '';
}

/**
 * Cria a linha de um aluno: chave ON/OFF + nome + turma.
 * @param {{id: string, nome: string, turmaCodigo: string}} aluno - Aluno elegível.
 * @param {boolean} marcado - Se o aluno está em recuperação.
 * @returns {HTMLLabelElement} Linha do aluno.
 */
function criarLinhaAlunoRecuperacao(aluno, marcado) {
    const linha = criarElementoRecuperacao('label', 'recuperacao-aluno');
    const chave = criarElementoRecuperacao('input');
    chave.type = 'checkbox';
    chave.value = aluno.id;
    chave.checked = marcado;
    linha.append(chave, criarElementoRecuperacao('span', 'recuperacao-aluno__nome', aluno.nome),
        criarElementoRecuperacao('small', 'recuperacao-aluno__turma', aluno.turmaCodigo || ''));
    return linha;
}

/**
 * Desenha a lista de alunos (ou o aviso, quando não há prova original escolhida).
 * @param {Object} blocoAlunos - Referências do bloco dos alunos.
 * @param {Object} estado - Estado da aba.
 */
function renderizarAlunosRecuperacao(blocoAlunos, estado) {
    const { lista, resumo } = blocoAlunos;
    resumo.textContent = estado.selecionados.size + MSG_PLURAL_ALUNOS_RECUPERACAO;
    if (!estado.originalId) {
        lista.replaceChildren(criarElementoRecuperacao('p', 'crud-vazio',
            MSG_ESCOLHA_PROVA_RECUPERACAO));
        return;
    }

    const visiveis = filtrarAlunosRecuperacao(estado.alunos, estado.termo);
    if (!visiveis.length) {
        lista.replaceChildren(
            criarElementoRecuperacao('p', 'crud-vazio', MSG_SEM_ALUNOS_RECUPERACAO));
        return;
    }
    lista.replaceChildren(...visiveis.map(
        (aluno) => criarLinhaAlunoRecuperacao(aluno, estado.selecionados.has(aluno.id))));
}

/**
 * Escolhe a mensagem de sucesso conforme o que foi gravado.
 * @param {{originalId: (number|null), alunoIds: string[]}} gravado - Vínculo gravado.
 * @returns {string} Mensagem para o professor.
 */
function obterMensagemSucessoRecuperacao(gravado) {
    if (!gravado.originalId) return MSG_VINCULO_REMOVIDO_RECUPERACAO;
    if (!gravado.alunoIds.length) return MSG_SALVA_SEM_ALUNOS_RECUPERACAO;
    return MSG_SALVA_RECUPERACAO;
}

/**
 * Controla a aba Recuperação: registra as abas no modal, carrega o estado do banco e grava.
 * O repositório é injetado (criarRecuperacaoRepositorio), sem acesso direto ao banco aqui.
 */
class AbaRecuperacaoModal {
    /**
     * @param {{repositorio: Object, modal: {formulario: HTMLFormElement}}} dependencias -
     *   Repositório da recuperação e elementos do modal (formulário de edição).
     */
    constructor({ repositorio, modal }) {
        this.repositorio = repositorio;
        this.formulario = modal.formulario;
        this.estado = criarEstadoRecuperacao();
        this.abas = montarAbasRecuperacao();
        this.painel = montarPainelRecuperacao();
        this.formulario.before(this.abas.barra);
        this.formulario.after(this.painel.raiz);
        this.ligarEventos();
    }

    /**
     * Liga os eventos das abas, do combo, da busca, das chaves e do botão Salvar.
     */
    ligarEventos() {
        const { botaoAtividade, botaoRecuperacao } = this.abas;
        botaoAtividade.addEventListener('click', () => this.mostrarAba(false));
        botaoRecuperacao.addEventListener('click', () => this.mostrarAba(true));
        this.painel.selectProva.addEventListener('change', () => this.aoTrocarProva());
        this.painel.alunos.busca.addEventListener('input', () => this.aoBuscar());
        this.painel.alunos.lista.addEventListener('change', (evento) => this.aoMarcarAluno(evento));
        this.painel.botaoSalvar.addEventListener('click', () => this.salvar());
    }

    /**
     * Chamado quando o formulário do modal é preenchido: reinicia a aba para a atividade
     * (ou a esconde se não for prova objetiva/prática já cadastrada).
     * @param {Object|null} atividade - Atividade do formulário (null = nova).
     */
    aoPreencher(atividade) {
        const recuperavel = ehAtividadeRecuperavel(atividade);
        Object.assign(this.estado, criarEstadoRecuperacao(),
            { atividadeId: recuperavel ? atividade.id : null });
        this.abas.barra.hidden = !recuperavel;
        this.painel.alunos.busca.value = '';
        this.mostrarMensagem('', false);
        this.renderizar();
        this.mostrarAba(false);
    }

    /**
     * Alterna entre a aba Atividade (formulário) e a aba Recuperação (painel).
     * @param {boolean} mostrarRecuperacao - true para abrir a Recuperação.
     */
    mostrarAba(mostrarRecuperacao) {
        const { botaoAtividade, botaoRecuperacao } = this.abas;
        this.formulario.hidden = mostrarRecuperacao;
        this.painel.raiz.hidden = !mostrarRecuperacao;
        this.formulario.closest(SELETOR_CAIXA_MODAL_RECUPERACAO)
            ?.classList.toggle(CLASSE_CAIXA_RECUPERACAO, mostrarRecuperacao);
        botaoAtividade.classList.toggle(CLASSE_ABA_ATIVA_RECUPERACAO, !mostrarRecuperacao);
        botaoRecuperacao.classList.toggle(CLASSE_ABA_ATIVA_RECUPERACAO, mostrarRecuperacao);
        botaoAtividade.setAttribute('aria-selected', String(!mostrarRecuperacao));
        botaoRecuperacao.setAttribute('aria-selected', String(mostrarRecuperacao));
        const precisaCarregar = mostrarRecuperacao && !this.estado.carregado;
        if (precisaCarregar) this.carregar();
    }

    /**
     * Carrega do banco o vínculo atual, as provas candidatas e os alunos elegíveis.
     * Resposta de uma atividade que já não está em edição é descartada.
     */
    async carregar() {
        const idAtividade = this.estado.atividadeId;
        if (!idAtividade) return;

        this.mostrarMensagem(MSG_CARREGANDO_RECUPERACAO, false);
        try {
            const [vinculo, provas, alunos] = await Promise.all([
                this.repositorio.lerRecuperacao(idAtividade),
                this.repositorio.listarProvasCandidatas(idAtividade),
                this.repositorio.listarAlunosElegiveis(idAtividade),
            ]);
            if (this.estado.atividadeId !== idAtividade) return;

            Object.assign(this.estado, { provas, alunos, carregado: true,
                originalId: vinculo.originalId, selecionados: new Set(vinculo.alunoIds) });
            this.mostrarMensagem('', false);
            this.renderizar();
        } catch (erro) {
            if (this.estado.atividadeId !== idAtividade) return;
            this.mostrarMensagem(erro.message || MSG_ERRO_RECUPERACAO, true);
        }
    }

    /**
     * Redesenha combo, lista de alunos e habilitação dos controles conforme o estado.
     */
    renderizar() {
        const { estado, painel } = this;
        renderizarProvasRecuperacao(painel.selectProva, estado);
        renderizarAlunosRecuperacao(painel.alunos, estado);
        const semCarga = !estado.carregado || estado.salvando;
        painel.selectProva.disabled = semCarga;
        painel.botaoSalvar.disabled = semCarga;
        painel.alunos.busca.disabled = semCarga || !estado.originalId;
    }

    /**
     * Troca a prova original escolhida (vazio = remove o vínculo) e libera ou trava os alunos.
     */
    aoTrocarProva() {
        const valor = this.painel.selectProva.value;
        this.estado.originalId = valor ? Number(valor) : null;
        this.renderizar();
    }

    /**
     * Filtra a lista de alunos pelo texto da busca (a seleção é mantida).
     */
    aoBuscar() {
        this.estado.termo = this.painel.alunos.busca.value;
        renderizarAlunosRecuperacao(this.painel.alunos, this.estado);
    }

    /**
     * Marca ou desmarca um aluno na seleção.
     * @param {Event} evento - Evento change vindo de uma chave da lista.
     */
    aoMarcarAluno(evento) {
        const chave = evento.target;
        if (chave.type !== 'checkbox') return;

        if (chave.checked) this.estado.selecionados.add(chave.value);
        else this.estado.selecionados.delete(chave.value);
        this.painel.alunos.resumo.textContent =
            this.estado.selecionados.size + MSG_PLURAL_ALUNOS_RECUPERACAO;
    }

    /**
     * Grava a recuperação (prova original e alunos) e mostra o resultado.
     */
    async salvar() {
        const { atividadeId, originalId, selecionados } = this.estado;
        if (!atividadeId) return;

        this.estado.salvando = true;
        this.renderizar();
        try {
            const gravado = await this.repositorio.gravarRecuperacao({
                idRecuperacao: atividadeId,
                idOriginal: originalId,
                alunoIds: originalId ? [...selecionados] : [],
            });
            if (this.estado.atividadeId !== atividadeId) return;

            Object.assign(this.estado, { originalId: gravado.originalId,
                selecionados: new Set(gravado.alunoIds) });
            this.mostrarMensagem(obterMensagemSucessoRecuperacao(gravado), false);
        } catch (erro) {
            this.mostrarMensagem(erro.message || MSG_ERRO_RECUPERACAO, true);
        } finally {
            this.estado.salvando = false;
            this.renderizar();
        }
    }

    /**
     * Mostra uma mensagem no painel.
     * @param {string} texto - Mensagem (vazia limpa).
     * @param {boolean} ehErro - true para estilo de erro.
     */
    mostrarMensagem(texto, ehErro) {
        this.painel.mensagem.textContent = texto;
        this.painel.mensagem.classList.toggle('crud-mensagem--erro', ehErro);
    }
}

let abaRecuperacaoInstancia = null;

/**
 * Registra a aba no modal (uma vez só). Chamada pelo atividades-crud-modal.js ao abrir o modal.
 * @param {{formulario: HTMLFormElement}} modal - Elementos do modal de atividades.
 */
function montarAbaRecuperacaoCrud(modal) {
    if (abaRecuperacaoInstancia || !modal) return;

    const cliente = obterClienteSupabase();
    if (!cliente || typeof window.criarRecuperacaoRepositorio !== 'function') {
        console.warn(MSG_ABA_BANCO_RECUPERACAO);
        return;
    }
    abaRecuperacaoInstancia = new AbaRecuperacaoModal({
        repositorio: window.criarRecuperacaoRepositorio(cliente),
        modal,
    });
}

/**
 * Avisa a aba que o formulário do modal foi preenchido com uma atividade (ou limpo).
 * @param {Object|null} atividade - Atividade em edição ou null.
 */
function aoPreencherAbaRecuperacaoCrud(atividade) {
    abaRecuperacaoInstancia?.aoPreencher(atividade);
}

window.abaRecuperacaoCrud = {
    montar: montarAbaRecuperacaoCrud,
    aoPreencher: aoPreencherAbaRecuperacaoCrud,
};
