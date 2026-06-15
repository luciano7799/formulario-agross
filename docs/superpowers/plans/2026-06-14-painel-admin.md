# Painel Administrativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar painel admin protegido por login em `/admin` que lista todos os formulários enviados com busca, filtro por filial e exportação para Excel.

**Architecture:** `express-session` protege as rotas `/admin` e `/api/admin/*`. O login valida credenciais hardcoded e cria uma sessão. O frontend em `public/admin/` faz fetch para `/api/admin/formularios` e filtra client-side. A exportação Excel é gerada server-side com `xlsx` e servida como download.

**Tech Stack:** Node.js, Express 4, express-session, xlsx, better-sqlite3, HTML/CSS/JS puro

---

### Task 1: Instalar dependências

**Files:**
- Modify: `C:\Users\lucia\formulario\package.json`

- [ ] **Step 1: Instalar express-session e xlsx**

```bash
cd C:/Users/lucia/formulario
npm install express-session xlsx
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "require('express-session'); require('xlsx'); console.log('OK')"
```
Resultado esperado: `OK`

---

### Task 2: Adicionar rota de listagem ao database.js

**Files:**
- Modify: `C:\Users\lucia\formulario\database.js`

- [ ] **Step 1: Adicionar função `listarFormularios`**

Abrir `database.js` e adicionar ao final, antes do `module.exports`:

```js
function listarFormularios() {
  return db.prepare(`
    SELECT id, cnpj, razao_social, filial, vendedor, meta,
           fornecedores, percentual_estimado,
           strftime('%d/%m/%Y %H:%M', criado_em) AS criado_em
    FROM formularios
    ORDER BY id DESC
  `).all();
}
```

E atualizar o `module.exports`:

```js
module.exports = { inserirFormulario, listarFormularios };
```

- [ ] **Step 2: Verificar**

```bash
node -e "const {listarFormularios} = require('./database'); console.log(listarFormularios())"
```
Resultado esperado: array com os registros já salvos.

---

### Task 3: Adicionar sessão, rotas de login/logout e rotas admin ao server.js

**Files:**
- Modify: `C:\Users\lucia\formulario\server.js`

- [ ] **Step 1: Substituir o conteúdo completo de `server.js`**

```js
const express = require('express');
const path = require('path');
const session = require('express-session');
const XLSX = require('xlsx');
const { inserirFormulario, listarFormularios } = require('./database');

const app = express();
const PORT = 3000;

const ADMIN_EMAIL = 'patricia.viana@agross.com.br';
const ADMIN_SENHA = 'pati@agross';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: 'agross-admin-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// ── Login / Logout ──
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.post('/admin/login', (req, res) => {
  const { email, senha } = req.body;
  if (email === ADMIN_EMAIL && senha === ADMIN_SENHA) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?erro=1');
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ── Painel admin ──
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ── API admin ──
app.get('/api/admin/formularios', requireAdmin, (req, res) => {
  res.json(listarFormularios());
});

app.get('/api/admin/export', requireAdmin, (req, res) => {
  const dados = listarFormularios();
  const linhas = dados.map(r => ({
    '#': r.id,
    'CNPJ': r.cnpj,
    'Razão Social': r.razao_social,
    'Filial': r.filial,
    'Vendedor': r.vendedor,
    'Meta (R$)': r.meta,
    '% Estimado': r.percentual_estimado ?? '',
    'Fornecedores': r.fornecedores ?? '',
    'Enviado em': r.criado_em
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, 'Formulários');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="formularios.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── Formulário público ──
app.post('/api/formulario', (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0)
    return res.status(400).json({ error: 'Nenhum item para salvar.' });
  for (const item of itens) {
    if (!item.cnpj || !item.razao_social || !item.filial || !item.vendedor || !item.meta)
      return res.status(400).json({ error: 'Um ou mais itens estão com campos obrigatórios faltando.' });
  }
  try {
    for (const item of itens) {
      inserirFormulario({
        cnpj: item.cnpj, razao_social: item.razao_social, filial: item.filial,
        vendedor: item.vendedor, meta: item.meta,
        fornecedores: item.fornecedores || null,
        percentual_estimado: item.percentual_estimado || null
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar os dados. Tente novamente.' });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check server.js && echo "Sintaxe OK"
```
Resultado esperado: `Sintaxe OK`

---

### Task 4: Criar tela de login

**Files:**
- Create: `C:\Users\lucia\formulario\public\admin\login.html`

- [ ] **Step 1: Criar pasta e arquivo**

```bash
mkdir -p C:/Users/lucia/formulario/public/admin
```

