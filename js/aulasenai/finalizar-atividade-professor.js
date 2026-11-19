// Professor: depois de escolher um aluno em "Respostas dos alunos", mostra embaixo da prova o
// botão "✅ Confirmar Correção" (só para o professor; o aluno mantém o "Finalizar"). Ao clicar,
// confere se o aluno entregou e se todas as alternativas respondidas têm a nota do professor
// (botões Certa / Meia certa / Errada). A alternativa ainda sem nota do professor que a IA marcou
// como CERTA (nota da IA cheia) é confirmada com a nota da IA; as demais (meia certa, errada ou
// sem nota da IA) o professor é obrigado a corrigir (tarefa #154). Então lança a nota:
// soma das notas confirmadas ÷ pontos da prova × 10 × (total de questões ÷ quantidade para a nota
// do aluno: questoes_para_nota, senão o mínimo), no máximo 10 — a mesma conta da função
// notas_media_final, que leva a nota à média final.
// As notas confirmadas já são definitivas (trigger correcao_discursiva_validar).
// Prova já corrigida (entregue e com a nota do professor em todas as respondidas, mesma regra de
// assets/js/corrigidos-discursiva.js): no lugar do botão, só a mensagem "Prova Já Corrigida!"
// (tarefa #169); depois de confirmar, o combo "Pendente Correcao" é atualizado. O aluno não vê
// este bloco (mantém a mensagem dele).
// Carregado por assets/js/avaliacao-discursiva.js. Depende de js/supabase.js e assets/js/popup.js.
// Regra: docs/regras/atividades.md

const CLASSE_FINALIZAR = 'finalizar-atividade';
const SELETOR_DESTINO_FINALIZAR = '.content-section';
const SELETOR_ENTREGA_FINALIZAR = '.entrega-discursiva';
const ROTA_QUESTOES_NOTA_FINALIZAR = '/rest/v1/rpc/questoes_para_nota';
const NOTA_MAXIMA_FINALIZAR = 10;
const TITULO_POPUP_CONFIRMAR_CORRECAO = 'Confirmar Correção';
const TEXTO_BOTAO_CONFIRMAR_CORRECAO = '✅ Confirmar Correção';
const TOLERANCIA_FINALIZAR = 0.001;
const MSG_PROVA_JA_CORRIGIDA = 'Prova Já Corrigida!';
const CLASSE_JA_CORRIGIDA = CLASSE_FINALIZAR + '__corrigida';
const BASE_SCRIPTS_FINALIZAR = document.currentScript?.src.replace(/[^/]*$/, '') || '';
const ARQUIVO_CORRECAO_TURMA_FINALIZAR = 'correcao-turma-professor.js';
const CLASSE_CORRECAO_TURMA_FINALIZAR = 'correcao-turma';
// O bloco "Correção da turma" é só do Professor Administrador (#554); lido uma vez.
const RPC_ADMINISTRADOR_FINALIZAR = 'eh_professor_administrador';
let ehAdministradorCorrecaoTurma = null;

/**
 * Remove o botão "Finalizar Atividade" mostrado antes.
 */
function limparFinalizarAtividade() {
    document.querySelectorAll('.' + CLASSE_FINALIZAR + ', .' + CLASSE_CORRECAO_TURMA_FINALIZAR)
        .forEach((bloco) => bloco.remove());
}

/**
 * Lê uma vez se o professor logado é o administrador (RPC eh_professor_administrador). O bloco
 * "Correção da turma" é só dele (#554); erro = false.
 * @returns {Promise<boolean>} true se administrador.
 */
async function professorEhAdministradorFinalizar() {
    if (ehAdministradorCorrecaoTurma !== null) return ehAdministradorCorrecaoTurma;
    try {
        const { data } = await obterClienteSupabase().rpc(RPC_ADMINISTRADOR_FINALIZAR);
        ehAdministradorCorrecaoTurma = data === true;
    } catch (erro) {
        console.warn('Professor administrador:', erro.message);
        ehAdministradorCorrecaoTurma = false;
    }
    return ehAdministradorCorrecaoTurma;
}

