# ISI Frontend v3.3 - Feedback corrigido

Esta versão corrige a tentativa anterior de feedback visual.

## O que muda

Agora foram alterados os 3 arquivos:

- `index.html`: inclui o bloco `loadingOverlay`.
- `assets/style.css`: inclui estilos do overlay, spinner e estados do toast.
- `assets/app.js`: altera diretamente a função real `api(action, payload)`, que é a função usada pelo sistema.

## Como aplicar

No repositório GitHub Pages, substitua:

```text
index.html
assets/style.css
assets/app.js
```

Depois aguarde o GitHub Pages publicar e recarregue a página com Ctrl+F5.

## Resultado esperado

Ao clicar em botões como:

- Testar conexão
- Importar banco geral
- Importar orçamento
- Buscar insumo
- Enviar solicitação

O sistema mostra:

- toast persistente;
- card flutuante com spinner;
- botões visualmente desabilitados;
- mensagem de sucesso ou erro ao finalizar.
