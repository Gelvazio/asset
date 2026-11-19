// Atividade Dinâmica no PC: dados da Aula 03 de Fundamentos de UI/UX (Teoria das cores).
// Só dados: a tela de confirmação de consulta com cores e contrastes ruins, a ficha e o
// checklist. Nada de gabarito (os "problemas" não ficam marcados aqui). Usado por
// iniciarDinamica3d. Origem do conteúdo: MATERIAIS/TECNICO-INFORMATICA-INTERNET/
// FUNDAMENTOS-DE-UI-UX/CONTEUDO/AULA-03-*.md. Coordenadas: tela 360 x 640, origem no centro,
// y para cima.
// Regra: docs/regras/atividade-dinamica.md

const COR_CINZA_CLARO_03 = '#e2e8f0';
const COR_CINZA_MEDIO_03 = '#a0aec0';
const COR_LARANJA_CLARO_03 = '#fbd38d';
const COR_AZUL_CLARO_03 = '#bee3f8';
const COR_AMARELO_03 = '#faf089';
const COR_LARANJA_03 = '#dd6b20';
const COR_VERDE_03 = '#38a169';
const COR_VERMELHO_03 = '#e53e3e';

/**
 * Cria um elemento da tela original com os campos que a cena exige.
 * @param {number} id - Identificador do elemento.
 * @param {string} forma - retangulo, circulo ou triangulo.
 * @param {Object} caixa - { x, y, largura, altura }.
 * @param {Object} estilo - { cor, preenchido, raio, rotulo }.
 * @returns {Object} Elemento no formato do estado.
 */
function elementoAula03(id, forma, caixa, estilo) {
    return { id, forma, ...caixa, ...estilo };
}

/**
 * Monta a parte de cima da tela: barra de título, ícones, cartão da consulta e campos.
 * @returns {Object[]} Elementos do topo, do fundo para a frente.
 */
function montarTopoAula03() {
    return [
        elementoAula03(1, 'retangulo', { x: 0, y: 290, largura: 360, altura: 60 },
            { cor: COR_LARANJA_CLARO_03, preenchido: true, raio: 0, rotulo: 'Confirmar consulta' }),
        elementoAula03(2, 'circulo', { x: -150, y: 290, largura: 36, altura: 36 },
            { cor: COR_CINZA_MEDIO_03, preenchido: true, raio: 0, rotulo: '' }),
        elementoAula03(3, 'circulo', { x: 150, y: 290, largura: 28, altura: 28 },
            { cor: COR_VERMELHO_03, preenchido: true, raio: 0, rotulo: '2' }),
        elementoAula03(4, 'retangulo', { x: 0, y: 200, largura: 320, altura: 90 },
            { cor: COR_AZUL_CLARO_03, preenchido: true, raio: 6,
                rotulo: 'Dra. Ana · Cardiologia · 14h30' }),
        elementoAula03(5, 'retangulo', { x: 0, y: 110, largura: 300, altura: 40 },
            { cor: COR_CINZA_CLARO_03, preenchido: false, raio: 4,
                rotulo: 'Telefone para lembrete' }),
        elementoAula03(6, 'retangulo', { x: 0, y: 55, largura: 300, altura: 40 },
            { cor: COR_CINZA_CLARO_03, preenchido: false, raio: 4, rotulo: 'Observações' })
    ];
}

/**
 * Monta a parte de baixo: aviso, botões de confirmar e cancelar, link e rodapé.
 * @returns {Object[]} Elementos da base, do fundo para a frente.
 */
function montarBaseAula03() {
    return [
        elementoAula03(7, 'retangulo', { x: 10, y: -15, largura: 300, altura: 60 },
            { cor: COR_AMARELO_03, preenchido: true, raio: 0, rotulo: 'Chegue 15 min antes' }),
        elementoAula03(8, 'triangulo', { x: -150, y: -15, largura: 18, altura: 16 },
            { cor: COR_LARANJA_03, preenchido: true, raio: 0, rotulo: '' }),
        elementoAula03(9, 'retangulo', { x: -85, y: -110, largura: 140, altura: 56 },
            { cor: COR_VERDE_03, preenchido: true, raio: 6, rotulo: 'Confirmar' }),
        elementoAula03(10, 'retangulo', { x: 85, y: -110, largura: 140, altura: 56 },
            { cor: COR_VERMELHO_03, preenchido: true, raio: 6, rotulo: 'Cancelar' }),
        elementoAula03(11, 'retangulo', { x: 0, y: -195, largura: 300, altura: 36 },
            { cor: COR_LARANJA_03, preenchido: true, raio: 6, rotulo: 'Remarcar horário' }),
        elementoAula03(12, 'retangulo', { x: 0, y: -300, largura: 360, altura: 40 },
            { cor: COR_CINZA_CLARO_03, preenchido: true, raio: 0, rotulo: 'Ajuda · Contato' })
    ];
}

registrarDinamica3d('03', {
    tela: [...montarTopoAula03(), ...montarBaseAula03()],
    instrucoes: {
        raiox: 'Você, como aluno consultor, recebeu o aplicativo de confirmação de consultas: '
            + 'sob o sol forte, os pacientes não conseguem ler nem distinguir os botões. Escolha '
            + 'a forma e arraste sobre a tela para marcar cada elemento e observe como as cores '
            + 'se comportam.',
        redesenho: 'Agora monte a paleta de 5 cores da tela (ação principal, apoio, alerta, fundo '
            + 'e texto): toque em um elemento, escolha uma cor, troque entre sólido e contorno '
            + 'e ajuste tamanho e posição. O texto muda de cor sozinho conforme o fundo; busque '
            + 'contraste mínimo de 4,5 para 1 e não use só a cor para passar uma mensagem.',
        ficha: 'Preencha a ficha com a harmonia escolhida, as 5 cores e a função de cada uma, '
            + 'confira o checklist e entregue. Depois de entregue, a atividade não pode mais ser '
            + 'alterada.'
    },
    ficha: [
        { id: 'formato', rotulo: 'Formato escolhido e integrantes',
            dica: 'Individual, em dupla, em grupo ou turma toda. Quem fez com você?' },
        { id: 'harmonia', rotulo: 'Harmonia escolhida e o motivo',
            dica: 'Complementar, análoga ou monocromática: por que combina com esta tela?' },
        { id: 'paleta', rotulo: 'As 5 cores da paleta e a função de cada uma',
            dica: 'Ação principal, apoio, alerta, fundo e texto: qual cor para cada função?' },
        { id: 'contraste', rotulo: 'Resultado da verificação de contraste entre texto e fundo',
            dica: 'Qual par você conferiu e a taxa deu 4,5 para 1 ou mais?' },
        { id: 'mudancas', rotulo: 'Mudanças feitas no redesenho e o motivo de cada uma',
            dica: 'Ex.: troquei o vermelho por azul escuro porque o contraste era baixo.' }
    ],
    checklist: [
        'Contraste: o texto de cada botão tem taxa mínima de 4,5 para 1 com o fundo?',
        'Cor não basta: confirmar e cancelar se distinguem também por texto, forma ou posição?',
        'Paleta funcional: há uma cor para ação principal, apoio, alerta, fundo e texto?'
    ]
});