- [ ] **Step 2: Criar `public/admin/login.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #eef0f4; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); width: 100%; max-width: 380px; overflow: hidden; }
  .card-header { background: #1a1a2e; padding: 32px 32px 24px; color: #fff; text-align: center; }
  .card-header .icon { font-size: 36px; margin-bottom: 12px; }
  .card-header h1 { font-size: 18px; font-weight: 700; }
  .card-header p { font-size: 12px; opacity: 0.5; margin-top: 4px; }
  .card-body { padding: 28px 32px 32px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 12px; font-weight: 600; color: #555; margin-bottom: 5px; }
  .field input {
    width: 100%; padding: 10px 13px;
    border: 1.5px solid #e4e7ec; border-radius: 8px;
    font-size: 14px; background: #f9fafb; outline: none;
    transition: border 0.2s;
  }
  .field input:focus { border-color: #4f46e5; background: #fff; }
  .btn {
    width: 100%; padding: 11px; background: #4f46e5; color: #fff;
    border: none; border-radius: 8px; font-size: 15px; font-weight: 700;
    cursor: pointer; margin-top: 4px; transition: background 0.2s;
  }
  .btn:hover { background: #4338ca; }
  .erro { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; display: none; }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="icon">🔐</div>
    <h1>Painel Administrativo</h1>
    <p>Acesso restrito</p>
  </div>
  <div class="card-body">
    <div class="erro" id="erro">E-mail ou senha incorretos.</div>
    <form method="POST" action="/admin/login">
      <div class="field">
        <label>E-mail</label>
        <input type="email" name="email" placeholder="seu@email.com" required autofocus>
      </div>
      <div class="field">
        <label>Senha</label>
        <input type="password" name="senha" placeholder="••••••••" required>
      </div>
      <button class="btn" type="submit">Entrar</button>
    </form>
  </div>
</div>
<script>
  if (new URLSearchParams(location.search).get('erro'))
    document.getElementById('erro').style.display = 'block';
</script>
</body>
</html>
```

---

### Task 5: Criar painel admin

**Files:**
- Create: `C:\Users\lucia\formulario\public\admin\index.html`

