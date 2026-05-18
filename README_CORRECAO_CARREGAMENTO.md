# ISI Frontend Design Cloud v11 - Carregamento corrigido

## Problema identificado

A versão anterior do frontend Design Cloud estava visualmente correta, mas o carregamento real do banco podia parecer não funcionar porque:

1. As consultas usavam somente `POST + iframe`; em alguns cenários o retorno do Apps Script não chegava ao frontend.
2. A tela de configuração carregava obras/dashboard, mas não re-renderizava a aplicação após testar conexão.
3. A tela de Análise iniciava vazia e só carregava dados ao clicar em “Carregar dados”.

## Correções

- Leituras agora usam JSONP via `doGet` para evitar perda de resposta do iframe em ações de consulta.
- Escritas/importações continuam usando `POST`.
- Ao testar conexão, o frontend atualiza o estado, renderiza novamente e salva URL/API Key.
- Ao iniciar o app ou entrar na tela Análise, os dados de análise são carregados automaticamente.
- Mensagem de estado vazia mais clara quando os dados ainda não foram carregados.

## Como aplicar

Substitua no GitHub Pages:

```text
index.html
.nojekyll
assets/icons.js
assets/style.css
assets/tokens.css
assets/app.js
```

Depois recarregue com Ctrl+F5.
