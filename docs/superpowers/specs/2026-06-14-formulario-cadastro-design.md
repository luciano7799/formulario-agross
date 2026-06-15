# Design: Formulário de Cadastro de Cliente

**Data:** 2026-06-14  
**Status:** Aprovado

## Visão Geral

Aplicação web local (localhost) com formulário de cadastro de dados de clientes. Usuários preenchem o formulário; dados são salvos em banco SQLite para futura consulta por administradores (painel admin fora do escopo desta fase).

## Stack

- **Backend:** Node.js + Express
- **Banco de dados:** SQLite (via `better-sqlite3`)
- **Frontend:** HTML + CSS + JavaScript puro (sem frameworks)

## Campos do Formulário

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| CNPJ | Texto | Sim |
| Razão Social | Texto | Sim |
| Filial | Radio button | Sim |
| Vendedor | Texto | Sim |
| Meta | Número | Sim |
| Fornecedores que pretende crescer com o cliente | Texto | Não |
| Percentual estimado (%) | Número | Não |

**Filiais disponíveis:** Paulínia, Pouso Alegre, Anápolis, Sete Lagoas, Lins, Petrolina, Cariacia, Carazinho

**Ordem dos campos:** CNPJ → Razão Social → Filial → Vendedor → Meta → Fornecedores → Percentual estimado

## Visual

Estilo card centralizado com header escuro (`#1a1a2e`), accent índigo (`#4f46e5`), fundo cinza suave. Layout em duas colunas para campos menores (CNPJ + Vendedor). Campos de radio para filial com estilo de botão selecionável.

## API

- `POST /api/formulario` — valida e persiste os dados; retorna `{ success: true }` ou erro
- `GET /` — serve o `index.html`

## Fluxo de Envio

1. Usuário preenche os campos obrigatórios
2. Clica em "Enviar Formulário"
3. JS valida campos obrigatórios client-side (bloqueia envio se incompleto)
4. `fetch()` envia JSON para `POST /api/formulario`
5. Server valida novamente e persiste no banco
6. Sucesso → mensagem verde aparece + formulário limpo
7. Erro → mensagem vermelha com detalhe do problema

## Estrutura de Arquivos

```
C:\Users\lucia\formulario\
├── server.js          ← Express + rotas
├── database.js        ← configuração SQLite
├── public\
│   └── index.html     ← formulário completo
├── database.db        ← criado automaticamente
└── package.json
```

## Fora do Escopo (fase 1)

- Painel administrativo
- Autenticação de usuários
- Listagem/exportação de registros
