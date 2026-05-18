# Sistema de Inclusão de Saldos de Insumos — Documentação de Continuidade

## 1. Objetivos do sistema

O sistema tem como objetivo substituir o controle manual em planilha por uma aplicação simples, acessível via navegador, para controlar solicitações de inclusão de saldo de insumos no Informakon.

Atualmente, quando a equipe da obra precisa solicitar uma compra de um insumo que não possui saldo suficiente no orçamento, é necessário solicitar ao controle de custos a inclusão ou ajuste desse saldo no Informakon. O sistema deve organizar esse fluxo de forma rastreável, padronizada e menos sujeita a erros.

### Objetivos principais

- Permitir que a obra registre solicitações de inclusão de saldo de insumos.
- Permitir que uma única solicitação contenha vários insumos.
- Utilizar CSVs exportados do Informakon como base de consulta.
- Importar um CSV de orçamento por obra.
- Importar um CSV do banco geral de insumos do Informakon.
- Buscar insumos automaticamente durante a solicitação.
- Diferenciar insumos já previstos no orçamento, insumos existentes no banco geral e insumos novos.
- Permitir que o analista de custos aprove ou recuse itens em bloco.
- Atualizar a base local de saldos após a aprovação.
- Manter histórico das importações e alterações.
- Evitar que o solicitante altere solicitações que já entraram em análise.
- Facilitar o trabalho do analista agrupando itens por composição/EAP.
- Permitir que insumos não previstos no orçamento sejam alocados em uma composição existente ou nova durante a análise.

---

## 2. Decisões já tomadas

### 2.1 Arquitetura

Foi decidido utilizar a seguinte arquitetura para o MVP:

```text
Frontend: GitHub Pages
Backend/API: Google Apps Script
Banco de dados: Google Sheets
Integração com Informakon: importação de arquivos CSV
```

O frontend fica hospedado em um repositório GitHub Pages, com arquivos estáticos:

```text
index.html
assets/style.css
assets/app.js
.nojekyll
```

O Apps Script funciona como API, usando:

```javascript
doGet(e)
doPost(e)
```

A comunicação entre GitHub Pages e Apps Script foi feita por `form + iframe + postMessage`, para reduzir problemas de CORS comuns quando se tenta usar `fetch()` diretamente com Apps Script.

---

### 2.2 Estrutura da planilha banco

A planilha do Google Sheets funciona como banco do sistema.

Abas principais:

```text
OBRAS
USUARIOS
ORCAMENTO_OBRA
BANCO_GERAL_INSUMOS
SOLICITACOES
SOLICITACAO_ITENS
HISTORICO_ATUALIZACOES_SALDO
IMPORTACOES_CSV
LISTAS
```

---

### 2.3 Solicitação em blocos

Foi decidido que a solicitação não deve ser feita item por item de forma isolada.

A regra adotada foi:

```text
1 ID de solicitação pode conter vários insumos.
```

A solicitação possui um cabeçalho com dados gerais:

```text
ID_SOLICITACAO
DATA_SOLICITACAO
ID_OBRA
SOLICITANTE_NOME
SOLICITANTE_EMAIL
PRIORIDADE
GESTAO_CIENTE
JUSTIFICATIVA_GERAL
STATUS_GERAL
```

E os insumos ficam na aba:

```text
SOLICITACAO_ITENS
```

---

### 2.4 CSV de orçamento por obra

Foi decidido que cada obra terá seu próprio CSV de orçamento exportado do Informakon.

Na importação, o usuário deve indicar a obra correspondente ao CSV.

O sistema aceita o CSV nativo do Informakon, com estrutura semelhante a:

```text
Item_ID
CL
Item
Insumo
Discriminação
Unidade
Qtde Orc UC
Qtde Orc
Qtde SO
Ajuste (+/-)
Saldo a SO
```

O importador separa automaticamente:

```text
Insumo = 0     → linha de item orçamentário / composição
Insumo <> 0    → linha de insumo vinculado ao item
```

A linha de item orçamentário é usada para recuperar:

```text
EAP
ITEM_ORCAMENTARIO
```

E as linhas de insumos alimentam a aba:

```text
ORCAMENTO_OBRA
```

---

### 2.5 Banco geral de insumos

Foi decidido importar também o banco geral de insumos do Informakon.

O CSV analisado possui colunas como:

```text
Obsoleto
Insumo Sub
Código Ref.
Sb
Especificação Insumo Sub
Unidade
Caracterização
Grupo
Classe
C
CP
D
S
Alterado por
Alterado em
Criado por
Criado em
Origem
Executivo
Licitatório
```

O mapeamento adotado foi:

| CSV Informakon | Sistema |
|---|---|
| Insumo Sub | CODIGO_INSUMO |
| Especificação Insumo Sub | DESCRICAO_INSUMO |
| Unidade | UNIDADE |
| Classe | CLASSE |
| Grupo | GRUPO |
| Caracterização | CARACTERIZACAO |
| Classe + Grupo + Caracterização | CLASSIFICACAO |
| Obsoleto | OBSOLETO / STATUS |
| Código Ref. | CODIGO_REF |

---

### 2.6 Busca de insumos

Foi decidido que a busca deve funcionar em duas camadas:

```text
1. Primeiro busca no orçamento da obra selecionada.
2. Depois busca no banco geral de insumos.
```

A origem do item é exibida de forma abreviada:

```text
OO = Orçamento da Obra
BD = Banco de Dados / Banco Geral Informakon
IN = Insumo Novo
```

---

### 2.7 Código dos insumos

Foi decidido padronizar o código do insumo do orçamento para o mesmo padrão do banco geral do Informakon.

Formato adotado:

```text
6 dígitos + hífen + 3 dígitos
```

Exemplos:

```text
2474       → 002474-000
71998      → 071998-000
071998-000 → 071998-000
```

Essa padronização é importante para que o orçamento e o banco geral conversem corretamente.

---

### 2.8 Tratamento de EAP como texto

Foi identificado que o Google Sheets poderia interpretar EAPs como `1.2.3` como datas, gerando saídas estranhas no frontend, por exemplo:

```text
2003-02-01T08:00:00.000Z
```

Decisão tomada:

```text
EAP deve ser tratado sempre como texto.
```

O backend passou a utilizar leitura com `getDisplayValues()` em pontos relevantes e tratamento textual do EAP.

---

### 2.9 Reimportação do orçamento

Foi decidido que a reimportação do orçamento de uma obra não deve apagar imediatamente os registros antigos.

A regra adotada:

```text
Ao reimportar o orçamento de uma obra:
1. Registros antigos da obra são marcados como ATIVO = Não.
2. Nova versão é importada como ATIVO = Sim.
3. A busca considera apenas ATIVO = Sim.
```

Isso evita duplicidade funcional na busca e preserva histórico.

---

### 2.10 Limpeza da base

Foi criado um patch com funções de limpeza, permitindo resetar dados sem apagar cabeçalhos ou estrutura.

Funções criadas:

```javascript
limparSomenteOrcamentoISI()
limparSomenteBancoGeralISI()
limparSolicitacoesHistoricoISI()
resetarBaseOperacionalISI()
removerVersoesInativasOrcamentoISI()
```

A função mais útil para reset de testes é:

```javascript
resetarBaseOperacionalISI()
```

Ela limpa:

```text
ORCAMENTO_OBRA
BANCO_GERAL_INSUMOS
SOLICITACOES
SOLICITACAO_ITENS
HISTORICO_ATUALIZACOES_SALDO
IMPORTACOES_CSV
```

E preserva:

```text
OBRAS
USUARIOS
LISTAS
```

---

### 2.11 Tela de análise

Foi decidido redesenhar a tela de análise para ficar mais operacional.

Decisões:

- Remover botão de **Compra solicitada** da tela de análise.
- Remover campo de **Nº da solicitação de compra**.
- A aprovação já significa que o saldo foi incluído no Informakon.
- Aprovações e recusas devem ser feitas em bloco.
- Cada item recebe uma flag de decisão:
  - Aprovar;
  - Recusar.
- O analista confirma todas as decisões ao final.
- A apresentação deve ser em tabela compacta, não em cards.
- Os itens devem ser agrupados por composição/EAP.

---

### 2.12 Alocação de insumos não previstos no orçamento

Foi identificado que insumos não previstos no orçamento precisam ser alocados em uma composição durante a análise.

Regra adotada:

```text
OO = já possui composição do orçamento.
BD = precisa ser alocado em composição antes da aprovação.
IN = precisa ser alocado em composição antes da aprovação.
```

Para itens `BD` ou `IN`, o analista deve escolher:

```text
1. Uma composição existente da obra; ou
2. Uma nova composição, informando EAP e nome da composição.
```

A aprovação só deve ser permitida após essa alocação.