/**
 * Põe acima do bloco o "Correção da turma" (botões que valem para todos os alunos:
 * correcao-turma-professor.js), só para o Professor Administrador (#554). Depois de gravar,
 * atualiza a tela do aluno escolhido. Uma falha aqui não atrapalha o Confirmar Correção.
 * @param {HTMLElement} bloco - Bloco do Confirmar Correção.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno escolhido.
 * @param {number} atividadeId - Id da atividade.
 */
async function mostrarCorrecaoTurmaFinalizar(bloco, aluno, atividadeId) {
    try {
        if (!await professorEhAdministradorFinalizar()) return;
        if (typeof window.mostrarCorrecaoTurma !== 'function') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = BASE_SCRIPTS_FINALIZAR + ARQUIVO_CORRECAO_TURMA_FINALIZAR;
                script.onload = resolve;
                script.onerror = () => reject(new Error(ARQUIVO_CORRECAO_TURMA_FINALIZAR));
                document.head.appendChild(script);
            });
        }
        if (!bloco.isConnected) return;
        window.mostrarCorrecaoTurma({ atividadeId, antesDe: bloco, aoMudar: async () => {
            await window.mostrarConfirmacaoProfessor?.(aluno, atividadeId);
            await mostrarFinalizarAtividade(aluno, atividadeId);
            await window.atualizarPendenteCorrecao?.();
        } });
    } catch (erro) {
        console.warn('Correção da turma:', erro.message);
    }
}

/**
 * Lê a quantidade de questões que conta para a nota do aluno (função questoes_para_nota: a
 * definida pelo professor, senão o mínimo para entregar).
 * @param {number} atividadeId - Id da atividade.
 * @param {string} alunoId - Id do aluno.
 * @returns {Promise<number>} Quantidade de questões para a nota.
 * @throws {Error} Se o banco recusar.
 */
async function lerQuestoesNotaParaFinalizar(atividadeId, alunoId) {
    const resposta = await fetch(SUPABASE.URL + ROTA_QUESTOES_NOTA_FINALIZAR, {
        method: 'POST', headers: await sbH(),
        body: JSON.stringify({ p_atividade: atividadeId, p_aluno: alunoId }),
    });
    if (!resposta.ok) throw new Error(await resposta.text());
    return Number(await resposta.json());
}

/**
 * Lê do banco tudo o que a nota do aluno precisa.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno escolhido.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<Object>} topicos, respostas, correcoes, entregue e questoesNota.
 */
async function lerDadosParaFinalizar(aluno, atividadeId) {
    const filtro = 'atividade_id=eq.' + atividadeId;
    const doAluno = filtro + '&aluno_id=eq.' + aluno.alunoId + '&tentativa=eq.' + aluno.tentativa;
    const [topicos, respostas, correcoes, entregas, questoesNota] = await Promise.all([
        sbGet('topico_discursivo', 'select=item,topico,pontos&' + filtro),
        sbGet('resposta_discursiva', 'select=item,topico,texto&' + doAluno),
        sbGet('correcao_discursiva', 'select=item,topico,nota_ia,nota_professor&' + doAluno),
        sbGet('entrega_atividade', 'select=entregue_em&' + doAluno),
        lerQuestoesNotaParaFinalizar(atividadeId, aluno.alunoId),
    ]);
    return { topicos, respostas, correcoes, entregue: entregas.length > 0, questoesNota };
}

/**
 * Acha as alternativas respondidas, ainda sem nota do professor, que a IA marcou como certa
 * (nota da IA cheia) — as únicas que o professor não precisa corrigir à mão.
 * @param {Object} dados - Resultado de lerDadosParaFinalizar.
 * @returns {Object[]} Linhas {item, topico, pontos} a confirmar com a nota da IA.
 */
