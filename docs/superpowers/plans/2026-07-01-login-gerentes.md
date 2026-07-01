# Login de Gerentes por Filial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proteger o formulário com login de gerente, restringindo cadastro e visualização de metas às filiais de cada gerente, sem alterar o painel admin da Patricia.

**Architecture:** Express + Postgres (`pg`) já existentes. Nova tabela `gerentes` com senha em hash. Sessão de gerente (`req.session.gerente`) separada da sessão de admin, reaproveitando `express-session` + `connect-pg-simple`. Autorização por filial centralizada num helper puro e testável (`auth.js`). Frontend em HTML/JS puro (sem framework), seguindo o padrão visual existente.

**Tech Stack:** Node.js, Express 5, PostgreSQL (`pg`), `express-session`, `bcryptjs` (JS puro — escolhido no lugar do `bcrypt` nativo citado na spec para evitar compilação no Windows/Render; API equivalente).

**Status de verificação (2026-07-01):** Tasks 1–7 implementadas e commitadas na branch `feature/login-gerentes`. A Task 8 (teste ponta a ponta) **não foi executada ao vivo** — não havia Postgres acessível (3 contas Render verificadas não tinham o serviço `formulario-db`; Docker Desktop não respondeu localmente). Em vez disso, foi feita revisão manual linha a linha de `server.js`, `database.js`, `auth.js`, `scripts/criar-gerente.js`, `public/login.html` e `public/index.html`, com verificação de sintaxe (`node -c`) em todos os arquivos. **Antes de mesclar para `master`/fazer deploy, rode a Task 8 do checklist abaixo manualmente com uma `DATABASE_URL` real.**

---

## File Structure

- **`auth.js`** (novo) — helper puro `gerenteTemFilial(gerente, filial)`. Única responsabilidade: decisão de autorização por filial. Sem I/O, testável isoladamente.
- **`database.js`** (modificar) — criar tabela `gerentes` no `init()`; adicionar `buscarGerentePorEmail`, `listarMetasPorFiliais`, `buscarMetaPorId`, `atualizarMeta`, `excluirMeta`.
- **`server.js`** (modificar) — middleware `requireGerente`; rotas `/login`, `/logout`, `GET /` protegida, `/api/gerente/me`, `/api/minhas-metas` (GET/PUT/DELETE); proteger e validar filial em `POST /api/formulario`.
- **`scripts/criar-gerente.js`** (novo) — CLI para cadastrar/atualizar um gerente com hash bcrypt.
- **`public/login.html`** (novo) — tela de login do gerente, espelhando `public/admin/login.html`.
- **`public/index.html`** (modificar) — topbar com nome + Sair; filial dinâmica; tabela com registros salvos + pendentes; editar/excluir via API.
- **`test/auth.test.js`** (novo) — testes unitários do helper de autorização (runner nativo `node:test`, sem dependências).
- **`package.json`** (modificar) — adicionar `bcryptjs`; script `test`.

**Nota de segurança (consistente com o modelo atual):** o shell HTML (`index.html`) pode ser servido estaticamente sem vazar dados — todo dado sensível passa por rotas `/api/*` protegidas, exatamente como já ocorre com `/admin/index.html` hoje. A rota `GET /` explícita e protegida cuida do redirecionamento de UX para não logados.

---

### Task 1: Dependência bcryptjs + script de teste

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar bcryptjs**

Run: `npm install bcryptjs`
Expected: `bcryptjs` aparece em `dependencies` no `package.json`.

- [ ] **Step 2: Adicionar script de teste**

Editar o bloco `scripts` de `package.json` para:

```json
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs and test script"
```

---

### Task 2: Helper de autorização por filial (TDD)

**Files:**
- Create: `auth.js`
- Test: `test/auth.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/auth.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { gerenteTemFilial } = require('../auth');

test('retorna true quando a filial está vinculada ao gerente', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: ['Lins', 'Paulínia'] }, 'Lins'), true);
});

test('retorna false quando a filial não está vinculada', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: ['Lins'] }, 'Anápolis'), false);
});

test('retorna false quando o gerente não tem filiais', () => {
  assert.strictEqual(gerenteTemFilial({ filiais: [] }, 'Lins'), false);
});

test('retorna false quando o gerente é nulo ou inválido', () => {
  assert.strictEqual(gerenteTemFilial(null, 'Lins'), false);
  assert.strictEqual(gerenteTemFilial({}, 'Lins'), false);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../auth'`.

