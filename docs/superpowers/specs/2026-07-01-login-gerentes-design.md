# Design: Login de Gerentes por Filial

**Data:** 2026-07-01
**Status:** Aprovado

## Visão Geral

Hoje o formulário de cadastro (`/`) é público, sem autenticação. Esta fase adiciona um login para **gerentes de filial**: cada gerente acessa com e-mail/senha, cadastra metas apenas para a(s) filial(is) que gerencia, e visualiza/edita/exclui somente os registros dessas filiais. O painel administrativo (`/admin`, login fixo da Patricia) não é afetado — continua vendo todas as filiais, sem alterações.

## Modelo de Dados

Nova tabela `gerentes`:

```sql
CREATE TABLE IF NOT EXISTS gerentes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  filiais TEXT[] NOT NULL
);
```

- `senha_hash`: hash bcrypt, nunca texto puro.
- `filiais`: array com uma ou mais das 8 filiais existentes (Paulínia, Pouso Alegre, Anápolis, Sete Lagoas, Lins, Petrolina, Cariacia, Carazinho).
- Nova dependência: `bcrypt`.

A tabela `formularios` existente não muda de schema.

## Autenticação

- Sessão de gerente independente da sessão de admin: `req.session.gerente = { id, nome, filiais }`, usando a mesma infraestrutura `express-session` + `connect-pg-simple` já configurada.
- Novo middleware `requireGerente`, no mesmo padrão do `requireAdmin` existente — redireciona para `/login` se não autenticado.
- `/admin`, `/admin/login` e suas rotas continuam usando exclusivamente `req.session.admin`, sem interferência.

## Rotas Novas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/login` | Serve `public/login.html` |
| POST | `/login` | Valida e-mail/senha (bcrypt.compare) contra `gerentes`, cria `req.session.gerente`, redireciona para `/` |
| POST | `/logout` | Destrói a sessão do gerente, redireciona para `/login` |
| GET | `/` | **Passa a ser protegida por `requireGerente`** — serve `index.html` |
| GET | `/api/gerente/me` | Protegida — retorna `{ nome, filiais }` do gerente logado, para o front montar o radio-grid de filiais |
| GET | `/api/minhas-metas` | Protegida — retorna registros de `formularios` cujo `filial` está em `gerente.filiais` |
| PUT | `/api/minhas-metas/:id` | Protegida — edita um registro; valida que a filial atual **e** a nova filial (se alterada) pertencem a `gerente.filiais`, senão 403 |
| DELETE | `/api/minhas-metas/:id` | Protegida — exclui um registro; mesma validação de posse antes de excluir, senão 403 |

`POST /api/formulario` (envio em lote dos itens pendentes) permanece como está, mas passa a exigir `requireGerente` e a validar que toda `filial` enviada está em `gerente.filiais` do usuário logado (servidor rejeita tentativa de gravar em filial fora da sua área, mesmo que o front-end normalmente já restrinja isso).

## Frontend

**`public/login.html`** (novo) — mesmo estilo visual do `admin/login.html`: card centralizado, header escuro (`#1a1a2e`), accent índigo, campos e-mail/senha, botão "Entrar", mensagem de erro em credencial inválida.

**`public/index.html`** (ajustado):
- Topbar leve no topo: nome do gerente logado + botão "Sair" (`POST /logout`).
- Campo **Filial** do formulário: radio-grid dinâmico, populado via `GET /api/gerente/me` com apenas as filiais do gerente (em vez das 8 fixas no HTML).
- Tabela à direita:
  - Ao carregar a página, busca `GET /api/minhas-metas` e renderiza os registros já salvos (com badge de filial, já que o gerente pode ter mais de uma).
  - Ao clicar **"+ Adicionar"**, o item novo entra na mesma tabela com badge **"Pendente"**, misturado aos já salvos, mas mantido apenas no array local (`itens`) até o envio.
  - **"Enviar Formulário"** dispara `POST /api/formulario` só com os itens pendentes; em caso de sucesso, a tabela é recarregada via `GET /api/minhas-metas` (os itens antes pendentes agora vêm do servidor, com id real).
  - **Editar** num item **salvo**: preenche o formulário, e ao salvar chama `PUT /api/minhas-metas/:id`.
  - **Editar** num item **pendente**: comportamento atual (ajusta o array local, sem chamada de rede).
  - **Excluir** num item **salvo**: confirmação + `DELETE /api/minhas-metas/:id`.
  - **Remover** num item **pendente**: comportamento atual (tira do array local).

Nenhuma alteração visual ou funcional em `public/admin/index.html` ou `public/admin/login.html`.

## Criação de Contas de Gerente

Sem tela de administração de usuários nesta fase. Script utilitário `scripts/criar-gerente.js`:

- Recebe nome, e-mail, senha em texto puro e lista de filiais (via argumentos ou edição direta do script).
- Gera o hash bcrypt e insere/atualiza a linha em `gerentes`.
- Executado manualmente (`node scripts/criar-gerente.js`) uma vez por gerente, com os dados fornecidos pelo usuário fora deste repositório (não versionados).

## Fluxo de Erro

- Login com credencial inválida → mensagem de erro na tela, sem detalhar se o e-mail existe.
- Tentativa de acessar `/`, `/api/minhas-metas` etc. sem sessão de gerente → redirect para `/login` (rotas de página) ou `401` (rotas de API).
- Tentativa de editar/excluir registro fora das filiais do gerente → `403 Forbidden`.

## Estrutura de Arquivos

```
formulario/
├── server.js                  ← + rotas /login, /logout, /api/gerente/me, /api/minhas-metas, requireGerente
├── database.js                ← + tabela gerentes, funções buscarGerentePorEmail, listarMinhasMetas, atualizarMeta, excluirMeta
├── scripts/
│   └── criar-gerente.js       ← novo, cadastro manual de contas
├── public/
│   ├── login.html             ← novo
│   ├── index.html             ← ajustado (filial dinâmica, tabela com pendente/salvo, topbar)
│   └── admin/                 ← sem alterações
└── package.json                ← + bcrypt
```

## Fora do Escopo

- Tela de administração de contas de gerente (criar/editar/remover pela UI).
- Recuperação de senha ("esqueci minha senha").
- Múltiplos papéis de admin — Patricia continua com login fixo hardcoded.
- Auditoria/histórico de alterações nos registros.