- [ ] **Step 1: Criar `public/admin/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — Formulários</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #eef0f4; min-height: 100vh; }
  .topbar {
    background: #1a1a2e; height: 56px; padding: 0 28px;
    display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10;
  }
  .topbar-left { display: flex; align-items: center; gap: 12px; }
  .topbar-logo { width: 34px; height: 34px; background: #4f46e5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .topbar-title { color: #fff; font-size: 15px; font-weight: 700; }
  .topbar-sub { color: rgba(255,255,255,0.4); font-size: 13px; margin-left: 4px; }
  .btn-logout {
    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
    padding: 6px 14px; font-size: 12px; cursor: pointer; transition: background 0.15s;
  }
  .btn-logout:hover { background: rgba(255,255,255,0.15); }
  .body { padding: 24px 28px; }
  .panel-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
  .panel-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
  .panel-sub { font-size: 13px; color: #888; margin-top: 3px; }
  .btn-excel {
    display: flex; align-items: center; gap: 7px;
    background: #059669; color: #fff; border: none; border-radius: 8px;
    padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
    text-decoration: none; transition: background 0.2s;
  }
  .btn-excel:hover { background: #047857; }
  .table-card { background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); overflow: hidden; }
  .toolbar { padding: 14px 20px; border-bottom: 1px solid #f0f2f5; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .search-input {
    flex: 1; min-width: 200px; max-width: 320px; padding: 8px 12px;
    border: 1.5px solid #e4e7ec; border-radius: 7px; font-size: 13px; background: #f9fafb; outline: none;
  }
  .search-input:focus { border-color: #4f46e5; }
  .filter-select {
    padding: 8px 12px; border: 1.5px solid #e4e7ec; border-radius: 7px;
    font-size: 13px; background: #f9fafb; color: #444; outline: none; cursor: pointer;
  }
  .badge-total { margin-left: auto; background: #f0f0ff; color: #4f46e5; border-radius: 20px; padding: 3px 14px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: #f4f5f7; }
  thead th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e4e7ec; white-space: nowrap; }
  tbody tr { border-bottom: 1px solid #f0f2f5; transition: background 0.15s; }
  tbody tr:hover { background: #fafbff; }
  tbody td { padding: 12px 16px; color: #333; vertical-align: middle; }
  .filial-badge { display: inline-block; background: #ede9fe; color: #4f46e5; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .meta-val { font-weight: 600; color: #059669; white-space: nowrap; }
  .date-val { color: #aaa; font-size: 12px; white-space: nowrap; }
  .empty-state { padding: 48px; text-align: center; color: #bbb; font-size: 14px; }
  .loading { padding: 48px; text-align: center; color: #aaa; font-size: 13px; }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <div class="topbar-logo">📋</div>
    <span class="topbar-title">AgRoss</span>
    <span class="topbar-sub">/ Admin</span>
  </div>
  <form method="POST" action="/admin/logout" style="margin:0">
    <button class="btn-logout" type="submit">Sair</button>
  </form>
</div>

<div class="body">
  <div class="panel-header">
    <div>
      <div class="panel-title">Formulários recebidos</div>
      <div class="panel-sub">Todos os cadastros enviados pelo formulário</div>
    </div>
    <a class="btn-excel" href="/api/admin/export">⬇ Exportar Excel</a>
  </div>

  <div class="table-card">
    <div class="toolbar">
      <input class="search-input" id="busca" placeholder="🔍  Buscar CNPJ ou razão social..." oninput="filtrar()">
      <select class="filter-select" id="filtro-filial" onchange="filtrar()">
        <option value="">Todas as filiais</option>
        <option>Paulínia</option>
        <option>Pouso Alegre</option>
        <option>Anápolis</option>
        <option>Sete Lagoas</option>
        <option>Lins</option>
        <option>Petrolina</option>
        <option>Cariacia</option>
        <option>Carazinho</option>
      </select>
      <span class="badge-total" id="contador">0 registros</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>CNPJ</th><th>Razão Social</th><th>Filial</th>
            <th>Vendedor</th><th>Meta</th><th>% Est.</th><th>Fornecedores</th><th>Enviado em</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div class="loading" id="loading">Carregando...</div>
      <div class="empty-state" id="empty" style="display:none">Nenhum registro encontrado.</div>
    </div>
  </div>
</div>

<script>
  let todos = [];

  async function carregar() {
    const res = await fetch('/api/admin/formularios');
    todos = await res.json();
    filtrar();
    document.getElementById('loading').style.display = 'none';
  }

  function filtrar() {
    const busca  = document.getElementById('busca').value.toLowerCase();
    const filial = document.getElementById('filtro-filial').value;
    const filtrados = todos.filter(r =>
      (!busca  || r.cnpj.toLowerCase().includes(busca) || r.razao_social.toLowerCase().includes(busca)) &&
      (!filial || r.filial === filial)
    );
    renderizar(filtrados);
  }

  function renderizar(lista) {
    const tbody = document.getElementById('tbody');
    const empty = document.getElementById('empty');
    document.getElementById('contador').textContent = lista.length + ' registro' + (lista.length !== 1 ? 's' : '');

    if (lista.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = lista.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.cnpj}</td>
        <td>${r.razao_social}</td>
        <td><span class="filial-badge">${r.filial}</span></td>
        <td>${r.vendedor}</td>
        <td class="meta-val">R$ ${Number(r.meta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td>${r.percentual_estimado != null ? r.percentual_estimado + '%' : '-'}</td>
        <td>${r.fornecedores || '-'}</td>
        <td class="date-val">${r.criado_em}</td>
      </tr>
    `).join('');
  }

  carregar();
</script>
</body>
</html>
```

---

### Task 6: Reiniciar servidor e testar

- [ ] **Step 1: Matar node existente e reiniciar**

```bash
taskkill //F //IM node.exe
```
Aguardar 1 segundo, então:
```bash
cd C:/Users/lucia/formulario && node server.js
```

- [ ] **Step 2: Testar login com credenciais erradas**

Abrir `http://localhost:3000/admin/login`, digitar qualquer e-mail/senha errados e clicar Entrar.  
Resultado esperado: página recarrega com mensagem "E-mail ou senha incorretos."

- [ ] **Step 3: Testar login correto**

E-mail: `patricia.viana@agross.com.br` / Senha: `pati@agross`  
Resultado esperado: redireciona para `http://localhost:3000/admin` com a tabela de registros.

- [ ] **Step 4: Testar exportação Excel**

Clicar em "Exportar Excel".  
Resultado esperado: download de `formularios.xlsx` com todos os registros.

- [ ] **Step 5: Testar proteção de rota**

Abrir aba anônima e acessar `http://localhost:3000/admin` diretamente.  
Resultado esperado: redireciona para `/admin/login`.

- [ ] **Step 6: Testar logout**

Clicar em "Sair".  
Resultado esperado: redireciona para `/admin/login` e acesso direto a `/admin` volta a redirecionar.
