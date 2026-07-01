# Design: Cadastro em Grupo (múltiplos CNPJs)

**Data:** 2026-07-01
**Status:** Aprovado

## Visão Geral

No formulário de cadastro (`public/index.html`), o gerente pode marcar um cadastro como "grupo" quando o cliente tem várias empresas (CNPJs) do mesmo grupo econômico. Nesse modo, ele informa vários pares CNPJ + Razão Social de uma vez, mantendo Filial, Vendedor, Meta, Fornecedores e Percentual Estimado únicos e compartilhados por todas as empresas do grupo.

Mudança **apenas no frontend** — a API `POST /api/formulario` já aceita uma lista de itens (usada hoje para o lote de pendentes), então cada CNPJ do grupo simplesmente se torna um item independente nessa lista. Sem alteração em `server.js`, `database.js` ou no schema.

## Interação

**Toggle "Individual" / "Grupo"** no topo do formulário, acima do campo CNPJ, com o mesmo estilo visual dos botões de Filial (radio-item). Padrão: **Individual**.

- **Individual** (comportamento atual, inalterado): campos únicos de CNPJ e Razão Social.
- **Grupo**: os campos únicos de CNPJ e Razão Social são substituídos por uma **lista dinâmica de linhas**, cada linha com um par CNPJ + Razão Social:
  - Começa com 1 linha.
  - Botão **"+ Adicionar CNPJ"** abaixo da lista cria uma nova linha vazia.
  - Cada linha (exceto a primeira) tem um botão **"×"** para removê-la.
  - Cada campo CNPJ de cada linha recebe a mesma máscara de formatação (`00.000.000/0000-00`) já usada no campo único.

Filial, Vendedor, Meta, Fornecedores e Percentual Estimado continuam sendo campos únicos, visíveis e obrigatórios (exceto Fornecedores/Percentual, que já são opcionais) independente do modo.

## Geração de Itens

Ao clicar **"+ Adicionar"** (botão principal, existente):

- **Modo Individual:** comportamento atual — 1 item pendente.
- **Modo Grupo:** valida que **todas as linhas preenchidas** têm CNPJ e Razão Social (linhas totalmente vazias são ignoradas; linhas parcialmente preenchidas — só CNPJ ou só Razão Social — bloqueiam o envio com alerta, igual à validação atual de campo obrigatório). Gera **um item pendente por linha válida**, todos com a mesma Filial/Vendedor/Meta/Fornecedores/Percentual. Requer ao menos 1 linha válida.

Cada item gerado entra na tabela "Metas da filial" como um item **Pendente** independente, exatamente como hoje — sem vínculo entre si após criado. Editar ou excluir um desses itens (pendente ou já salvo) funciona exatamente igual ao fluxo atual, item por item; não existe "edição em lote do grupo".

Ao trocar o toggle de volta para **Individual** com linhas de grupo já preenchidas, os campos voltam ao modo padrão e as linhas digitadas são descartadas (sem confirmação — é uma ação local, antes de "+ Adicionar").

## Validação e Erros

- Nenhuma linha válida no modo Grupo → mesmo alerta já usado hoje ("Preencha todos os campos obrigatórios..."), adaptado para mencionar que é necessário ao menos um CNPJ completo.
- Linha com CNPJ sem Razão Social (ou vice-versa) → bloqueia com o mesmo alerta.
- Duplicidade de CNPJ entre linhas do mesmo grupo, ou com um item já pendente/salvo: não é validada no cliente — o comportamento de upsert por CNPJ já existente no banco (`ON CONFLICT (cnpj) DO UPDATE`) resolve isso na gravação, igual acontece hoje fora do modo grupo.

## Arquivos Afetados

```
formulario/
└── public/
    └── index.html   ← único arquivo alterado: toggle, linhas dinâmicas de CNPJ,
                         lógica de geração de N itens no modo grupo
```

## Fora do Escopo

- Edição em lote de um grupo já cadastrado (cada CNPJ é editado/excluído individualmente).
- Vínculo persistido entre os CNPJs de um mesmo grupo no banco (não há coluna "grupo_id"; são apenas linhas independentes com os mesmos dados compartilhados no momento da criação).
- Importação de CNPJs de um grupo a partir de arquivo (ex: planilha).
