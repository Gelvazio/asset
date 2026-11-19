// Mapa nome da pasta da matéria → materia.id do banco (#434.2): a página ATIVIDADES não tem
// o id da matéria, então o "📚 Gerenciar Aulas" descobre o id pelo nome da pasta da URL. A
// busca por nome não funciona porque a pasta difere da materia.descricao (acentos, espaços e
// abreviações — ex.: INTRODUCAO_COMUNICACAO_ORAL_ESCRITA ≠ "Introdução à Comunicação Oral e
// Escrita para o Mundo do Trabalho"). Matéria nova precisa de uma linha
// no mapa.
// Depende de: nada (só constantes e funções globais deste arquivo).

/**
 * Nome da pasta → id da matéria no banco. A comparação é por texto normalizado
 * (normalizarPastaMateria), então a chave vale para pasta escrita com `_`, `-` ou espaço.
 * Ids 23 e 24: a pasta ainda não existe no repositório; a chave segue o padrão de nome do
 * curso e já casa quando a página for criada com esse nome.
 */
const ID_MATERIA_POR_PASTA = {
    // Operador de Produção Industrial (curso 2)
    'INTRODUCAO-A-TECNOLOGIA-DE-INFORMACAO-E-COMUNICACAO': 23,
    'FUNDAMENTOS-DOS-PROCESSOS-DE-PRODUCAO': 24,
    'FUNDAMENTOS-DE-AUTOMACAO-INSTRUMENTACAO': 28,
    // Técnico em Informática para Internet (curso 4)
    'ARQUITETURA-DE-HARDWARE-E-SOFTWARE': 30,
    'BANCO-DE-DADOS': 31,
    'CODIFICACAO-PARA-BACK-END': 32,
    'CODIFICACAO-PARA-FRONT-END': 33,
    'DESENVOLVIMENTO-DE-APIS': 34,
    'FUNDAMENTOS-DE-UI-UX': 35,
    'INTERACAO-COM-APIS': 36,
    'INTRODUCAO-INDUSTRIA-40': 37,
    'INTRODUCAO-A-QUALIDADE-E-PRODUTIVIDADE': 38,
    'INTRODUCAO-A-TECNOLOGIA-DA-INFORMACAO-E-COMUNICACAO': 39,
    'INTRODUCAO-AO-DESENVOLVIMENTO-DE-PROJETOS': 40,
    'LOGICA-DE-PROGRAMACAO': 41,
    'PROJETO-DE-BACK-END': 42,
    'PROJETO-DE-FRONT-END': 43,
    'SAUDE-E-SEGURANCA-NO-TRABALHO': 44,
    'SUSTENTABILIDADE-NOS-PROCESSOS-INDUSTRIAIS': 45,
    'Testes de Sistemas-EXISTENTES': 46,
    'TESTES-DE-BACK-END': 47,
    'TESTES-DE-FRONTEND': 48,
    'VERSIONAMENTO-E-COLABORACAO': 49,
    // Assistente de Operações Logísticas (curso 5)
    'INTRODUCAO-TIC': 25,
    // Rio do Sul Mais Tech (curso 6)
    'FUNDAMENTOS_DA_TECNOLOGIA_E_PROGRAMACAO': 26,
    'REFORCO_LINGUAGENS': 29,
    'INTRODUCAO_COMUNICACAO_ORAL_ESCRITA': 50,
    'NOCOES_ELETRICIDADE_CIRCUITOS_BASICOS': 51,
    // Assistente em Processos de Gestão e Controle de Materiais (curso 7)
    'ANALISE_DADOS_APLICADA_GESTAO': 27,
};

// Marcas de acento depois de NFD e os separadores do nome da pasta (_ e -).
const REGEX_ACENTOS_PASTA_MATERIA = /[̀-ͯ]/g;
const REGEX_SEPARADORES_PASTA_MATERIA = /[_-]/g;

/**
 * Põe o nome da pasta na mesma forma para comparar: sem acento, sem _ ou -, com espaços
 * simples e em maiúsculas.
 * @param {string} texto - Nome da pasta da URL ou chave do mapa.
 * @returns {string} Nome normalizado.
 */
function normalizarPastaMateria(texto) {
    return texto.normalize('NFD').replace(REGEX_ACENTOS_PASTA_MATERIA, '')
        .replace(REGEX_SEPARADORES_PASTA_MATERIA, ' ').replace(/\s+/g, ' ').trim()
        .toUpperCase();
}

/**
 * Id da matéria cuja pasta é a da URL (lerNomeMateriaDaPasta já troca - por espaço). Compara
 * os nomes normalizados, para casar pasta com _ , - ou espaço.
 * @param {string} nomePasta - Nome da pasta da matéria (como vem da URL).
 * @returns {number|null} materia.id, ou null se a pasta não estiver no mapa.
 */
function idMateriaPelaPasta(nomePasta) {
    const alvo = normalizarPastaMateria(nomePasta);
    const entrada = Object.entries(ID_MATERIA_POR_PASTA)
        .find(([pasta]) => normalizarPastaMateria(pasta) === alvo);
    return entrada ? entrada[1] : null;
}
