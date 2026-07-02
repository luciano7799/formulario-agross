# Design: Nome do Grupo + Meta Única por Grupo

**Data:** 2026-07-02
**Status:** Aprovado

## Visão Geral

Hoje o formulário permite adicionar vários CNPJs "do mesmo grupo" (botão "+ Adicionar outro CNPJ (mesmo grupo)"), mas cada CNPJ vira um registro independente com a mesma meta copiada, e não há nome de grupo. Esta mudança adiciona um campo **"Nome do grupo"** e faz a **meta ser um alvo único do grupo** (os CNPJs do grupo somados devem atingir a meta), sem multiplicar a meta pelo número de CNPJs nos totais.

## Regras de Negócio

- A meta informada para um grupo é o **alvo do grupo inteiro** (ex.: R$ 300.000 para um grupo de 3 CNPJs = 300k somando os 3, não 900k).
- O campo "Nome do grupo" aparece **somente no modo grupo** (quando há ao menos 1 CNPJ adicional). Para um CNPJ único, fica oculto e o registro tem `grupo = NULL`.
- No modo grupo, o nome do grupo é **obrigatório**.
- A meta fica **visível em todas as linhas do grupo** (tabela do gerente, painel admin, Excel), independente da quantidade de CNPJs.
- Nos **totais** (stat "Meta total" do gerente e dashboard "Meta por filial" do admin), a meta do grupo é somada **uma única vez**.
- **Editar a meta** de qualquer CNPJ de um grupo propaga o novo valor para **todos os CNPJs do mesmo grupo** (a meta é uma só).

## Modelo de Dados

Nova coluna em `formularios`:

```sql
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS grupo TEXT;
```

- `grupo = NULL` → CNPJ individual.
- `grupo = '<texto>'` → pertence ao grupo nomeado. Todos os CNPJs do grupo têm o mesmo texto e a **mesma meta** (repetida em cada linha, para exibição).
- Um grupo é sempre de uma única filial (a filial escolhida vale para o grupo todo).

## Backend (`database.js`, `server.js`)

- `inserirFormulario`: passa a gravar `grupo`.
- `listarFormularios`, `listarMetasPorFiliais`, `buscarMetaPorId`: passam a retornar `grupo`.
- `atualizarMeta`: grava `grupo`.
- `POST /api/formulario`: aceita `grupo` por item. Validação de meta inalterada (todo item, inclusive de grupo, carrega o valor cheio da meta — nenhum item vai com meta 0).
- `PUT /api/minhas-metas/:id`: além de atualizar o registro, se `grupo` estiver preenchido, **propaga a meta** para todos os registros do mesmo `grupo` dentro das filiais do gerente:
  ```sql
  UPDATE formularios SET meta = $meta WHERE grupo = $grupo AND filial = ANY($filiais);
  ```
- `GET /api/admin/export`: adiciona coluna "Grupo".

## Frontend Gerente (`public/index.html`)

- Campo **"Nome do grupo"** renderizado acima das linhas de CNPJ, visível apenas quando `cnpjExtras.length > 0`. Obrigatório nesse caso.
- `adicionarItem`: se em modo grupo, define `grupo = <nome>` em todos os itens (principal + extras), cada um com a meta cheia. Se CNPJ único, `grupo = null`.
- Tabela de metas: nova coluna **"Grupo"** (individual mostra "—").
- `renderStats` ("Meta total"): soma a meta contando cada `grupo` **uma vez** (linhas com `grupo` null contam individualmente).
- Envio (`enviarTudo`) e edição incluem `grupo` no payload.

## Frontend Admin (`public/admin/index.html`)

- Nova coluna **"Grupo"** na tabela.
- `renderDash` ("Meta por filial"): ao somar por filial, conta a meta de cada grupo **uma vez** (dedup por `filial|grupo`); linhas sem grupo contam individualmente. A contagem de "form." continua por registro (nº de CNPJs).

## Fora do Escopo

- Edição do nome do grupo depois de salvo pela UI (só a meta propaga; renomear grupo em massa fica para depois).
- Relatório dedicado por grupo.
- Divisão/rateio da meta entre CNPJs (a meta é do grupo como um todo).
