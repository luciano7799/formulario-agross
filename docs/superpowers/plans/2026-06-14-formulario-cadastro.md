# Formulário de Cadastro de Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicação web local com formulário de cadastro de clientes (Node.js + Express + SQLite), com visual moderno em card centralizado, salvando dados no banco e exibindo mensagem de sucesso após envio.

**Architecture:** Express serve o `public/index.html` como página estática e expõe `POST /api/formulario` para receber dados. `database.js` encapsula toda interação com SQLite (criação de tabela + insert). O frontend envia dados via `fetch()` e exibe feedback visual sem recarregar a página.

**Tech Stack:** Node.js 24, Express 4, better-sqlite3, HTML/CSS/JS puro

---

### Task 1: Inicializar projeto e instalar dependências

**Files:**
- Create: `C:\Users\lucia\formulario\package.json`

- [ ] **Step 1: Criar package.json**

Execute no terminal (dentro de `C:\Users\lucia\formulario`):
```bash
cd C:/Users/lucia/formulario
npm init -y
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install express better-sqlite3
```

- [ ] **Step 3: Verificar instalação**

```bash
node -e "require('express'); require('better-sqlite3'); console.log('OK')"
```
Resultado esperado: `OK`

- [ ] **Step 4: Commit**

```bash
git init
git add package.json package-lock.json
git commit -m "chore: init projeto formulario"
```

---

### Task 2: Criar camada de banco de dados

**Files:**
- Create: `C:\Users\lucia\formulario\database.js`

- [ ] **Step 1: Criar `database.js`**

```js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS formularios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    filial TEXT NOT NULL,
    vendedor TEXT NOT NULL,
    meta REAL NOT NULL,
    fornecedores TEXT,
    percentual_estimado REAL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function inserirFormulario(dados) {
  const stmt = db.prepare(`
    INSERT INTO formularios
      (cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado)
    VALUES
      (@cnpj, @razao_social, @filial, @vendedor, @meta, @fornecedores, @percentual_estimado)
  `);
  return stmt.run(dados);
}

module.exports = { inserirFormulario };
```

- [ ] **Step 2: Verificar criação da tabela**

```bash
node -e "require('./database'); console.log('Banco OK')"
```
Resultado esperado: `Banco OK` e arquivo `database.db` criado na pasta.

- [ ] **Step 3: Commit**

```bash
git add database.js
git commit -m "feat: configurar SQLite e tabela formularios"
```

---

### Task 3: Criar servidor Express com rota da API

**Files:**
- Create: `C:\Users\lucia\formulario\server.js`

- [ ] **Step 1: Criar `server.js`**

```js
const express = require('express');
const path = require('path');
const { inserirFormulario } = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/formulario', (req, res) => {
  const { cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado } = req.body;

  if (!cnpj || !razao_social || !filial || !vendedor || !meta) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    inserirFormulario({ cnpj, razao_social, filial, vendedor, meta, fornecedores: fornecedores || null, percentual_estimado: percentual_estimado || null });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar os dados. Tente novamente.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Testar que o servidor sobe**

```bash
node server.js
```
Resultado esperado no terminal: `Servidor rodando em http://localhost:3000`

- [ ] **Step 3: Testar a rota POST (em outro terminal)**

```bash
curl -s -X POST http://localhost:3000/api/formulario \
  -H "Content-Type: application/json" \
  -d "{\"cnpj\":\"12.345.678/0001-90\",\"razao_social\":\"Empresa Teste\",\"filial\":\"Paulinia\",\"vendedor\":\"João\",\"meta\":50000}"
```
Resultado esperado: `{"success":true}`

- [ ] **Step 4: Testar validação de campos obrigatórios**

```bash
curl -s -X POST http://localhost:3000/api/formulario \
  -H "Content-Type: application/json" \
  -d "{\"cnpj\":\"12.345.678/0001-90\"}"
```
Resultado esperado: `{"error":"Preencha todos os campos obrigatórios."}`

- [ ] **Step 5: Parar servidor (Ctrl+C) e commitar**

```bash
git add server.js
git commit -m "feat: servidor Express com rota POST /api/formulario"
```

---

### Task 4: Criar o formulário HTML com visual e interatividade

**Files:**
- Create: `C:\Users\lucia\formulario\public\index.html`

- [ ] **Step 1: Criar pasta public e arquivo index.html**

```bash
mkdir -p C:/Users/lucia/formulario/public
```