- [ ] **Step 3: Implementar o mínimo para passar**

Criar `auth.js`:

```js
function gerenteTemFilial(gerente, filial) {
  return !!gerente && Array.isArray(gerente.filiais) && gerente.filiais.includes(filial);
}

module.exports = { gerenteTemFilial };
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test`
Expected: PASS — 4 testes ok.

- [ ] **Step 5: Commit**

```bash
git add auth.js test/auth.test.js
git commit -m "feat: add gerenteTemFilial authorization helper with tests"
```

---

### Task 3: Tabela e funções de banco para gerentes e metas

**Files:**
- Modify: `database.js`

- [ ] **Step 1: Criar a tabela `gerentes` no `init()`**

Em `database.js`, dentro de `async function init()`, após a criação do índice de `formularios`, adicionar:

```js
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gerentes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      filiais TEXT[] NOT NULL
    )
  `);
```

- [ ] **Step 2: Adicionar as funções de acesso**

Ainda em `database.js`, antes da linha `module.exports = ...`, adicionar:

```js
async function buscarGerentePorEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, nome, email, senha_hash, filiais FROM gerentes WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function listarMetasPorFiliais(filiais) {
  const { rows } = await pool.query(`
    SELECT id, cnpj, razao_social, filial, vendedor,
           meta::float, fornecedores, percentual_estimado::float,
           TO_CHAR(criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS criado_em
    FROM formularios
    WHERE filial = ANY($1)
    ORDER BY id DESC
  `, [filiais]);
  return rows;
}

