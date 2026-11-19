// Botão "Logar Como Usuário": encerra a sessão atual e abre uma NOVA sessão como o usuário
// da linha, usando o e-mail e a senha inicial da própria linha. Serve na tabela do modo
// banco (scripts/criarUsuariosBancoDados.html, alunos) e na tabela de professores do
// painel-professor.html (#553). O prefixo das páginas de destino acompanha a pasta da
// tela ('../' dentro de /scripts/, raiz nas demais).
// Fluxo: 1) popup de confirmação; 2) testa e-mail + senha com um cliente TEMPORÁRIO (sem gravar
// sessão): se falhar, avisa e o professor continua logado; 3) se passar, signOut do professor,
// signInWithPassword no cliente principal, grava os dados de exibição (salvarSessaoLocal, de
// js/login.js, mesmas chaves do login) e vai para o index.html.
// A senha nunca vai para localStorage, sessionStorage, atributo HTML, log ou URL: vive só na
// função da linha. Depende de: js/supabase.js (SUPABASE, obterClienteSupabase), assets/js/popup.js
// (confirmarPopup, mostrarPopup) e js/login.js (salvarSessaoLocal, limparSessaoLocal).

const TEXTO_BOTAO_LOGAR_COMO = 'Logar Como Usuário';
const ROTULO_LOGAR_COMO = 'Sair da sessão atual e entrar como ';
const ROTULO_SEM_SENHA_LOGAR_COMO = 'Sem senha inicial no banco: não dá para entrar como ';
const CLASSE_CELULA_LOGAR_COMO = 'guia-celula-logar-como';
const CLASSE_BOTAO_LOGAR_COMO = 'guia-botao-logar-como';
// A tela de guia fica em /scripts/ (volta uma pasta); o painel e demais ficam na raiz.
const PREFIXO_PAGINAS_LOGAR_COMO = location.pathname.includes('/scripts/') ? '../' : '';
const PAGINA_INICIAL_APOS_LOGAR_COMO = PREFIXO_PAGINAS_LOGAR_COMO + 'index.html';
const PAGINA_LOGIN_APOS_FALHA_LOGAR_COMO = PREFIXO_PAGINAS_LOGAR_COMO + 'login.html';
const STATUS_CREDENCIAL_INVALIDA_LOGAR_COMO = 400;
// Cliente de teste: não guarda sessão, não renova token e não lê a URL (nada toca a sessão real).
const OPCOES_CLIENTE_TESTE_LOGAR_COMO = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

const TITULO_CONFIRMAR_LOGAR_COMO = 'Entrar como o usuário';
const TEXTO_CONFIRMAR_LOGAR_COMO = 'Sair e entrar como o usuário';
const TITULO_ERRO_LOGAR_COMO = 'Não foi possível entrar como o usuário';
const MSG_LOGAR_COMO_SENHA_NAO_FUNCIONA = 'A senha inicial não funciona mais (o usuário '
    + 'provavelmente já trocou a senha). Você continua logado como professor.';
const MSG_LOGAR_COMO_SEM_CONEXAO = 'Não foi possível conectar ao servidor para testar o acesso. '
    + 'Você continua logado como professor.';
const MSG_LOGAR_COMO_SEM_BIBLIOTECA = 'A biblioteca do Supabase não foi carregada nesta página. '
    + 'Você continua logado como professor.';
const MSG_LOGAR_COMO_TROCA_FALHOU = 'A sessão de professor foi encerrada, mas não foi possível '
    + 'abrir a sessão do aluno. Faça login de novo.';

/**
 * Cria um cliente supabase-js temporário, que não guarda sessão (usado só para testar a senha).
 * @returns {Object|null} Cliente temporário, ou null se a biblioteca não foi carregada.
 */
function criarClienteTemporarioLogarComo() {
    const bibliotecaCarregada = Boolean(window.supabase?.createClient);
    if (!bibliotecaCarregada) return null;

    return window.supabase.createClient(SUPABASE.URL, SUPABASE.KEY,
        OPCOES_CLIENTE_TESTE_LOGAR_COMO);
}

/**
 * Reúne as dependências usadas no fluxo (injetadas para o fluxo não conhecer o DOM nem o site).
 * @returns {Object} Funções de cliente, popup, sessão local e navegação.
 */
function obterDependenciasLogarComo() {
    return {
        criarClienteTemporario: criarClienteTemporarioLogarComo,
        obterClientePrincipal: obterClienteSupabase,
        confirmar: confirmarPopup,
        avisar: mostrarPopup,
        salvarSessao: salvarSessaoLocal,
        limparSessao: limparSessaoLocal,
        irPara: (endereco) => location.assign(endereco),
    };
}

/**
 * Monta o texto do popup de confirmação.
 * @param {string} nome - Nome do aluno da linha.
 * @returns {string} Mensagem do popup.
 */
function montarMensagemConfirmarLogarComo(nome) {
    return 'Você vai sair da sessão atual e entrar como ' + nome + '.\n'
        + 'Para voltar, será preciso fazer login de novo.';
}

/**
 * Diz se o erro do Supabase Auth indica e-mail ou senha incorretos.
 * @param {{status?: number, message?: string}} erro - Erro devolvido pelo signInWithPassword.
 * @returns {boolean} true se a credencial foi recusada.
 */
function ehCredencialInvalidaLogarComo(erro) {
    return erro.status === STATUS_CREDENCIAL_INVALIDA_LOGAR_COMO
        || /invalid/i.test(erro.message || '');
}