---

## 3. Pendências atuais

### 3.1 Tela do solicitante após aprovação

A marcação de **Compra solicitada** foi removida da tela de análise, pois é uma ação do solicitante/obra, não do analista de custos.

Pendência:

```text
Criar uma tela específica para o solicitante acompanhar itens aprovados/incluídos no Informakon e marcar quais já foram solicitados no sistema de compras.
```

Essa tela deve permitir:

- Visualizar itens aprovados/incluídos.
- Marcar item como compra solicitada.
- Registrar data automaticamente.
- Evitar solicitação duplicada.
- Não exigir número da solicitação de compra, pois foi definido como irrelevante para este sistema.

---

### 3.2 Controle de permissões

Ainda falta implementar controle mais forte por perfil.

Perfis previstos:

```text
Solicitante
Analista
Gestor da Obra
Administrador
```

Pendência:

```text
Restringir visualização e ações conforme o perfil do usuário.
```

Exemplo:

| Perfil | Ações |
|---|---|
| Solicitante | Criar solicitação, consultar solicitações da obra, marcar compra solicitada |
| Analista | Analisar, aprovar, recusar, alocar composição |
| Gestor da Obra | Validar ciência/aprovação gerencial |
| Administrador | Importar bases, configurar usuários e obras |

---

### 3.3 Autenticação

Atualmente a API utiliza uma `API_KEY` simples.

Essa chave ajuda a evitar chamadas acidentais, mas não é uma segurança forte, pois o frontend no GitHub Pages é público.

Pendência futura:

```text
Avaliar login com Google, controle por e-mail autorizado ou backend intermediário.
```

---

### 3.4 Melhorar importação de arquivos grandes

Foi identificado timeout em algumas importações grandes, especialmente no banco geral com mais de 10 mil linhas.

A importação funcionou após limpeza da base, mas ainda é uma possível fragilidade.

Pendência:

```text
Implementar importação em lotes para CSVs grandes.
```

Sugestão:

```text
1. Ler CSV no frontend.
2. Dividir em blocos de 500 ou 1000 linhas.
3. Enviar lote por lote para o Apps Script.
4. Mostrar progresso.
```

---

### 3.5 Tela de análise com alocação

A versão com alocação foi gerada, mas ainda precisa ser validada em uso real.

Itens a validar:

- Se a lista de composições existentes carrega corretamente.
- Se o analista consegue criar nova composição.
- Se a alocação é gravada corretamente no item.
- Se a aprovação de BD/IN só ocorre após alocação.
- Se a nova composição precisa também ser gravada em alguma tabela própria de composições ou apenas no item/orçamento.

---

### 3.6 Histórico e auditoria

O sistema já possui aba de histórico, mas pode precisar de mais rastreabilidade.

Pendências possíveis:

- Registrar alteração de status da solicitação.
- Registrar usuário que importou CSV.
- Registrar usuário que aprovou/recusou em bloco.
- Registrar antes/depois da quantidade orçada.
- Registrar alocação de composição em itens BD/IN.

---

### 3.7 Dashboard

O dashboard atual ainda é básico.

Pendências:

- Solicitações por obra.
- Itens pendentes de análise.
- Itens aprovados/incluídos.
- Itens recusados.
- Itens BD/IN pendentes de alocação.
- Itens aprovados e ainda não marcados como compra solicitada.
- Quantidade de importações por obra.
- Data da última atualização de orçamento por obra.

---

### 3.8 Tratamento de status geral da solicitação

O status geral da solicitação é calculado a partir dos itens, mas ainda pode ser refinado.

Possíveis status gerais:

```text
Nova
Em análise
Aprovada parcialmente
Recusada
Incluída no Informakon
Aguardando compra
Compra solicitada
Concluída
```

Pendência:

```text
Definir formalmente a regra de transição do STATUS_GERAL.
```

---

## 4. Trechos de código relevantes

### 4.1 Web App: `doGet(e)`

Função obrigatória para o Apps Script funcionar como Web App/API.