async function buscarMetaPorId(id) {
  const { rows } = await pool.query(
    `SELECT id, cnpj, razao_social, filial, vendedor, meta::float,
            fornecedores, percentual_estimado::float
     FROM formularios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function atualizarMeta(id, dados) {
  await pool.query(
    `UPDATE formularios SET
       cnpj = $1, razao_social = $2, filial = $3, vendedor = $4, meta = $5,
       fornecedores = $6, percentual_estimado = $7
     WHERE id = $8`,
    [dados.cnpj, dados.razao_social, dados.filial, dados.vendedor, dados.meta,
     dados.fornecedores || null, dados.percentual_estimado || null, id]
  );
}

async function excluirMeta(id) {
  const { rowCount } = await pool.query(`DELETE FROM formularios WHERE id = $1`, [id]);
  return rowCount;
}
```

- [ ] **Step 3: Exportar as novas funções**

Substituir a linha final de export de `database.js` por:

```js
module.exports = {
  pool, init, inserirFormulario, listarFormularios,
  buscarGerentePorEmail, listarMetasPorFiliais, buscarMetaPorId,
  atualizarMeta, excluirMeta
};
```

- [ ] **Step 4: Verificar que o arquivo carrega sem erro de sintaxe**

Run: `node -e "require('./database')" `
Expected: sem saída e sem erro (o require não conecta ao banco, só carrega o módulo).

- [ ] **Step 5: Commit**

```bash
git add database.js
git commit -m "feat: add gerentes table and metas query/mutation functions"
```

---

### Task 4: Script CLI para cadastrar gerentes

**Files:**
- Create: `scripts/criar-gerente.js`

- [ ] **Step 1: Criar o script**

Criar `scripts/criar-gerente.js`:

```js
const bcrypt = require('bcryptjs');
const { pool, init } = require('../database');

async function main() {
  const [, , nome, email, senha, filiaisArg] = process.argv;
  if (!nome || !email || !senha || !filiaisArg) {
    console.error('Uso: node scripts/criar-gerente.js "Nome" email senha "Filial1,Filial2"');
    console.error('Ex.: node scripts/criar-gerente.js "João Silva" joao@agross.com.br senha123 "Lins,Pouso Alegre"');
    process.exit(1);
  }

  const emailNorm = email.trim().toLowerCase();
  const filiais = filiaisArg.split(',').map(s => s.trim()).filter(Boolean);
  if (filiais.length === 0) {
    console.error('Informe ao menos uma filial.');
    process.exit(1);
  }

  await init();
  const senha_hash = await bcrypt.hash(senha, 10);
  await pool.query(
    `INSERT INTO gerentes (nome, email, senha_hash, filiais)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       nome = EXCLUDED.nome,
       senha_hash = EXCLUDED.senha_hash,
       filiais = EXCLUDED.filiais`,
    [nome, emailNorm, senha_hash, filiais]
  );

  console.log(`Gerente salvo: ${emailNorm} — filiais: ${filiais.join(', ')}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verificar sintaxe e mensagem de uso**

Run: `node scripts/criar-gerente.js`
Expected: imprime a mensagem "Uso: ..." e sai (não conecta ao banco porque falta argumento).

- [ ] **Step 3: Commit**

```bash
git add scripts/criar-gerente.js
git commit -m "feat: add CLI script to create/update gerente accounts"
```

---

### Task 5: Middleware, rotas de login e API de metas do gerente

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Ajustar imports no topo de `server.js`**

Substituir a linha de require do `./database` e adicionar bcrypt e auth. As primeiras linhas passam a ser:

```js
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { gerenteTemFilial } = require('./auth');
const {
  pool, init, inserirFormulario, listarFormularios,
  buscarGerentePorEmail, listarMetasPorFiliais, buscarMetaPorId,
  atualizarMeta, excluirMeta
} = require('./database');
```

- [ ] **Step 2: Adicionar o middleware `requireGerente`**

Logo após a função `requireAdmin` existente (por volta da linha 32), adicionar:

```js
function requireGerente(req, res, next) {
  if (req.session && req.session.gerente) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado.' });
  res.redirect('/login');
}
```

- [ ] **Step 3: Adicionar as rotas de login/logout do gerente**

Antes da seção `// ── Login / Logout ──` do admin (ou logo após o `app.use(express.static(...))`), adicionar:

```js
// ── Login / Logout gerente ──
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const g = await buscarGerentePorEmail((email || '').trim().toLowerCase());
    if (g && await bcrypt.compare(senha || '', g.senha_hash)) {
      req.session.gerente = { id: g.id, nome: g.nome, filiais: g.filiais };
      return res.redirect('/');
    }
  } catch (err) {
    console.error(err);
  }
  res.redirect('/login?erro=1');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Formulário protegido (raiz) ──
app.get('/', requireGerente, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

> Importante: essa rota `GET /` precisa ficar **antes** de `app.use(express.static(...))` para ter prioridade sobre o `index.html` estático. Se `express.static` já estiver registrado acima, mova o bloco `GET /` para antes dele.

- [ ] **Step 4: Adicionar a API de metas do gerente**

Após as rotas admin de API (após o bloco `DELETE /api/admin/formularios/:id`), adicionar:

```js
// ── API gerente ──
app.get('/api/gerente/me', requireGerente, (req, res) => {
  res.json({ nome: req.session.gerente.nome, filiais: req.session.gerente.filiais });
});

app.get('/api/minhas-metas', requireGerente, async (req, res) => {
  try {
    res.json(await listarMetasPorFiliais(req.session.gerente.filiais));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros.' });
  }
});

app.put('/api/minhas-metas/:id', requireGerente, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  const { cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado } = req.body;
  if (!cnpj || !razao_social || !filial || !vendedor || !meta)
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  const gerente = req.session.gerente;
  if (!gerenteTemFilial(gerente, filial))
    return res.status(403).json({ error: 'Filial fora da sua área.' });
  try {
    const existente = await buscarMetaPorId(id);
    if (!existente) return res.status(404).json({ error: 'Registro não encontrado.' });
    if (!gerenteTemFilial(gerente, existente.filial))
      return res.status(403).json({ error: 'Registro fora da sua área.' });
    await atualizarMeta(id, { cnpj, razao_social, filial, vendedor, meta,
      fornecedores: fornecedores || null, percentual_estimado: percentual_estimado || null });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

app.delete('/api/minhas-metas/:id', requireGerente, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  const gerente = req.session.gerente;
  try {
    const existente = await buscarMetaPorId(id);
    if (!existente) return res.status(404).json({ error: 'Registro não encontrado.' });
    if (!gerenteTemFilial(gerente, existente.filial))
      return res.status(403).json({ error: 'Registro fora da sua área.' });
    await excluirMeta(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});
```

- [ ] **Step 5: Proteger e validar `POST /api/formulario`**

Substituir a assinatura e a validação da rota existente `app.post('/api/formulario', async (req, res) => {` pelo bloco abaixo (adiciona `requireGerente` e a checagem de filial por item):

```js
app.post('/api/formulario', requireGerente, async (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0)
    return res.status(400).json({ error: 'Nenhum item para salvar.' });
  const gerente = req.session.gerente;
  for (const item of itens) {
    if (!item.cnpj || !item.razao_social || !item.filial || !item.vendedor || !item.meta)
      return res.status(400).json({ error: 'Um ou mais itens estão com campos obrigatórios faltando.' });
    if (!gerenteTemFilial(gerente, item.filial))
      return res.status(403).json({ error: 'Item com filial fora da sua área.' });
  }
  try {
    for (const item of itens) {
      await inserirFormulario({
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
```

- [ ] **Step 6: Verificar que o servidor carrega sem erro de sintaxe**

Run: `node -e "require('./server')"`
Expected: pode falhar ao **conectar** no banco (se `DATABASE_URL` não estiver setado), mas **não** pode haver `SyntaxError` nem `Cannot find module`. Se aparecer só erro de conexão Postgres, a sintaxe está ok.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat: add gerente login, session, and minhas-metas API with filial ownership checks"
```

---

### Task 6: Tela de login do gerente

**Files:**
- Create: `public/login.html`

- [ ] **Step 1: Criar `public/login.html`**

Espelha `public/admin/login.html`, mudando textos e `action` para `/login`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alavanca AgRoss — Login</title>
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
    <div class="icon">📋</div>
    <h1>Alavanca AgRoss</h1>
    <p>Acesso do gerente</p>
  </div>
  <div class="card-body">
    <div class="erro" id="erro">E-mail ou senha incorretos.</div>
    <form method="POST" action="/login">
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

- [ ] **Step 2: Commit**

```bash
git add public/login.html
git commit -m "feat: add gerente login page"
```

---

### Task 7: Ajustar o formulário (topbar, filial dinâmica, tabela salvos + pendentes)

**Files:**
- Modify: `public/index.html`

Esta task reescreve o `<script>` e adiciona uma topbar e o carregamento das filiais/registros do gerente. Como a lógica muda bastante, o arquivo é substituído por completo. Substituir **todo** o conteúdo de `public/index.html` pelo abaixo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alavanca AgRoss</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #eef0f4;
    height: 100vh;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  /* ── Topbar ── */
  .topbar {
    background: #1a1a2e; height: 52px; padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .topbar-left { display: flex; align-items: center; gap: 10px; }
  .topbar-logo { width: 30px; height: 30px; background: #4f46e5; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .topbar-title { color: #fff; font-size: 14px; font-weight: 700; }
  .topbar-user { color: rgba(255,255,255,0.55); font-size: 12px; }
  .btn-logout {
    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
    padding: 6px 14px; font-size: 12px; cursor: pointer; transition: background 0.15s;
  }
  .btn-logout:hover { background: rgba(255,255,255,0.15); }

  .layout {
    display: flex; gap: 16px; align-items: stretch;
    flex: 1; min-height: 0; padding: 16px;
  }

  /* ── Coluna esquerda: formulário ── */
  .form-col { flex: 0 0 45%; display: flex; flex-direction: column; }
  .card { background: #fff; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.09); overflow: hidden; display: flex; flex-direction: column; flex: 1; }
  .card-header {
    background: #1a1a2e; padding: 22px 26px 18px;
    color: #fff; display: flex; align-items: center; gap: 14px;
  }
  .icon-box {
    width: 40px; height: 40px; background: #4f46e5;
    border-radius: 9px; display: flex; align-items: center;
    justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .card-header h1 { font-size: 17px; font-weight: 700; }
  .card-header p  { font-size: 11px; opacity: 0.6; margin-top: 3px; }
  .card-body { padding: 22px 26px 26px; overflow-y: auto; flex: 1; }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
  .field { margin-bottom: 15px; }
  .field label { display: block; font-size: 11px; font-weight: 600; color: #555; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.3px; }
  .req { color: #4f46e5; }
  input[type="text"], input[type="number"] {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid #e4e7ec; border-radius: 7px;
    font-size: 13px; background: #f9fafb; outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.10); background: #fff; }
  .radio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .radio-item {
    padding: 9px 6px; border: 2px solid #e4e7ec; border-radius: 8px;
    background: #fff; font-size: 12px; font-weight: 500; color: #444;
    cursor: pointer; text-align: center;
    transition: all 0.15s; user-select: none;
  }
  .radio-item:hover { border-color: #4f46e5; color: #4f46e5; background: #f5f3ff; }
  .radio-item.selected { border-color: #4f46e5; background: #4f46e5; color: #fff; }
  .btn-add {
    width: 100%; padding: 10px;
    background: #4f46e5; color: #fff; border: none;
    border-radius: 8px; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: background 0.2s; margin-top: 2px;
  }
  .btn-add:hover { background: #4338ca; }

  /* ── Coluna direita: tabela ── */
  .table-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .table-card { background: #fff; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.09); overflow: hidden; display: flex; flex-direction: column; flex: 1; }
  .table-header {
    background: #1a1a2e; padding: 18px 24px;
    color: #fff; display: flex; align-items: center; justify-content: space-between;
  }
  .table-header h2 { font-size: 15px; font-weight: 700; }
  .badge { background: #4f46e5; color: #fff; border-radius: 20px; padding: 2px 12px; font-size: 12px; font-weight: 700; }
  .table-wrap { overflow: auto; flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: #f4f5f7; }
  thead th { padding: 9px 13px; text-align: left; font-size: 10px; font-weight: 700; color: #777; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e4e7ec; white-space: nowrap; }
  tbody tr { border-bottom: 1px solid #f0f2f5; transition: background 0.15s; }
  tbody tr:hover { background: #fafbff; }
  tbody td { padding: 10px 13px; color: #333; vertical-align: middle; }
  .filial-badge { display: inline-block; background: #ede9fe; color: #4f46e5; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .status-pend { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 20px; padding: 2px 9px; font-size: 10px; font-weight: 700; }
  .status-salvo { display: inline-block; background: #d1fae5; color: #065f46; border-radius: 20px; padding: 2px 9px; font-size: 10px; font-weight: 700; }
  .td-actions { display: flex; gap: 5px; }
  .btn-edit { background: #ede9fe; color: #4f46e5; border: none; border-radius: 5px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .btn-edit:hover { opacity: 0.75; }
  .btn-del  { background: #fee2e2; color: #dc2626; border: none; border-radius: 5px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .btn-del:hover  { opacity: 0.75; }
  .empty-state { padding: 40px; text-align: center; color: #bbb; font-size: 13px; }
  .table-footer { padding: 14px 24px; border-top: 1px solid #f0f2f5; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
  .btn-submit {
    padding: 10px 26px; background: #059669; color: #fff;
    border: none; border-radius: 8px; font-size: 14px; font-weight: 700;
    cursor: pointer; transition: background 0.2s, opacity 0.2s;
  }
  .btn-submit:hover { background: #047857; }
  .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .alert { border-radius: 7px; padding: 10px 14px; font-size: 12px; font-weight: 500; display: none; }
  .alert-success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
  .alert-error   { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <div class="topbar-logo">📋</div>
    <span class="topbar-title">Alavanca AgRoss</span>
    <span class="topbar-user" id="topbar-user"></span>
  </div>
  <form method="POST" action="/logout" style="margin:0">
    <button class="btn-logout" type="submit">Sair</button>
  </form>
</div>

<div class="layout">

  <!-- ── Formulário ── -->
  <div class="form-col">
    <div class="card">
      <div class="card-header">
        <div class="icon-box">📋</div>
        <div>
          <h1>Alavanca AgRoss</h1>
          <p>Preencha e clique em Adicionar</p>
        </div>
      </div>
      <div class="card-body">
        <div class="row-2">
          <div class="field">
            <label>CNPJ <span class="req">*</span></label>
            <input type="text" id="cnpj" placeholder="00.000.000/0000-00" maxlength="18">
          </div>
          <div class="field">
            <label>Razão Social <span class="req">*</span></label>
            <input type="text" id="razao_social" placeholder="Nome da empresa">
          </div>
        </div>

        <div class="field">
          <label>Filial <span class="req">*</span></label>
          <div class="radio-grid" id="filial-grid"></div>
        </div>

        <div class="row-2">
          <div class="field">
            <label>Vendedor <span class="req">*</span></label>
            <input type="text" id="vendedor" placeholder="Nome do vendedor">
          </div>
          <div class="field">
            <label>Meta <span class="req">*</span></label>
            <input type="text" id="meta" placeholder="R$ 0,00">
          </div>
        </div>

        <div class="field">
          <label>Fornecedores que pretende crescer</label>
          <input type="text" id="fornecedores" placeholder="Insira sua resposta">
        </div>

        <div class="field">
          <label>Percentual estimado (%)</label>
          <input type="number" id="percentual_estimado" placeholder="Ex: 15" min="0" max="100">
        </div>

        <button class="btn-add" id="btn-add" onclick="adicionarItem()">+ Adicionar</button>
      </div>
    </div>
  </div>

  <!-- ── Tabela ── -->
  <div class="table-col">
    <div class="table-card">
      <div class="table-header">
        <h2>Metas da filial</h2>
        <span class="badge" id="badge">0</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>CNPJ</th>
              <th>Razão Social</th>
              <th>Filial</th>
              <th>Vendedor</th>
              <th>Meta</th>
              <th>% Est.</th>
              <th>Fornecedores</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div class="empty-state" id="empty-state">Nenhuma meta ainda.</div>
      </div>
      <div class="table-footer">
        <div class="alert alert-success" id="msg-success">✓ Enviado com sucesso!</div>
        <div class="alert alert-error"   id="msg-error"></div>
        <button class="btn-submit" id="btn-submit" disabled onclick="enviarTudo()">Enviar Formulário</button>
      </div>
    </div>
  </div>

</div>
<script>
  // itens = registros salvos (com id) + pendentes (id null).
  let itens = [];
  let filiaisGerente = [];
  let editando = null; // { tipo: 'pendente', idx } ou { tipo: 'salvo', id }

  async function init() {
    try {
      const me = await (await fetch('/api/gerente/me')).json();
      document.getElementById('topbar-user').textContent = me.nome;
      filiaisGerente = me.filiais || [];
      renderFilialGrid();
      await carregarMetas();
    } catch {
      window.location.href = '/login';
    }
  }

  function renderFilialGrid() {
    document.getElementById('filial-grid').innerHTML = filiaisGerente.map(f => `
      <div class="radio-item" data-value="${f}" onclick="selecionarFilial(this)">${f}</div>
    `).join('');
  }

  async function carregarMetas() {
    const salvos = await (await fetch('/api/minhas-metas')).json();
    const pendentes = itens.filter(i => i.status === 'pendente');
    itens = salvos.map(r => ({
      id: r.id, cnpj: r.cnpj, razao_social: r.razao_social, filial: r.filial,
      vendedor: r.vendedor, meta: r.meta, fornecedores: r.fornecedores,
      percentual_estimado: r.percentual_estimado, status: 'salvo'
    })).concat(pendentes);
    renderTabela();
  }

  function adicionarItem() {
    const cnpj                = document.getElementById('cnpj').value.trim();
    const razao_social        = document.getElementById('razao_social').value.trim();
    const filial              = document.querySelector('#filial-grid .radio-item.selected')?.dataset.value || '';
    const vendedor            = document.getElementById('vendedor').value.trim();
    const metaRaw             = document.getElementById('meta').value.replace(/\D/g, '');
    const meta                = metaRaw ? Number(metaRaw) / 100 : null;
    const fornecedores        = document.getElementById('fornecedores').value.trim();
    const percentual_estimado = document.getElementById('percentual_estimado').value
                                  ? Number(document.getElementById('percentual_estimado').value) : null;

    if (!cnpj || !razao_social || !filial || !vendedor || !meta) {
      alert('Preencha todos os campos obrigatórios (CNPJ, Razão Social, Filial, Vendedor e Meta).');
      return;
    }

    const dados = { cnpj, razao_social, filial, vendedor, meta, fornecedores: fornecedores || null, percentual_estimado };

    if (editando && editando.tipo === 'salvo') {
      salvarEdicao(editando.id, dados);
      return;
    }
    if (editando && editando.tipo === 'pendente') {
      itens[editando.idx] = { ...dados, id: null, status: 'pendente' };
      editando = null;
      document.getElementById('btn-add').textContent = '+ Adicionar';
    } else {
      itens.push({ ...dados, id: null, status: 'pendente' });
    }

    limparForm();
    renderTabela();
  }

  async function salvarEdicao(id, dados) {
    const res = await fetch('/api/minhas-metas/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    if (res.ok) {
      editando = null;
      document.getElementById('btn-add').textContent = '+ Adicionar';
      limparForm();
      await carregarMetas();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao salvar alteração.');
    }
  }

  function editarItem(pos) {
    const item = itens[pos];
    document.getElementById('cnpj').value            = item.cnpj;
    document.getElementById('razao_social').value    = item.razao_social;
    document.getElementById('vendedor').value        = item.vendedor;
    document.getElementById('fornecedores').value    = item.fornecedores || '';
    document.getElementById('percentual_estimado').value = item.percentual_estimado ?? '';
    document.querySelectorAll('#filial-grid .radio-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.value === item.filial);
    });
    document.getElementById('meta').value = formatarMoeda(Math.round(item.meta * 100));
    editando = item.status === 'salvo' ? { tipo: 'salvo', id: item.id } : { tipo: 'pendente', idx: pos };
    document.getElementById('btn-add').textContent = '✓ Salvar alteração';
  }

  async function removerItem(pos) {
    const item = itens[pos];
    if (item.status === 'pendente') {
      itens.splice(pos, 1);
      if (editando && editando.tipo === 'pendente' && editando.idx === pos) {
        editando = null;
        document.getElementById('btn-add').textContent = '+ Adicionar';
      }
      renderTabela();
      return;
    }
    if (!confirm('Excluir este registro permanentemente?')) return;
    const res = await fetch('/api/minhas-metas/' + item.id, { method: 'DELETE' });
    if (res.ok) {
      await carregarMetas();
    } else {
      alert('Erro ao excluir.');
    }
  }

  function renderTabela() {
    const tbody = document.getElementById('tbody');
    const empty = document.getElementById('empty-state');
    const btn   = document.getElementById('btn-submit');
    document.getElementById('badge').textContent = itens.length;

    const temPendentes = itens.some(i => i.status === 'pendente');
    btn.disabled = !temPendentes;

    if (itens.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = itens.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.cnpj}</td>
        <td>${it.razao_social}</td>
        <td><span class="filial-badge">${it.filial}</span></td>
        <td>${it.vendedor}</td>
        <td>R$ ${it.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td>${it.percentual_estimado != null ? it.percentual_estimado + '%' : '-'}</td>
        <td>${it.fornecedores || '-'}</td>
        <td>${it.status === 'pendente'
              ? '<span class="status-pend">Pendente</span>'
              : '<span class="status-salvo">Salvo</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn-edit" onclick="editarItem(${i})">Editar</button>
            <button class="btn-del"  onclick="removerItem(${i})">Remover</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function enviarTudo() {
    const btn = document.getElementById('btn-submit');
    const pendentes = itens.filter(i => i.status === 'pendente').map(i => ({
      cnpj: i.cnpj, razao_social: i.razao_social, filial: i.filial,
      vendedor: i.vendedor, meta: i.meta, fornecedores: i.fornecedores,
      percentual_estimado: i.percentual_estimado
    }));
    if (pendentes.length === 0) return;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    hideMessages();

    try {
      const res = await fetch('/api/formulario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: pendentes })
      });
      const data = await res.json();
      if (data.success) {
        itens = itens.filter(i => i.status !== 'pendente');
        await carregarMetas();
        document.getElementById('msg-success').style.display = 'block';
      } else {
        showError(data.error || 'Erro desconhecido.');
      }
    } catch {
      showError('Não foi possível conectar ao servidor.');
    } finally {
      btn.textContent = 'Enviar Formulário';
      renderTabela();
    }
  }

  function selecionarFilial(el) {
    document.querySelectorAll('#filial-grid .radio-item').forEach(r => r.classList.remove('selected'));
    el.classList.add('selected');
  }

  function limparForm() {
    ['cnpj','razao_social','vendedor','meta','fornecedores','percentual_estimado']
      .forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('#filial-grid .radio-item').forEach(r => r.classList.remove('selected'));
  }

  function hideMessages() {
    document.getElementById('msg-success').style.display = 'none';
    document.getElementById('msg-error').style.display   = 'none';
  }
  function showError(msg) {
    const el = document.getElementById('msg-error');
    el.textContent = '✕ ' + msg;
    el.style.display = 'block';
  }
  function formatarMoeda(cents) {
    if (!cents) return '';
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  document.getElementById('meta').addEventListener('input', function(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
    e.target.value = digits ? formatarMoeda(parseInt(digits, 10)) : '';
  });

  document.getElementById('cnpj').addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 14);
    if      (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8)  v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5)  v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2)  v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
    e.target.value = v;
  });

  init();
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: manager form with dynamic filial, topbar, and saved/pending metas table"
```

---

### Task 8: Verificação manual ponta a ponta

**Files:** nenhum (validação).

Pré-requisito: `DATABASE_URL` apontando para um Postgres acessível (o mesmo do Render ou um local). O app usa `pg`, não o `database.db` (SQLite legado que ficou de uma versão antiga).

- [ ] **Step 1: Criar um gerente de teste**

Run: `node scripts/criar-gerente.js "Teste Gerente" teste@agross.com.br senha123 "Lins,Paulínia"`
Expected: `Gerente salvo: teste@agross.com.br — filiais: Lins, Paulínia`

- [ ] **Step 2: Subir o servidor**

Run: `npm start`
Expected: `Servidor rodando na porta 3000`

- [ ] **Step 3: Acesso sem login redireciona**

Abrir `http://localhost:3000/` no navegador.
Expected: redireciona para `/login`.

- [ ] **Step 4: Login e restrição de filial**

Logar com `teste@agross.com.br` / `senha123`.
Expected: cai no formulário; a topbar mostra "Teste Gerente"; o campo Filial mostra apenas "Lins" e "Paulínia".

- [ ] **Step 5: Fluxo pendente → salvo**

Preencher um cadastro, clicar "+ Adicionar" (linha aparece com status "Pendente"), depois "Enviar Formulário".
Expected: a linha passa a "Salvo"; o botão Enviar desabilita (sem pendentes).

- [ ] **Step 6: Editar e excluir salvo**

Editar o registro salvo (muda a Meta), salvar; depois excluir.
Expected: edição reflete na tabela; exclusão remove a linha após confirmação.

- [ ] **Step 7: Admin intacto**

Abrir `http://localhost:3000/admin/login`, logar com as credenciais da Patricia.
Expected: painel admin funciona normalmente e mostra todos os registros de todas as filiais.

- [ ] **Step 8: Rodar os testes unitários**

Run: `npm test`
Expected: PASS — os 4 testes de `auth.test.js`.

---

## Self-Review

**Cobertura da spec:**
- Tabela `gerentes` + bcrypt → Tasks 1, 3, 4.
- Sessão separada + `requireGerente` → Task 5.
- Rotas `/login`, `/logout`, `/`, `/api/gerente/me`, `/api/minhas-metas` (GET/PUT/DELETE), proteção do `POST /api/formulario` → Task 5.
- Validação de posse de filial (403) → Task 5 (helper testado na Task 2).
- `login.html` → Task 6.
- `index.html` (topbar, filial dinâmica, tabela pendente/salvo, editar/excluir) → Task 7.
- Script de criação de contas → Task 4.
- Admin intacto → verificado na Task 8, Step 7.

**Sem placeholders:** todo passo com código tem o código completo. ✔

**Consistência de tipos/nomes:** `gerenteTemFilial`, `req.session.gerente = { id, nome, filiais }`, funções de banco (`buscarGerentePorEmail`, `listarMetasPorFiliais`, `buscarMetaPorId`, `atualizarMeta`, `excluirMeta`) usadas com a mesma assinatura em `server.js`. Rotas `/api/minhas-metas` e `/api/gerente/me` batem entre `server.js` e o `fetch` do `index.html`. ✔

**Desvio consciente da spec:** `bcryptjs` no lugar de `bcrypt` (registrado no cabeçalho Tech Stack).
