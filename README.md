# ISI Frontend v8 - Performance

## Principais melhorias

- A abertura/teste de conexão usa `inicializarApp`, reduzindo 3 chamadas para 1.
- A tela de análise usa `getDadosAnalise`, reduzindo chamadas de itens + composições para 1.
- Após criar solicitação, o frontend não recarrega automaticamente toda a lista de solicitações.
- Mantém toast/loading visual.

## Como aplicar

Substitua no GitHub Pages:

- `index.html`
- `assets/style.css`
- `assets/app.js`
- `.nojekyll`

Depois recarregue a página com Ctrl+F5.