- [ ] **Step 2: Criar `public/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cadastro de Cliente</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #eef0f4;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
  }
  .card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    width: 100%;
    max-width: 540px;
    overflow: hidden;
  }
  .card-header {
    background: #1a1a2e;
    padding: 28px 36px 24px;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .icon-box {
    width: 46px; height: 46px;
    background: #4f46e5;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .card-header h1 { font-size: 20px; font-weight: 700; }
  .card-header p { font-size: 13px; opacity: 0.6; margin-top: 3px; }
  .card-body { padding: 28px 36px 36px; }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 20px; }
  .field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #444;
    margin-bottom: 6px;
  }
  .req { color: #4f46e5; }
  input[type="text"], input[type="number"] {
    width: 100%;
    padding: 10px 13px;
    border: 1.5px solid #e4e7ec;
    border-radius: 8px;
    font-size: 14px;
    background: #f9fafb;
    outline: none;
    transition: border 0.2s, box-shadow 0.2s;
  }
  input[type="text"]:focus, input[type="number"]:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.10);
    background: #fff;
  }
  .radio-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #444;
    padding: 9px 12px;
    border-radius: 8px;
    cursor: pointer;
    background: #f9fafb;
    border: 1.5px solid #e4e7ec;
    transition: border 0.15s, background 0.15s;
    user-select: none;
  }
  .radio-item:hover { border-color: #4f46e5; background: #f0f0ff; }
  .radio-item input { accent-color: #4f46e5; width: 15px; height: 15px; cursor: pointer; }
  .btn {
    width: 100%;
    padding: 12px;
    background: #4f46e5;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 8px;
    transition: background 0.2s, opacity 0.2s;
  }
  .btn:hover { background: #4338ca; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .alert {
    display: none;
    margin-top: 16px;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 500;
  }
  .alert-success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
  .alert-error   { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="icon-box">📋</div>
    <div>
      <h1>Cadastro de Cliente</h1>
      <p>Preencha todos os campos obrigatórios</p>
    </div>
  </div>
  <div class="card-body">
    <form id="form">
      <div class="row-2">
        <div class="field">
          <label>CNPJ <span class="req">*</span></label>
          <input type="text" id="cnpj" placeholder="00.000.000/0000-00" maxlength="18">
        </div>
        <div class="field">
          <label>Meta <span class="req">*</span></label>
          <input type="number" id="meta" placeholder="Ex: 100000" min="0">
        </div>
      </div>

      <div class="field">
        <label>Razão Social <span class="req">*</span></label>
        <input type="text" id="razao_social" placeholder="Nome da empresa">
      </div>

      <div class="field">
        <label>Filial <span class="req">*</span></label>
        <div class="radio-grid">
          <label class="radio-item"><input type="radio" name="filial" value="Paulínia"> Paulínia</label>
          <label class="radio-item"><input type="radio" name="filial" value="Pouso Alegre"> Pouso Alegre</label>
          <label class="radio-item"><input type="radio" name="filial" value="Anápolis"> Anápolis</label>
          <label class="radio-item"><input type="radio" name="filial" value="Sete Lagoas"> Sete Lagoas</label>
          <label class="radio-item"><input type="radio" name="filial" value="Lins"> Lins</label>
          <label class="radio-item"><input type="radio" name="filial" value="Petrolina"> Petrolina</label>
          <label class="radio-item"><input type="radio" name="filial" value="Cariacia"> Cariacia</label>
          <label class="radio-item"><input type="radio" name="filial" value="Carazinho"> Carazinho</label>
        </div>
      </div>

      <div class="field">
        <label>Vendedor <span class="req">*</span></label>
        <input type="text" id="vendedor" placeholder="Nome do vendedor">
      </div>

      <div class="field">
        <label>Fornecedores que pretende crescer com o cliente</label>
        <input type="text" id="fornecedores" placeholder="Insira sua resposta">
      </div>

      <div class="field">
        <label>Percentual estimado (%)</label>
        <input type="number" id="percentual_estimado" placeholder="Ex: 15" min="0" max="100">
      </div>

      <button type="submit" class="btn" id="btn-submit">Enviar Formulário</button>
      <div class="alert alert-success" id="msg-success">✓ Formulário enviado com sucesso! Os campos foram limpos para um novo preenchimento.</div>
      <div class="alert alert-error"   id="msg-error"></div>
    </form>
  </div>
</div>

<script>
  document.getElementById('form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const cnpj          = document.getElementById('cnpj').value.trim();
    const razao_social  = document.getElementById('razao_social').value.trim();
    const filial        = document.querySelector('input[name="filial"]:checked')?.value || '';
    const vendedor      = document.getElementById('vendedor').value.trim();
    const meta          = document.getElementById('meta').value;
    const fornecedores  = document.getElementById('fornecedores').value.trim();
    const percentual_estimado = document.getElementById('percentual_estimado').value;

    hideMessages();

    if (!cnpj || !razao_social || !filial || !vendedor || !meta) {
      showError('Preencha todos os campos obrigatórios antes de enviar.');
      return;
    }

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await fetch('/api/formulario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj, razao_social, filial, vendedor, meta: Number(meta), fornecedores, percentual_estimado: percentual_estimado ? Number(percentual_estimado) : null })
      });

      const data = await res.json();

      if (data.success) {
        document.getElementById('form').reset();
        showSuccess();
      } else {
        showError(data.error || 'Erro desconhecido.');
      }
    } catch {
      showError('Não foi possível conectar ao servidor.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar Formulário';
    }
  });

  function hideMessages() {
    document.getElementById('msg-success').style.display = 'none';
    document.getElementById('msg-error').style.display   = 'none';
  }
  function showSuccess() {
    document.getElementById('msg-success').style.display = 'block';
  }
  function showError(msg) {
    const el = document.getElementById('msg-error');
    el.textContent = '✕ ' + msg;
    el.style.display = 'block';
  }
</script>
</body>
</html>
```

- [ ] **Step 3: Iniciar o servidor e verificar visualmente**

```bash
node server.js
```
Abrir `http://localhost:3000` no navegador. Deve exibir o card com header escuro e o formulário completo.

- [ ] **Step 4: Testar fluxo completo**

1. Preencher todos os campos obrigatórios
2. Clicar "Enviar Formulário"
3. Esperado: mensagem verde aparece, campos são limpos

4. Tentar enviar sem preencher campos obrigatórios
5. Esperado: mensagem vermelha de erro aparece

- [ ] **Step 5: Confirmar dados salvos no banco**

Em outro terminal:
```bash
node -e "
  const db = require('better-sqlite3')('./database.db');
  const rows = db.prepare('SELECT * FROM formularios').all();
  console.log(JSON.stringify(rows, null, 2));
"
```
Resultado esperado: array com o registro enviado no passo anterior.

- [ ] **Step 6: Commit final**

```bash
git add public/index.html
git commit -m "feat: formulario HTML com visual e envio via fetch"
```
