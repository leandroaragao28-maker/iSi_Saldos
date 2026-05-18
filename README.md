# ISI Frontend v10 — Design Cloud integrado ao backend real

Esta versão usa o design do protótipo enviado e troca os dados mockados por chamadas reais à API Apps Script.

## Arquivos

```text
index.html
.nojekyll
assets/
  app.js
  icons.js
  style.css
  tokens.css
```

## O que foi aproveitado do protótipo

- Layout com rail lateral, topbar, main e statusbar.
- Tokens visuais em `tokens.css`.
- Componentes compactos em `style.css`.
- Registro de ícones em `icons.js`.
- Fluxo visual das telas:
  - Dashboard
  - Bases CSV
  - Nova Solicitação
  - Análise em bloco
  - Solicitações
  - Configuração

## Backend compatível

Compatível com o backend v11 já gerado anteriormente, desde que contenha estes endpoints:

```text
inicializarApp
getDashboardData
buscarInsumos
criarSolicitacao
listarSolicitacoesResumo
getDadosAnalise
processarAnaliseBloco
importarBancoGeralInsumos
importarOrcamentoInformakon
setupDatabase
limparCacheISI
```

## Como aplicar no GitHub Pages

Substitua no repositório:

```text
index.html
.nojekyll
assets/icons.js
assets/style.css
assets/tokens.css
assets/app.js
```

Depois recarregue a página com Ctrl+F5.

## Configuração

Na tela Configuração, informe:

- URL do Web App Apps Script terminada em `/exec`;
- API Key, se configurada no backend.

Clique em **Testar conexão**.

## Observações

- `mock-data.js` e `prototype-app.js` não são mais usados nesta versão.
- O frontend continua usando `form + iframe + postMessage`, compatível com o padrão adotado anteriormente para evitar problemas de CORS.
- A tela de análise preserva a lógica atual: aprovação em bloco, alocação de BD/IN e aprovação significando inclusão no Informakon.