/**
 * Testa e-mail e senha com o cliente temporário, sem mexer na sessão do professor.
 * @param {{email: string, senha: string}} credenciais - Acesso do aluno.
 * @param {Object} dependencias - Dependências (criarClienteTemporario).
 * @throws {Error} Com a mensagem a mostrar ao professor se o teste falhar.
 */
async function testarCredenciaisLogarComo(credenciais, dependencias) {
    const cliente = dependencias.criarClienteTemporario();
    if (!cliente) throw new Error(MSG_LOGAR_COMO_SEM_BIBLIOTECA);

    let resposta;
    try {
        resposta = await cliente.auth.signInWithPassword(
            { email: credenciais.email, password: credenciais.senha });
    } catch (erro) {
        throw new Error(MSG_LOGAR_COMO_SEM_CONEXAO);
    }
    if (!resposta.error) return;

    const mensagem = ehCredencialInvalidaLogarComo(resposta.error)
        ? MSG_LOGAR_COMO_SENHA_NAO_FUNCIONA : MSG_LOGAR_COMO_SEM_CONEXAO;
    throw new Error(mensagem);
}

/**
 * Fecha a sessão do professor e abre a do aluno no cliente principal; depois vai para o início.
 * Se a troca falhar depois do signOut, manda para o login (o professor já saiu).
 * @param {{email: string, senha: string}} credenciais - Acesso do aluno (já testado).
 * @param {Object} dependencias - Dependências do fluxo.
 * @returns {Promise<boolean>} true se a sessão do aluno foi aberta.
 */
async function trocarSessaoParaAlunoLogarComo(credenciais, dependencias) {
    const cliente = dependencias.obterClientePrincipal();
    if (!cliente) {
        await dependencias.avisar(MSG_LOGAR_COMO_SEM_BIBLIOTECA, { tipo: 'erro' });
        return false;
    }
    try {
        await cliente.auth.signOut();
        dependencias.limparSessao();
        const { data, error } = await cliente.auth.signInWithPassword(
            { email: credenciais.email, password: credenciais.senha });
        if (error) throw error;
        dependencias.salvarSessao(data.user);
    } catch (erro) {
        await dependencias.avisar(MSG_LOGAR_COMO_TROCA_FALHOU, { tipo: 'erro' });
        dependencias.irPara(PAGINA_LOGIN_APOS_FALHA_LOGAR_COMO);
        return false;
    }
    dependencias.irPara(PAGINA_INICIAL_APOS_LOGAR_COMO);
    return true;
}

/**
 * Fluxo completo do botão: confirmar, testar a senha e só então trocar a sessão.
 * @param {{nome: string, email: string, senha: string|null}} aluno - Aluno da linha.
 * @param {Object} dependencias - Dependências do fluxo.
 * @returns {Promise<boolean>} true se a sessão do aluno foi aberta; false se nada mudou.
 */
async function logarComoAlunoGuia(aluno, dependencias) {
    const credenciais = { email: aluno.email.trim().toLowerCase(), senha: aluno.senha };
    const confirmou = await dependencias.confirmar(montarMensagemConfirmarLogarComo(aluno.nome), {
        titulo: TITULO_CONFIRMAR_LOGAR_COMO,
        textoConfirmar: TEXTO_CONFIRMAR_LOGAR_COMO,
    });
    if (!confirmou) return false;

    try {
        await testarCredenciaisLogarComo(credenciais, dependencias);
    } catch (erro) {
        await dependencias.avisar(erro.message, { tipo: 'erro', titulo: TITULO_ERRO_LOGAR_COMO });
        return false;
    }
    return trocarSessaoParaAlunoLogarComo(credenciais, dependencias);
}

/**
 * Trata o clique: bloqueia o botão durante o fluxo e o libera se a sessão não mudou.
 * @param {HTMLButtonElement} botao - Botão da linha.
 * @param {Object} aluno - Aluno da linha.
 */
async function aoClicarLogarComoGuia(botao, aluno) {
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    const entrou = await logarComoAlunoGuia(aluno, obterDependenciasLogarComo());
    if (entrou) return;

    botao.disabled = false;
    botao.removeAttribute('aria-busy');
}

/**
 * Cria o botão "Logar Como Usuario" (desabilitado quando a linha não tem senha no banco).
 * A senha fica só na closure do clique: nada em atributo, storage ou log.
 * @param {{nome: string, email: string, senha: string|null}} aluno - Aluno lido do banco.
 * @returns {HTMLButtonElement} Botão pronto.
 */
function criarBotaoLogarComoGuia(aluno) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO_LOGAR_COMO;
    botao.textContent = TEXTO_BOTAO_LOGAR_COMO;
    const temSenha = Boolean(aluno.senha);
    botao.disabled = !temSenha;
    const rotulo = (temSenha ? ROTULO_LOGAR_COMO : ROTULO_SEM_SENHA_LOGAR_COMO) + aluno.nome;
    botao.setAttribute('aria-label', rotulo);
    botao.title = rotulo;
    botao.addEventListener('click', () => aoClicarLogarComoGuia(botao, aluno));
    return botao;
}

/**
 * Cria a célula da coluna "Acessar" com o botão "Logar Como Usuario".
 * @param {{nome: string, email: string, senha: string|null}} aluno - Aluno lido do banco.
 * @returns {HTMLTableCellElement} Célula pronta.
 */
function criarCelulaLogarComoGuia(aluno) {
    const celula = document.createElement('td');
    celula.className = CLASSE_CELULA_LOGAR_COMO;
    celula.append(criarBotaoLogarComoGuia(aluno));
    return celula;
}