function listarCertasDaIaSemNotaDoProfessor(dados) {
    const chave = (linha) => linha.item + '|' + linha.topico;
    const correcoes = new Map(dados.correcoes.map((linha) => [chave(linha), linha]));
    const pontos = new Map(dados.topicos.map((linha) => [chave(linha), Number(linha.pontos)]));
    return dados.respostas.filter((linha) => (linha.texto || '').trim())
        .map((linha) => ({ item: linha.item, topico: linha.topico, correcao:
            correcoes.get(chave(linha)), pontos: pontos.get(chave(linha)) || 0 }))
        .filter(({ correcao, pontos: cheia }) => {
            const semNotaDoProfessor = !correcao ||
                correcao.nota_professor === null || correcao.nota_professor === undefined;
            const iaMarcouCerta = correcao && correcao.nota_ia !== null &&
                correcao.nota_ia !== undefined &&
                Number(correcao.nota_ia) >= cheia - TOLERANCIA_FINALIZAR;
            return semNotaDoProfessor && cheia > 0 && Boolean(iaMarcouCerta);
        })
        .map(({ item, topico, pontos: cheia }) => ({ item, topico, pontos: cheia }));
}

/**
 * Confirma no banco, com a nota cheia da IA, as alternativas certas ainda sem nota do professor
 * e atualiza os dados lidos (a nota confirmada vale na média e não muda mais).
 * @param {Object[]} certas - Resultado de listarCertasDaIaSemNotaDoProfessor.
 * @param {{aluno: Object, atividadeId: number, dados: Object}} contexto - Aluno, atividade e
 *     dados lidos (alterados no lugar: ganham a nota_professor).
 * @throws {Error} Se o banco recusar alguma gravação.
 */
async function confirmarCertasDaIa(certas, contexto) {
    for (const certa of certas) {
        await gravarNotaDoProfessor({ aluno_id: contexto.aluno.alunoId,
            atividade_id: contexto.atividadeId, tentativa: contexto.aluno.tentativa,
            item: certa.item, topico: certa.topico, nota_professor: certa.pontos });
        const linha = contexto.dados.correcoes.find((correcao) =>
            correcao.item === certa.item && correcao.topico === certa.topico);
        linha.nota_professor = certa.pontos;
    }
}

/**
 * Calcula a nota do aluno a partir das notas confirmadas pelo professor.
 * @param {Object} dados - Resultado de lerDadosParaFinalizar.
 * @returns {Object} nota, pendentes, certas, meias, erradas, emBranco, questoesNota,
 *     totalQuestoes.
 */
function calcularNotaDoAluno(dados) {
    const chave = (linha) => linha.item + '|' + linha.topico;
    const respondidas = new Set(dados.respostas.filter((linha) => (linha.texto || '').trim())
        .map(chave));
    const notas = new Map(dados.correcoes.map((linha) => [chave(linha), linha.nota_professor]));
    const pontos = new Map(dados.topicos.map((linha) => [chave(linha), Number(linha.pontos)]));
    const contagem = { certas: 0, meias: 0, erradas: 0, pendentes: 0, soma: 0 };
    respondidas.forEach((topico) => {
        const nota = notas.get(topico);
        if (nota === null || nota === undefined) {
            contagem.pendentes += 1;
            return;
        }
        contagem.soma += Number(nota);
        if (Number(nota) >= (pontos.get(topico) || 0) - TOLERANCIA_FINALIZAR) contagem.certas += 1;
        else if (Number(nota) > 0) contagem.meias += 1;
        else contagem.erradas += 1;
    });
    const totalPontos = [...pontos.values()].reduce((soma, valor) => soma + valor, 0);
    const totalQuestoes = new Set(dados.topicos.map((linha) => linha.item)).size;
    const nota = Math.min(NOTA_MAXIMA_FINALIZAR,
        contagem.soma / totalPontos * NOTA_MAXIMA_FINALIZAR * totalQuestoes /
            dados.questoesNota);
    return { ...contagem, nota, totalQuestoes,
        questoesNota: dados.questoesNota,
        emBranco: dados.topicos.length - respondidas.size, respondidas: respondidas.size };
}

/**
 * Formata a nota com duas casas.
 * @param {number} nota - Nota.
 * @returns {string} Nota formatada.
 */
