// Verificação da Ficha Aluno: registra a emissão no banco (RPC registrar_ficha_aluno, com o JWT
// do professor logado) e desenha no rodapé do PDF o código, o QR Code e o endereço de conferência.
// O QR é desenhado em vetor (quadradinhos) a partir da biblioteca qrcode-generator, carregada por
// CDN como o jsPDF; se a CDN falhar, o PDF sai só com o código em texto.
// Usa globais de card-notas-ficha-aluno.js (carregarScriptFichaNotas, textoFichaNotas,
// avisarFichaNotas) e de card-notas-ficha-aluno-layout.js (definirFonteLayoutFicha) só em tempo
// de chamada. Carregado sob demanda por card-notas-ficha-aluno.js.

const RPC_REGISTRAR_FICHA_VERIFICACAO = 'registrar_ficha_aluno';
const ORIGEM_OFICIAL_FICHA_VERIFICACAO = 'https://aulasenai.vercel.app';
const CAMINHO_VERIFICAR_FICHA_VERIFICACAO = '/verificar-ficha.html';
const URL_QRCODE_FICHA_VERIFICACAO =
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const NIVEL_CORRECAO_QR_FICHA_VERIFICACAO = 'M';
const TIPO_QR_AUTOMATICO_FICHA_VERIFICACAO = 0;
const MSG_SEM_CLIENTE_FICHA_VERIFICACAO = 'Cliente do banco indisponível.';
const MSG_SEM_CODIGO_FICHA_VERIFICACAO = 'O banco não devolveu o código da ficha.';
const MSG_AVISO_TELA_FICHA_VERIFICACAO = 'Ficha gerada sem código de verificação: não foi possível'
    + ' registrar no sistema. Ela não poderá ser verificada.';
const TEXTO_NAO_VERIFICAVEL_FICHA_VERIFICACAO =
    'Ficha não verificável: não foi possível registrar no sistema';
const ROTULO_CODIGO_FICHA_VERIFICACAO = 'Código de verificação: ';
const ROTULO_CONFIRA_FICHA_VERIFICACAO = 'Confira em ';

const X_QR_FICHA_VERIFICACAO = 22;
const Y_QR_FICHA_VERIFICACAO = 196.5;
const LADO_QR_FICHA_VERIFICACAO = 12;
const X_TEXTO_FICHA_VERIFICACAO = 37;
const Y_CODIGO_FICHA_VERIFICACAO = 200.5;
const Y_CONFIRA_FICHA_VERIFICACAO = 204.5;
const COR_QR_FICHA_VERIFICACAO = [15, 23, 42];

/**
 * Endereço oficial da página de verificação.
 * @returns {string} URL sem o código.
 */
function enderecoVerificacaoFichaNotas() {
    return ORIGEM_OFICIAL_FICHA_VERIFICACAO + CAMINHO_VERIFICAR_FICHA_VERIFICACAO;
}

/**
 * Registra a emissão da ficha no banco, com o JWT do professor logado.
 * @param {Object} dados - Dados da ficha (aluno_id, turma_codigo, materia_id, linhas, medias).
 * @returns {Promise<string>} Código de verificação (XXXX-XXXX-XXXX-XXXX).
 * @throws {Error} Se não houver cliente, o banco recusar ou não devolver o código.
 */
async function registrarFichaVerificavelNotas(dados) {
    const cliente = typeof obterClienteSupabase === 'function' ? obterClienteSupabase() : null;
    if (!cliente) throw new Error(MSG_SEM_CLIENTE_FICHA_VERIFICACAO);

    const { data, error } = await cliente.rpc(RPC_REGISTRAR_FICHA_VERIFICACAO,
        { p_dados: dados });
    if (error) throw new Error(error.message);
    if (!data?.codigo) throw new Error(MSG_SEM_CODIGO_FICHA_VERIFICACAO);

    return data.codigo;
}

/**
 * Gera a matriz de módulos do QR Code do endereço de verificação.
 * @param {string} codigo - Código da ficha.
 * @returns {Promise<boolean[][]|null>} Matriz (true = escuro), ou null se a biblioteca falhar.
 */
