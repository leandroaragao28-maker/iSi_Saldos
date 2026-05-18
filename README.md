# ISI Frontend v4 - Análise/Aprovação

Esta versão adiciona a tela **Análise**, com ações por item:

- Aprovar;
- Recusar;
- Marcar incluído no Informakon;
- Marcar compra solicitada.

## Como aplicar

Substitua no GitHub Pages:

```text
index.html
assets/style.css
assets/app.js
.nojekyll
```

## Dependência

Use junto com o backend v6, pois a tela de análise usa os endpoints:

```text
listarItensAnalise
listarSolicitacaoDetalhada
```

## Teste recomendado

1. Testar conexão.
2. Criar uma solicitação com 2 itens.
3. Ir em Análise.
4. Clicar em Carregar itens.
5. Aprovar um item.
6. Marcar incluído no Informakon.
7. Marcar compra solicitada.
