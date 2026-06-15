# Design: Painel Administrativo

**Data:** 2026-06-14  
**Status:** Aprovado

## Visão Geral

Painel protegido por login para que a administradora visualize todos os formulários enviados. Acesso via `/admin/login`, sessão mantida com `express-session`. Exibe tabela com busca, filtro por filial e exportação para Excel.

## Credenciais

- **E-mail:** patricia.viana@agross.com.br  
- **Senha:** pati@agross  
- Hardcoded no servidor por enquanto (sem banco de usuários).

## Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/login` | Serve `public/admin/login.html` |
| POST | `/admin/login` | Valida credenciais, cria sessão, redireciona para `/admin` |
| GET | `/admin` | Protegido — serve `public/admin/index.html` |
| POST | `/admin/logout` | Destrói sessão, redireciona para `/admin/login` |
| GET | `/api/admin/formularios` | Protegido — retorna todos os registros em JSON |
| GET | `/api/admin/export` | Protegido — gera e baixa arquivo `.xlsx` |

## Frontend

**`public/admin/login.html`**  
Card centralizado com header escuro, campos e-mail e senha, botão "Entrar", mensagem de erro em caso de credencial inválida.

**`public/admin/index.html`**  
- Topbar escura com logo, título "AgRoss / Admin" e botão "Sair"
- Barra de ferramentas com busca (CNPJ ou razão social) + filtro de filial + contador de registros
- Tabela com colunas: #, CNPJ, Razão Social, Filial (badge), Vendedor, Meta, % Est., Fornecedores, Enviado em
- Botão "Exportar Excel" (verde) que dispara download do `/api/admin/export`
- Filtragem feita client-side em JavaScript

## Dependências novas

- `express-session` — gerenciamento de sessão
- `xlsx` — geração do arquivo Excel

## Estrutura de Arquivos

```
formulario/
├── server.js              ← adicionar rotas admin + session
├── public/
│   ├── index.html         ← formulário (sem alterações)
│   └── admin/
│       ├── login.html     ← tela de login
│       └── index.html     ← painel admin
└── package.json           ← adicionar express-session e xlsx
```

## Fora do Escopo

- Múltiplos usuários admin
- Edição ou exclusão de registros
- Paginação (implementar se volume crescer)
