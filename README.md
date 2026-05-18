# ISI Frontend v9 - Confirmação de análise mais rápida

## O que mudou

Após confirmar decisões na tela de análise, o frontend não recarrega automaticamente:

- a análise completa;
- o dashboard.

Ele atualiza a tabela localmente com os itens aprovados/recusados.

Isso evita chamadas extras ao Apps Script logo depois do processamento do lote.

## Como aplicar

Substitua no GitHub Pages:

- `index.html`
- `assets/style.css`
- `assets/app.js`
- `.nojekyll`
