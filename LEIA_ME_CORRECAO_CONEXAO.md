# Correção de conexão v3.1

Esta versão altera o frontend para usar JSONP nas chamadas leves:

- health
- getObras
- getDashboardData
- buscarInsumos
- listarSolicitacoesResumo
- diagnosticarBusca
- setupDatabase

Isso evita o timeout no botão **Testar conexão**, que podia ocorrer quando o transporte por iframe/postMessage era bloqueado ou redirecionado.

## Como aplicar

Substitua no seu repositório GitHub Pages:

```text
assets/app.js
```

pelo arquivo desta versão.

Depois aguarde o GitHub Pages atualizar a publicação e recarregue a página com Ctrl+F5.

## Conferências obrigatórias

1. A URL da API precisa terminar em `/exec`.
2. A implantação do Apps Script precisa estar como **Aplicativo da Web**.
3. A opção **Quem pode acessar** precisa ser **Qualquer pessoa**.
4. Depois de alterar o Code.gs, sempre use **Gerenciar implantações > Editar > Nova versão > Implantar**.
