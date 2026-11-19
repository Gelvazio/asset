# Reaproveitamento de CSS e JS no aulasenai
tipo_regra: local
projeto: asset
codigo: REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL
tipo: mae
prioridade: 🟡
status: 👀 Aguardando o usuário
em_uso_por: — (não reservável)
descricao: Reduzir a repetição de classes CSS e funções JS dentro de css/aulasenai/ e js/aulasenai/, movendo o que se repete para arquivos comuns, sem mudar o visual nem o comportamento. Mudança em massa = tarefa grande: só executa depois do "sim" do usuário ao plano.

## Etapa — REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL: reaproveitamento de CSS e JS
**Pedido:** "maximo de reaproveitamento de classes css e de classes javascript" (pedido do usuário, 2026-11-19)
**Objetivo:** cada bloco CSS ou função JS repetida existe em um único lugar do projeto asset, sem alterar o resultado visual nem o comportamento das páginas.
**Achados do inventário:**
- css/aulasenai/: 148 arquivos, 1555 classes distintas. Muitas se repetem (ex.: `.aula` 344 vezes, `.alternativas` 250, `.questao` 240, `.btn-export` 186).
- Blocos CSS com regra completa idêntica em 3 ou mais arquivos: 5.
- js/aulasenai/: 234 arquivos, 2804 funções distintas, quase sem nome repetido. Repetidas: `normalizarTexto`, `montarLinhaRelatorio`, `montarLinhaAluno`, `lerTurmaEscolhidaProgresso`, `formatarDataHora`, `criarElemento`, `carregarScript`.
- Colisão: `unidade.js` existe em js/aulasenai/ e em js/aulasenai/raiz/, com conteúdo diferente (os dois são mantidos).

### Escopo
- **Entra:** arquivos de css/aulasenai/ e js/aulasenai/ (inclusive raiz/); criar css/aulasenai/comum.css e js/aulasenai/comum/.
- **Não entra:** supabase.js e criar-usuarios-api.js (ficam fora, decisão do usuário); css/rules-ai/ (já tem 1 CSS e 0 JS); mudanças nas páginas dos projetos aulasenai e rules-ai (elas ficam em outro repositório).

### Riscos
- Mudar a ordem de cascata do CSS quebra o visual. Plano B: mover só blocos idênticos e conferir, em cada arquivo afetado, que a ordem relativa não mudou.
- Remover função JS que outra página ainda chama quebra a página. Plano B: manter a função original como alias que chama a comum, até confirmar que nenhuma referência sobra.
- Não há como abrir as páginas aqui (regra do projeto: sem navegador). Verificação só por leitura, `node --check` e busca de referências.

### Subtarefas
- **Nível e modelo:** não definidos. Quem classifica é o Jev (C52). Não reservar até ele classificar.

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.1 — Listar os 5 blocos CSS idênticos e as classes mais repetidas
**Próximo passo:** gerar a lista com o arquivo, a linha e o texto de cada bloco repetido em 3 ou mais arquivos.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** relatório em tasks/local/ com os blocos repetidos e as 30 classes mais usadas.
- **Critérios de Aceitação:** lista completa, sem bloco de fora; cada item com os arquivos onde aparece.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.2 — Criar css/aulasenai/comum.css com os blocos idênticos
**Próximo passo:** copiar os blocos da subtarefa 1 para comum.css, na ordem de carregamento correta.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** arquivo único com as regras idênticas; nenhum outro arquivo muda ainda.
- **Critérios de Aceitação:** comum.css contém só regras que já existiam idênticas; chaves balanceadas.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.3 — Remover dos arquivos as cópias dos blocos comuns
**Próximo passo:** apagar os blocos copiados de cada arquivo e conferir a ordem de cascata das classes afetadas.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** só blocos já cobertos por comum.css.
- **Critérios de Aceitação:** nenhuma classe perde regra; ordem relativa preservada.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.4 — Mapear classes repetidas com valores diferentes
**Próximo passo:** para `.aula`, `.alternativas`, `.questao` e as demais do topo, listar as variações e propor o que unificar.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** relatório de decisão; a unificação só entra com aprovação do usuário.
- **Critérios de Aceitação:** cada classe com as variações e a proposta; nada alterado.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.5 — Criar js/aulasenai/comum/ com as funções repetidas
**Próximo passo:** mover normalizarTexto, montarLinhaRelatorio, montarLinhaAluno, lerTurmaEscolhidaProgresso, formatarDataHora, criarElemento e carregarScript para arquivos comuns.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** cada função com uma única definição; os arquivos antigos passam a importar dela.
- **Critérios de Aceitação:** nenhuma função com duas definições; `node --check` passa em todos os arquivos tocados.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.6 — Resolver a colisão de unidade.js
**Próximo passo:** comparar js/aulasenai/unidade.js com js/aulasenai/raiz/unidade.js e decidir se são o mesmo conceito; se forem, unificar; se não, renomear um deles.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** eliminar o nome repetido sem perder comportamento.
- **Critérios de Aceitação:** nome único por arquivo; referências atualizadas.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.7 — Conferir referências e sintaxe
**Próximo passo:** buscar em todo o asset qualquer referência a arquivo ou função removida e rodar `node --check` nos JS.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** conferência por leitura e comandos; sem navegador.
- **Critérios de Aceitação:** zero referência quebrada; zero erro de sintaxe.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente

### REUSO-CSS-JS-AULASENAI-TAREFA-LOCAL.8 — Atualizar o README do asset com o mapa de pastas
**Próximo passo:** descrever css/ e js/ por projeto e as pastas comuns.
- **Nível:** a classificar pelo Jev · **Modelo:** a classificar pelo Jev · **Effort:** a classificar pelo Jev
- **Descrição:** README curto, no formato atual do repositório.
- **Critérios de Aceitação:** o README bate com a estrutura real.
- **Entrega:** — · **Verificação:** —
- **Status:** ⬜ Pendente