async function gerarModulosQrFichaNotas(codigo) {
    try {
        if (typeof window.qrcode !== 'function') {
            await carregarScriptFichaNotas(URL_QRCODE_FICHA_VERIFICACAO);
        }
        const qr = window.qrcode(TIPO_QR_AUTOMATICO_FICHA_VERIFICACAO,
            NIVEL_CORRECAO_QR_FICHA_VERIFICACAO);
        qr.addData(enderecoVerificacaoFichaNotas() + '?codigo=' + encodeURIComponent(codigo));
        qr.make();
        const total = qr.getModuleCount();
        return Array.from({ length: total }, (_, linha) =>
            Array.from({ length: total }, (_, coluna) => qr.isDark(linha, coluna)));
    } catch (erro) {
        console.warn('QR Code indisponível na Ficha Aluno:', erro.message);
        return null;
    }
}

/**
 * Monta o que o rodapé imprime: código + QR, ou o aviso de ficha não verificável.
 * @param {Object} dados - Dados da ficha enviados ao banco.
 * @returns {Promise<{codigo: string, modulos: boolean[][]|null}|{aviso: true}>} Verificação.
 */
async function prepararVerificacaoFichaNotas(dados) {
    try {
        const codigo = await registrarFichaVerificavelNotas(dados);
        return { codigo, modulos: await gerarModulosQrFichaNotas(codigo) };
    } catch (erro) {
        console.warn('Ficha Aluno sem registro:', erro.message);
        await avisarFichaNotas(MSG_AVISO_TELA_FICHA_VERIFICACAO);
        return { aviso: true };
    }
}

/**
 * Desenha o QR Code em vetor no canto inferior esquerdo da página atual.
 * @param {Object} doc - Documento jsPDF.
 * @param {boolean[][]} modulos - Matriz do QR (true = escuro).
 */
function desenharQrFichaNotas(doc, modulos) {
    const lado = LADO_QR_FICHA_VERIFICACAO / modulos.length;
    doc.setFillColor(...COR_QR_FICHA_VERIFICACAO);
    modulos.forEach((linha, i) => linha.forEach((escuro, j) => {
        if (!escuro) return;

        doc.rect(X_QR_FICHA_VERIFICACAO + j * lado, Y_QR_FICHA_VERIFICACAO + i * lado,
            lado, lado, 'F');
    }));
}

/**
 * Desenha, na página atual, o código, o QR e o endereço de conferência (ou o aviso).
 * @param {Object} doc - Documento jsPDF.
 * @param {{codigo?: string, modulos?: boolean[][]|null, aviso?: boolean}} verificacao -
 *   Resultado de prepararVerificacaoFichaNotas.
 */
function desenharVerificacaoRodapeFichaNotas(doc, verificacao) {
    if (!verificacao) return;

    const fonte = { estilo: 'normal', tamanho: 7.5, cor: COR_ROTULO_LAYOUT_FICHA };
    definirFonteLayoutFicha(doc, fonte);
    if (verificacao.aviso) {
        doc.text(textoFichaNotas(TEXTO_NAO_VERIFICAVEL_FICHA_VERIFICACAO),
            X_QR_FICHA_VERIFICACAO, Y_CODIGO_FICHA_VERIFICACAO);
        return;
    }
    const xTexto = verificacao.modulos ? X_TEXTO_FICHA_VERIFICACAO : X_QR_FICHA_VERIFICACAO;
    if (verificacao.modulos) desenharQrFichaNotas(doc, verificacao.modulos);
    doc.text(ROTULO_CODIGO_FICHA_VERIFICACAO + verificacao.codigo, xTexto,
        Y_CODIGO_FICHA_VERIFICACAO);
    doc.text(ROTULO_CONFIRA_FICHA_VERIFICACAO + enderecoVerificacaoFichaNotas(), xTexto,
        Y_CONFIRA_FICHA_VERIFICACAO);
}

window.prepararVerificacaoFichaNotas = prepararVerificacaoFichaNotas;
window.desenharVerificacaoRodapeFichaNotas = desenharVerificacaoRodapeFichaNotas;