function formatarNotaFinalizar(nota) {
    return nota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Explica por que ainda não dá para finalizar (ou '' quando pode).
 * @param {Object} dados - Dados lidos do banco.
 * @param {Object} resultado - Resultado de calcularNotaDoAluno.
 * @returns {string} Motivo do bloqueio ou ''.
 */
function motivoParaNaoFinalizar(dados, resultado) {
    if (!dados.entregue) return 'O aluno ainda não entregou a avaliação.';
    if (!resultado.respondidas) return 'O aluno não respondeu nenhuma alternativa.';
    if (!resultado.pendentes) return '';
    return 'Ainda faltam ' + resultado.pendentes + ' alternativa(s) respondida(s) sem a sua ' +
        'confirmação (✅ Certa / 🟡 Meia certa / ❌ Errada). Só as que a IA marcou como certas ' +
        'são confirmadas por ela; as demais você precisa corrigir.';
}

/**
 * Mostra o resultado da finalização (nota lançada e contagem).
 * @param {Object} resultado - Resultado de calcularNotaDoAluno.
 * @param {HTMLElement} situacao - Texto embaixo do botão.
 */
async function mostrarNotaLancada(resultado, situacao) {
    const texto = '🎓 Nota lançada: ' + formatarNotaFinalizar(resultado.nota) + ' (sobre ' +
        resultado.questoesNota + ' de ' + resultado.totalQuestoes + ' questões, ' +
        'máximo 10). Alternativas: ' + resultado.certas + ' certa(s), ' + resultado.meias +
        ' meia(s) certa(s), ' + resultado.erradas + ' errada(s); ' + resultado.emBranco +
        ' em branco (não contam).';
    situacao.textContent = texto;
    await mostrarPopup(texto + '\n\nA nota já vale na média final do aluno.',
        { tipo: 'sucesso', titulo: 'Correção confirmada' });
}

/**
 * Copia os dados lidos já com as certas da IA confirmadas (só na memória), para calcular a nota
 * que o aluno terá depois de confirmar.
 * @param {Object} dados - Dados lidos do banco.
 * @param {Object[]} certas - Certas da IA sem nota do professor (item, topico, pontos).
 * @returns {Object} Cópia dos dados com a nota do professor nas certas da IA.
 */
function simularCertasDaIa(dados, certas) {
    const correcoes = dados.correcoes.map((linha) => ({ ...linha }));
    certas.forEach((certa) => {
        const linha = correcoes.find((c) => c.item === certa.item && c.topico === certa.topico);
        if (linha) linha.nota_professor = certa.pontos;
        else correcoes.push({ item: certa.item, topico: certa.topico,
            nota_professor: certa.pontos });
    });
    return { ...dados, correcoes };
}

/**
 * Monta o texto do modal de confirmação com a nota calculada do aluno.
 * @param {Object} previa - Resultado de calcularNotaDoAluno (já com as certas da IA).
 * @param {{nome: string}} aluno - Aluno escolhido.
 * @param {number} quantidadeCertasIa - Certas da IA que serão confirmadas com a nota da IA.
 * @returns {string} Texto do modal.
 */
function montarTextoConfirmarCorrecao(previa, aluno, quantidadeCertasIa) {
    const linhas = ['Nota calculada de ' + (aluno.nome || 'aluno') + ': ' +
        formatarNotaFinalizar(previa.nota) + ' (máximo 10)',
    previa.certas + ' certa(s), ' + previa.meias + ' meia(s) certa(s), ' + previa.erradas +
        ' errada(s); ' + previa.emBranco + ' em branco (não contam).'];
    if (quantidadeCertasIa) {
        linhas.push(quantidadeCertasIa + ' alternativa(s) sem a sua correção estão certas pela ' +
            'IA e serão confirmadas com a nota da IA.');
    }
    linhas.push('Depois de confirmada, a nota só pode ser mudada com uma justificativa, que ' +
        'fica no histórico.');
    return linhas.join('\n\n');
}

/**
 * Abre o modal "Confirmar Correção" com a nota calculada: Cancelar (vermelho claro) e Confirmar
 * (verde), os dois à direita.
 * @param {Object} previa - Nota prevista (calcularNotaDoAluno).
 * @param {{aluno: Object}} tela - Aluno escolhido.
 * @param {number} quantidadeCertasIa - Certas da IA que serão confirmadas.
 * @returns {Promise<boolean>} true se o professor confirmou.
 */
function perguntarConfirmarCorrecao(previa, tela, quantidadeCertasIa) {
    return confirmarPopup(montarTextoConfirmarCorrecao(previa, tela.aluno, quantidadeCertasIa),
        { titulo: TITULO_POPUP_CONFIRMAR_CORRECAO, tipo: 'aviso',
            textoConfirmar: 'Confirmar', textoCancelar: 'Cancelar',
            classeConfirmar: 'popup__botao--verde',
            classeCancelar: 'popup__botao--vermelho-claro' });
}

/**
 * Mostra a nota calculada, pede a confirmação do professor e grava a nota da IA nas certas.
 * @param {Object[]} certas - Resultado de listarCertasDaIaSemNotaDoProfessor.
 * @param {Object} dados - Dados lidos do banco (ganham a nota_professor das certas da IA).
 * @param {{aluno: Object, atividadeId: number}} tela - Aluno e atividade.
 * @returns {Promise<boolean>} false se o professor desistiu (nada é gravado).
 * @throws {Error} Se o banco recusar alguma gravação.
 */
async function aceitarCertasDaIa(certas, dados, tela) {
    const previa = calcularNotaDoAluno(simularCertasDaIa(dados, certas));
    if (!await perguntarConfirmarCorrecao(previa, tela, certas.length)) return false;
    if (!certas.length) return true;

    await confirmarCertasDaIa(certas, { aluno: tela.aluno, atividadeId: tela.atividadeId,
        dados });
    return true;
}

/**
 * Trata o clique em "Confirmar Correção".
 * @param {{aluno: Object, atividadeId: number, bloco: HTMLElement, botao: HTMLElement,
 *     situacao: HTMLElement}} tela - Aluno, atividade e elementos do bloco.
 */
async function finalizarAtividadeDoAluno(tela) {
    tela.botao.disabled = true;
    try {
        const dados = await lerDadosParaFinalizar(tela.aluno, tela.atividadeId);
        const certasDaIa = listarCertasDaIaSemNotaDoProfessor(dados);
        const previa = calcularNotaDoAluno(dados);
        const pendentesSemIa = { ...previa, pendentes: previa.pendentes - certasDaIa.length };
        const motivo = motivoParaNaoFinalizar(dados, pendentesSemIa);
        if (motivo) {
            const parcial = calcularNotaDoAluno(simularCertasDaIa(dados, certasDaIa));
            return await avisarMotivo(motivo + montarTextoNotaParcial(dados, parcial), tela);
        }

        if (!await aceitarCertasDaIa(certasDaIa, dados, tela)) return;
        await mostrarNotaLancada(calcularNotaDoAluno(dados), tela.situacao);
        mostrarProvaJaCorrigida(tela.bloco);
        await window.mostrarConfirmacaoProfessor?.(tela.aluno, tela.atividadeId);
        await window.atualizarPendenteCorrecao?.();
    } catch (erro) {
        await mostrarPopup('Não foi possível confirmar a correção: ' + erro.message,
            { tipo: 'erro', titulo: TITULO_POPUP_CONFIRMAR_CORRECAO });
    } finally {
        tela.botao.disabled = false;
    }
}

/**
 * Texto com a nota calculada até agora, para o aviso de correção incompleta.
 * @param {Object} dados - Dados lidos do banco.
 * @param {Object} parcial - Nota calculada com o que já está confirmado (e as certas da IA).
 * @returns {string} Texto (vazio se o aluno não entregou ou não respondeu nada).
 */
function montarTextoNotaParcial(dados, parcial) {
    if (!dados.entregue || !parcial.respondidas) return '';

    return '\n\nNota calculada até agora (só com o que já está confirmado): ' +
        formatarNotaFinalizar(parcial.nota) + '.';
}

/**
 * Mostra por que ainda não dá para confirmar a correção.
 * @param {string} motivo - Texto do bloqueio.
 * @param {{situacao: HTMLElement}} tela - Elementos do bloco.
 */
async function avisarMotivo(motivo, tela) {
    tela.situacao.textContent = '⚠️ ' + motivo;
    await mostrarPopup(motivo, { tipo: 'aviso', titulo: TITULO_POPUP_CONFIRMAR_CORRECAO });
}

/**
 * Troca o conteúdo do bloco pela mensagem única "Prova Já Corrigida!".
 * @param {HTMLElement} bloco - Bloco embaixo da prova.
 */
function mostrarProvaJaCorrigida(bloco) {
    const mensagem = document.createElement('p');
    mensagem.className = CLASSE_JA_CORRIGIDA;
    mensagem.textContent = MSG_PROVA_JA_CORRIGIDA;
    bloco.replaceChildren(mensagem);
}

/**
 * Diz se a prova do aluno já foi corrigida: entregue, com alguma resposta e com a nota do
 * professor em todas as alternativas respondidas.
 * @param {{alunoId: string, tentativa: number}} aluno - Aluno escolhido.
 * @param {number} atividadeId - Id da atividade.
 * @returns {Promise<boolean>} true se já corrigida.
 * @throws {Error} Se o banco recusar.
 */
async function provaJaCorrigida(aluno, atividadeId) {
    const dados = await lerDadosParaFinalizar(aluno, atividadeId);
    const resultado = calcularNotaDoAluno(dados);
    return dados.entregue && resultado.respondidas > 0 && resultado.pendentes === 0;
}

/**
 * Põe no bloco o botão "Confirmar Correção" e o texto de explicação.
 * @param {HTMLElement} bloco - Bloco embaixo da prova.
 * @param {{aluno: Object, atividadeId: number}} contexto - Aluno e atividade.
 */
function montarBotaoConfirmarCorrecao(bloco, contexto) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_FINALIZAR + '__botao';
    botao.textContent = TEXTO_BOTAO_CONFIRMAR_CORRECAO;
    const situacao = document.createElement('p');
    situacao.className = CLASSE_FINALIZAR + '__situacao';
    situacao.textContent = 'Lança a nota de ' + (contexto.aluno.nome || 'aluno') + ' com base ' +
        'nas alternativas que você confirmou (certa, meia certa, errada); as que você não ' +
        'corrigiu e a IA marcou como certas entram com a nota da IA.';
    botao.addEventListener('click', () =>
        finalizarAtividadeDoAluno({ ...contexto, bloco, botao, situacao }));
    bloco.replaceChildren(botao, situacao);
}