```javascript
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    const result = routeRequest_(e.parameter);
    const callback = e.parameter.callback;

    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>ISI API</title>
      </head>
      <body>
        <h1>ISI API ativa</h1>
        <p>Esta URL é o backend do sistema de Inclusão de Saldos de Insumos.</p>
      </body>
    </html>
  `;

  return HtmlService
    .createHtmlOutput(html)
    .setTitle('ISI API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

---

### 4.2 Web App: `doPost(e)`

Usado pelo frontend hospedado no GitHub Pages.

```javascript
function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const requestId = params.requestId || '';
  const result = routeRequest_(params);
  return postMessageResponse_(requestId, result);
}
```

---

### 4.3 Roteamento de ações da API

```javascript
function executeAction_(action, payload) {
  switch (action) {
    case 'health':
      return { status: 'ok', timestamp: new Date().toISOString() };

    case 'setupDatabase':
      return setupDatabase();

    case 'getObras':
      return getObras();

    case 'getDashboardData':
      return getDashboardData();

    case 'importarBancoGeralInsumos':
      return importarBancoGeralInsumos(payload);

    case 'importarOrcamentoInformakon':
      return importarOrcamentoInformakon(payload);

    case 'buscarInsumos':
      return buscarInsumos(payload);

    case 'criarSolicitacao':
      return criarSolicitacao(payload);

    case 'listarSolicitacoesResumo':
      return listarSolicitacoesResumo(payload);

    case 'listarItensAnalise':
      return listarItensAnalise(payload);

    case 'listarComposicoesObra':
      return listarComposicoesObra(payload);

    case 'processarAnaliseBloco':
      return processarAnaliseBloco(payload);

    default:
      throw new Error('Ação inválida: ' + action);
  }
}
```

---

### 4.4 Estrutura da aba `ORCAMENTO_OBRA`

```javascript
ORCAMENTO: [
  'ID_ORCAMENTO',
  'ID_OBRA',
  'ID_ITEM_INFORMAKON',
  'EAP',
  'ITEM_ORCAMENTARIO',
  'CODIGO_INSUMO',
  'DESCRICAO_INSUMO',
  'UNIDADE',
  'CL_INFORMAKON',
  'CLASSIFICACAO',
  'QTD_ORCADA_ORIGINAL',
  'QTD_SOLICITADA',
  'AJUSTE_INFORMAKON',
  'SALDO_ORIGINAL',
  'QTD_INCLUIDA_SISTEMA',
  'SALDO_ATUAL_SISTEMA',
  'DATA_IMPORTACAO_CSV',
  'VERSAO_CSV',
  'NOME_ARQUIVO',
  'CHAVE_ORCAMENTO',
  'ORIGEM_REGISTRO',
  'ATIVO'
]
```

---

### 4.5 Estrutura da aba `BANCO_GERAL_INSUMOS`

```javascript
BANCO: [
  'CODIGO_INSUMO',
  'DESCRICAO_INSUMO',
  'UNIDADE',
  'CLASSIFICACAO',
  'CARACTERIZACAO',
  'GRUPO',
  'CLASSE',
  'OBSOLETO',
  'CODIGO_REF',
  'INSUMO_SUB',
  'SB',
  'FLAG_C',
  'FLAG_CP',
  'FLAG_D',
  'FLAG_S',
  'ORIGEM',
  'EXECUTIVO',
  'LICITATORIO',
  'DATA_CRIACAO_INFORMAKON',
  'DATA_ALTERACAO_INFORMAKON',
  'STATUS',
  'DATA_IMPORTACAO',
  'NOME_ARQUIVO'
]
```

---

### 4.6 Padronização do código do insumo

Regra adotada:

```text
6 dígitos + hífen + 3 dígitos
```

Exemplo conceitual:

```javascript
function formatInformakonCode_(value) {
  let code = String(value || '').trim();

  if (!code) return '';

  if (/^\d{6}-\d{3}$/.test(code)) {
    return code;
  }

  code = code.replace(/\D/g, '');

  if (!code) return '';

  if (code.length <= 6) {
    return code.padStart(6, '0') + '-000';
  }

  const prefix = code.slice(0, 6).padStart(6, '0');
  const suffix = code.slice(6, 9).padEnd(3, '0');

  return prefix + '-' + suffix;
}
```

---

### 4.7 Importação do orçamento Informakon

Resumo da lógica:

```javascript
function importarOrcamentoInformakon(payload) {
  const idObra = payload.idObra;
  const csvContent = payload.csvContent;
  const nomeArquivo = payload.nomeArquivo;

  const rows = parseCsvToObjects_(csvContent);

  const itemMap = {};

  rows.forEach(function(r) {
    const insumo = cleanCode_(getFirst_(r, ['insumo', 'codigo_insumo']));
    const itemId = cleanText_(getFirst_(r, ['item_id', 'itemid']));
    const discr = cleanText_(getFirst_(r, ['discriminacao', 'discriminação', 'descricao']));
    const eap = cleanEap_(getFirst_(r, ['item', 'eap']));

    if (isItemLine_(insumo)) {
      itemMap[itemId] = {
        eap: eap,
        itemOrcamentario: discr
      };
    }
  });

  deactivateCurrentBudgetRows_(idObra);

  rows.forEach(function(r) {
    const insumo = cleanCode_(getFirst_(r, ['insumo', 'codigo_insumo']));

    if (isItemLine_(insumo)) return;

    // Monta registro de insumo vinculado ao item orçamentário.
  });
}
```

---

### 4.8 Busca de insumos

Resumo da regra:

```javascript
function buscarInsumos(payload) {
  const idObra = payload.idObra;
  const termo = payload.termo;

  // 1. Busca no ORCAMENTO_OBRA da obra selecionada.
  // 2. Busca no BANCO_GERAL_INSUMOS.
  // 3. Retorna origem como:
  //    - Orçamento da Obra
  //    - Banco Geral Informakon
}
```

---

### 4.9 Listar composições da obra

Função criada para permitir alocação de insumos BD/IN.

```javascript
function listarComposicoesObra(payload) {
  setupIfNeeded_();

  const idObra = payload.idObra;

  if (!idObra) {
    throw new Error('ID_OBRA não informado para listar composições.');
  }

  const rows = readObjects_(ISI_SHEETS.ORCAMENTO);
  const map = {};

  rows.forEach(function(r) {
    if (String(r.ID_OBRA) !== String(idObra)) return;
    if (!isActive_(r.ATIVO)) return;

    const eap = cleanText_(r.EAP || '');
    const item = cleanText_(r.ITEM_ORCAMENTARIO || '');

    if (!eap && !item) return;

    const key = eap + '|' + item;

    if (!map[key]) {
      map[key] = {
        idObra: idObra,
        eap: eap,
        itemOrcamentario: item,
        label: (eap ? eap + ' - ' : '') + item
      };
    }
  });

  return Object.keys(map)
    .map(function(k) {
      return map[k];
    })
    .sort(function(a, b) {
      return String(a.eap || '').localeCompare(String(b.eap || ''), 'pt-BR', { numeric: true });
    });
}
```

---

### 4.10 Processamento da análise em bloco

Regra:

- Aprovar = saldo incluído no Informakon.
- Recusar = item recusado.
- BD/IN exigem alocação em composição.

```javascript
function processarAnaliseBloco(payload) {
  const decisoes = payload.decisoes || [];

  decisoes.forEach(function(decisao) {
    const idItem = decisao.idItem;
    const tipo = String(decisao.decisao || '').toLowerCase().trim();

    if (tipo === 'aprovar') {
      const qtdIncluida = toNumber_(decisao.qtdIncluida || 0);
      const eapAlocado = cleanText_(decisao.eapAlocado || '');
      const itemOrcamentarioAlocado = cleanText_(decisao.itemOrcamentarioAlocado || '');

      // Se origem não for OO, exige alocação.
      // Depois chama marcarIncluidoInformakon().
    }

    if (tipo === 'recusar') {
      // Chama recusarItem().
    }
  });
}
```

---

### 4.11 Comunicação frontend → Apps Script

Foi adotado o padrão:

```javascript
form + iframe + postMessage
```

Trecho conceitual:

```javascript
function apiCall(action, payload) {
  const requestId = 'req_' + Date.now();

  const iframe = document.createElement('iframe');
  iframe.name = 'isi_iframe_' + requestId;
  iframe.style.display = 'none';

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = state.apiUrl;
  form.target = iframe.name;

  // Envia action, apiKey e payload.
  // Recebe resposta via window.postMessage().
}
```

---

## 5. Dúvidas abertas

### 5.1 A nova composição deve ser cadastrada em uma tabela própria?

Atualmente, quando o analista informa uma nova composição para um item BD/IN, a alocação é gravada no item da solicitação.

Dúvida:

```text
Devemos criar uma aba/tabela COMPOSICOES_NOVAS ou COMPOSICOES_OBRA para registrar novas composições formalmente?
```

Vantagens de criar tabela própria:

- Evita digitar a mesma composição várias vezes.
- Permite histórico de composições criadas.
- Facilita reuso em solicitações futuras.
- Pode servir como orientação para ajuste no Informakon.

---

### 5.2 Como tratar insumos BD alocados em composição existente?

Quando um insumo vem do banco geral e é alocado em composição existente, ele passa a fazer parte da base local da obra após aprovação.

Dúvida:

```text
Esse novo vínculo deve ser gravado como novo registro em ORCAMENTO_OBRA com ORIGEM_REGISTRO = INCLUSAO_LOCAL?
```

A implementação atual tende a criar/atualizar o saldo local, mas vale validar se esse registro deve também carregar a composição escolhida de forma mais estruturada.

---

### 5.3 O sistema deve permitir aprovação parcial?

Exemplo:

```text
Solicitado: 100 un
Aprovado: 80 un
```

Até o momento, a análise em bloco usa a quantidade solicitada como quantidade incluída.

Dúvida:

```text
O analista precisa editar a quantidade aprovada antes de confirmar?
```

Se sim, a tabela de análise deve ter uma coluna:

```text
Qtd. aprovada / incluída
```

---

### 5.4 Quem deve validar a ciência da gestão?

Na solicitação existe o campo:

```text
GESTAO_CIENTE
```

Dúvida:

```text
A ciência da gestão será apenas informativa ou deve bloquear a análise caso esteja como "Não" ou "Aguardando validação"?
```

---

### 5.5 Como será o fluxo da compra solicitada?

Foi decidido que a compra solicitada é ação do solicitante, não do analista.

Dúvida:

```text
Quando o item for aprovado/incluído, ele deve aparecer automaticamente numa tela "Itens liberados para compra" para o solicitante marcar como solicitado?
```

Possível tela futura:

```text
Itens liberados para compra
```

Filtros:

```text
Obra
Solicitação
Insumo
Status de compra
```

Ação:

```text
Marcar compra solicitada
```

---

### 5.6 Reimportação do CSV após inclusões

Quando uma inclusão já feita pelo sistema for posteriormente refletida em novo CSV exportado do Informakon, pode haver risco de duplicar o ajuste local.

Dúvida:

```text
Como identificar automaticamente que uma inclusão local já foi refletida no novo CSV do Informakon?
```

Possíveis caminhos:

1. Controle manual pelo analista.
2. Comparação de saldo anterior/novo.
3. Marcar inclusões locais como "refletidas no CSV" após reimportação.
4. Criar rotina de conciliação.

---

### 5.7 Novo cadastro de insumo

Para itens `IN`, ainda falta definir o fluxo completo.

Dúvidas:

```text
Quais dados mínimos são obrigatórios para cadastrar novo insumo?
Quem cadastra o novo insumo no Informakon?
O sistema deve gerar uma lista de pendências de cadastro?
O item novo pode ser aprovado antes de existir no banco geral?
```

---

### 5.8 Classificação do insumo

O banco geral tem:

```text
Classe
Grupo
Caracterização
```

Dúvida:

```text
A classificação deve ser usada apenas para busca ou também para validação/análise?
```

Exemplo:

- alertar quando o usuário tentar usar um item de classificação muito diferente;
- agrupar resultados de busca por classe/grupo;
- sugerir similares por caracterização.

---

### 5.9 Performance

O sistema funciona, mas há riscos em bases grandes.

Dúvidas:

```text
Devemos criar cache de busca por obra?
Devemos limitar resultados no frontend?
Devemos indexar termos de busca em aba auxiliar?
Devemos migrar o banco para outra solução se crescer muito?
```

---

### 5.10 Versionamento e limpeza de bases

A reimportação mantém versões antigas inativas.

Dúvida:

```text
Qual política de retenção deve ser adotada?
```

Opções:

```text
Manter todas as versões
Manter apenas últimas 3 versões por obra
Arquivar versões antigas
Excluir versões antigas após validação
```

---

## 6. Última versão funcional gerada

Última etapa gerada:

```text
Backend: v8 - Alocação de insumos em composição
Frontend: v6 - Alocação de insumos em composição
```

Arquivos gerados anteriormente:

```text
isi_backend_v8_alocacao_composicao.zip
isi_frontend_github_pages_v6_alocacao_composicao.zip
isi_alocacao_composicao_v8_completo.zip
```

Principais recursos da última versão:

- análise em bloco;
- aprovação/recusa em tabela;
- agrupamento por composição;
- alocação obrigatória de BD/IN;
- seleção de composição existente;
- criação de nova composição na análise;
- aprovação significando inclusão no Informakon;
- atualização de saldo local após aprovação.
