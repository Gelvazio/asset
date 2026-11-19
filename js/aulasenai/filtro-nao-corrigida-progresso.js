// Professor: ON/OFF "Atividade Não Corrigida" no Progresso da turma GLOBAL
// (progresso-turma-global.js), em toda atividade. Desligado (padrão): não filtra. Ligado: lista
// SÓ os alunos cuja prova ainda NÃO está corrigida (campo provaCorrigida, de
// progresso-turma-fontes.js: objetiva = entregue; discursiva = entregue e com a nota do
// professor em todas as questões respondidas). É o inverso de "Atividade Corrigida". A escolha
// fica no localStorage do navegador (preferências injetadas pelo painel). Só filtra a lista na tela:
// nada é gravado no banco. Pedido do usuário em 2026-11-09. Regra: docs/regras/atividades.md

const TEXTO_FILTRO_NAO_CORRIGIDA = 'Atividade Não Corrigida';
const DICA_FILTRO_NAO_CORRIGIDA = 'Desligado: não filtra. Ligado: só quem ainda NÃO tem a ' +
    'prova corrigida (objetiva: não entregou; discursiva: falta nota do professor).';
const CLASSE_INTERRUPTOR_NAO_CORRIGIDA = 'progresso-turma__interruptor';
const CHAVE_PREFERENCIA_NAO_CORRIGIDA = 'atividade-nao-corrigida';
const VALOR_LIGADO_PREFERENCIA_NAO_CORRIGIDA = 'sim';
const VALOR_DESLIGADO_PREFERENCIA_NAO_CORRIGIDA = 'nao';

/**
 * Cria o filtro "Atividade Não Corrigida" do Progresso da turma (abre na escolha guardada no
 * navegador; sem ela, desligado = não filtra).
 * @param {Function} aoMudar - Redesenha a lista quando o ON/OFF muda.
 * @param {{ler: Function, gravar: Function}} [preferencias] - Escolhas guardadas no navegador.
 * @returns {{elemento: HTMLElement, filtrar: Function}} Interruptor e a função que devolve os
 *   alunos visíveis (ligado: só os não corrigidos; desligado: todos).
 */
function criarFiltroNaoCorrigida(aoMudar, preferencias) {
    const elemento = document.createElement('label');
    elemento.className = CLASSE_INTERRUPTOR_NAO_CORRIGIDA;
    elemento.title = DICA_FILTRO_NAO_CORRIGIDA;
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = preferencias?.ler(CHAVE_PREFERENCIA_NAO_CORRIGIDA) ===
        VALOR_LIGADO_PREFERENCIA_NAO_CORRIGIDA;
    caixa.addEventListener('change', () => {
        preferencias?.gravar(CHAVE_PREFERENCIA_NAO_CORRIGIDA, caixa.checked
            ? VALOR_LIGADO_PREFERENCIA_NAO_CORRIGIDA : VALOR_DESLIGADO_PREFERENCIA_NAO_CORRIGIDA);
        aoMudar();
    });
    const chave = document.createElement('span');
    chave.className = CLASSE_INTERRUPTOR_NAO_CORRIGIDA + '-chave';
    const texto = document.createElement('span');
    texto.textContent = TEXTO_FILTRO_NAO_CORRIGIDA;
    elemento.append(caixa, chave, texto);

    return {
        elemento,
        filtrar: (alunos) => (caixa.checked
            ? alunos.filter((aluno) => !aluno.provaCorrigida) : alunos),
    };
}

window.criarFiltroNaoCorrigida = criarFiltroNaoCorrigida;