/**
 * Mostra embaixo da prova o botão "Confirmar Correção" do aluno escolhido, ou só a mensagem
 * "Prova Já Corrigida!" se a prova já foi corrigida (ou limpa).
 * @param {{alunoId: string, tentativa: number, nome: string}|null} aluno - Aluno; null limpa.
 * @param {number} atividadeId - Id da atividade.
 */
async function mostrarFinalizarAtividade(aluno, atividadeId) {
    limparFinalizarAtividade();
    const destino = document.querySelector(SELETOR_DESTINO_FINALIZAR);
    if (!aluno || !atividadeId || !destino) return;

    const bloco = document.createElement('section');
    bloco.className = 'aula-card ' + CLASSE_FINALIZAR;
    destino.insertBefore(bloco, destino.querySelector(SELETOR_ENTREGA_FINALIZAR));
    mostrarCorrecaoTurmaFinalizar(bloco, aluno, atividadeId);
    let corrigida = false;
    try {
        corrigida = await provaJaCorrigida(aluno, atividadeId);
    } catch (erro) {
        console.warn('Prova já corrigida:', erro.message);
    }
    if (!bloco.isConnected) return;
    if (corrigida) mostrarProvaJaCorrigida(bloco);
    else montarBotaoConfirmarCorrecao(bloco, { aluno, atividadeId });
}

(function incluirEstiloFinalizar() {
    if (!BASE_SCRIPTS_FINALIZAR) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_SCRIPTS_FINALIZAR + '../css/finalizar-atividade-professor.css';
    document.head.appendChild(link);
})();

window.mostrarFinalizarAtividade = mostrarFinalizarAtividade;
