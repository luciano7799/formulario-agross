# Cadastro em Grupo (múltiplos CNPJs) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o gerente cadastre várias empresas (CNPJs) de um mesmo grupo econômico numa só operação, compartilhando Filial/Vendedor/Meta/Fornecedores/Percentual, sem alterar banco ou API.

**Architecture:** Mudança 100% client-side em `public/index.html`. Um toggle "Individual"/"Grupo" alterna quais campos aparecem. No modo Grupo, uma lista dinâmica de linhas (CNPJ + Razão Social) gera múltiplos itens `pendente` de uma vez, reaproveitando o array `itens` e a rota `POST /api/formulario` (que já aceita lote) exatamente como já funcionam hoje.

**Tech Stack:** HTML/CSS/JS puro (sem framework), mesmo padrão do restante do arquivo.

---

## File Structure

- **`public/index.html`** (modificar) — único arquivo tocado:
  - CSS: novas classes `.toggle-grid`, `.grupo-row`, `.btn-remove-row`, `.btn-add-cnpj`.
  - HTML: novo toggle "Tipo de cadastro"; campos de CNPJ/Razão Social individuais envolvidos num container `#individual-fields`; novo container `#grupo-fields` com linhas dinâmicas.
  - JS: estado `modoGrupo`/`grupoRows`; funções `selecionarModo`, `renderGrupoRows`, `adicionarLinhaGrupo`, `removerLinhaGrupo`, `formatarCNPJ` (extraída do listener existente); `adicionarItem` passa a ramificar por modo; `limparForm` e `editarItem` ajustados.

---

### Task 1: Toggle "Individual/Grupo" e estrutura das linhas dinâmicas (HTML + CSS)

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Adicionar CSS das novas classes**

Localizar o bloco de CSS `.btn-add:hover { background: #4338ca; }` (linha 78) e adicionar imediatamente depois:

```css
  .toggle-grid { grid-template-columns: repeat(2, 1fr); }
  .grupo-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .grupo-row input { flex: 1; }
  .btn-remove-row {
    background: #fee2e2; color: #dc2626; border: none; border-radius: 6px;
    width: 30px; height: 30px; flex-shrink: 0; cursor: pointer; font-size: 15px;
  }
  .btn-remove-row:hover { opacity: 0.75; }
  .btn-add-cnpj {
    width: 100%; padding: 8px; background: #ede9fe; color: #4f46e5;
    border: none; border-radius: 7px; font-size: 12px; font-weight: 600;
    cursor: pointer; margin-bottom: 15px;
  }
  .btn-add-cnpj:hover { background: #e0d9fc; }
```

- [ ] **Step 2: Substituir o bloco de CNPJ/Razão Social pelo toggle + dois containers**

Substituir:

```html
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
```

Por:

```html
        <div class="field">
          <label>Tipo de cadastro <span class="req">*</span></label>
          <div class="radio-grid toggle-grid" id="modo-grid">
            <div class="radio-item selected" data-value="individual" onclick="selecionarModo(this)">Individual</div>
            <div class="radio-item" data-value="grupo" onclick="selecionarModo(this)">Grupo (vários CNPJs)</div>
          </div>
        </div>

        <div class="row-2" id="individual-fields">
          <div class="field">
            <label>CNPJ <span class="req">*</span></label>
            <input type="text" id="cnpj" placeholder="00.000.000/0000-00" maxlength="18">
          </div>
          <div class="field">
            <label>Razão Social <span class="req">*</span></label>
            <input type="text" id="razao_social" placeholder="Nome da empresa">
          </div>
        </div>

        <div id="grupo-fields" style="display:none;">
          <div id="grupo-rows"></div>
          <button type="button" class="btn-add-cnpj" onclick="adicionarLinhaGrupo()">+ Adicionar CNPJ</button>
        </div>
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add group/individual toggle markup for multi-CNPJ registration"
```

---

### Task 2: Lógica do toggle e das linhas dinâmicas de CNPJ (JS)

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Extrair a máscara de CNPJ para uma função reutilizável**

Substituir o listener existente:

```js
  document.getElementById('cnpj').addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 14);
    if      (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8)  v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5)  v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2)  v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
    e.target.value = v;
  });
```

Por:

```js
  function formatarCNPJ(value) {
    let v = value.replace(/\D/g, '').slice(0, 14);
    if      (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8)  v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5)  v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2)  v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
    return v;
  }

  document.getElementById('cnpj').addEventListener('input', function(e) {
    e.target.value = formatarCNPJ(e.target.value);
  });
```

- [ ] **Step 2: Rodar no navegador e confirmar que a máscara do CNPJ individual continua funcionando**

Abra o formulário, digite `11222333000181` no campo CNPJ (modo Individual, padrão).
Esperado: aparece formatado como `11.222.333/0001-81`.

- [ ] **Step 3: Adicionar estado e funções do modo Grupo**

Adicionar, logo após a linha `let editando = null; // { tipo: 'pendente', idx } ou { tipo: 'salvo', id }`:

```js
  let modoGrupo = false;
  let grupoRows = [{ cnpj: '', razao_social: '' }];

  function selecionarModo(el) {
    document.querySelectorAll('#modo-grid .radio-item').forEach(r => r.classList.remove('selected'));
    el.classList.add('selected');
    modoGrupo = el.dataset.value === 'grupo';
    document.getElementById('individual-fields').style.display = modoGrupo ? 'none' : 'grid';
    document.getElementById('grupo-fields').style.display = modoGrupo ? 'block' : 'none';
    if (modoGrupo) {
      grupoRows = [{ cnpj: '', razao_social: '' }];
      renderGrupoRows();
    }
  }

  function renderGrupoRows() {
    document.getElementById('grupo-rows').innerHTML = grupoRows.map((row, i) => `
      <div class="grupo-row">
        <input type="text" class="grupo-cnpj" placeholder="CNPJ" maxlength="18" data-idx="${i}" value="${row.cnpj}">
        <input type="text" class="grupo-razao" placeholder="Razão Social" data-idx="${i}" value="${row.razao_social}">
        ${grupoRows.length > 1 ? `<button type="button" class="btn-remove-row" onclick="removerLinhaGrupo(${i})">×</button>` : ''}
      </div>
    `).join('');

    document.querySelectorAll('.grupo-cnpj').forEach(el => {
      el.addEventListener('input', function(e) {
        const v = formatarCNPJ(e.target.value);
        e.target.value = v;
        grupoRows[Number(e.target.dataset.idx)].cnpj = v;
      });
    });
    document.querySelectorAll('.grupo-razao').forEach(el => {
      el.addEventListener('input', function(e) {
        grupoRows[Number(e.target.dataset.idx)].razao_social = e.target.value;
      });
    });
  }

  function adicionarLinhaGrupo() {
    grupoRows.push({ cnpj: '', razao_social: '' });
    renderGrupoRows();
  }

  function removerLinhaGrupo(idx) {
    if (grupoRows.length <= 1) return;
    grupoRows.splice(idx, 1);
    renderGrupoRows();
  }
```

- [ ] **Step 4: Testar a troca de modo e as linhas dinâmicas no navegador**

Clique em "Grupo (vários CNPJs)". Esperado: os campos CNPJ/Razão Social únicos somem, aparece 1 linha com dois campos (CNPJ, Razão Social) e o botão "+ Adicionar CNPJ".
Clique "+ Adicionar CNPJ" duas vezes. Esperado: aparecem 3 linhas, cada uma (exceto a primeira) com um botão "×" que remove só aquela linha.
Digite um CNPJ numa linha. Esperado: fica formatado (`00.000.000/0000-00`) igual ao campo individual.
Clique "Individual". Esperado: volta a mostrar os campos únicos de CNPJ/Razão Social.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: add group mode toggle and dynamic CNPJ rows logic"
```

---

### Task 3: Gerar múltiplos itens pendentes no modo Grupo

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Reescrever `adicionarItem` para ramificar por modo**

Substituir a função `adicionarItem` inteira:

```js
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

    if (!filial || !vendedor || !meta) {
      alert('Preencha todos os campos obrigatórios (Filial, Vendedor e Meta).');
      return;
    }

    const compartilhado = { filial, vendedor, meta, fornecedores: fornecedores || null, percentual_estimado };

    if (modoGrupo) {
      const validas   = grupoRows.filter(r => r.cnpj.trim() && r.razao_social.trim());
      const invalidas = grupoRows.filter(r => (r.cnpj.trim() && !r.razao_social.trim()) || (!r.cnpj.trim() && r.razao_social.trim()));

      if (invalidas.length > 0) {
        alert('Cada linha do grupo precisa ter CNPJ e Razão Social preenchidos.');
        return;
      }
      if (validas.length === 0) {
        alert('Preencha ao menos um CNPJ e Razão Social do grupo.');
        return;
      }

      validas.forEach(r => {
        itens.push({ ...compartilhado, cnpj: r.cnpj.trim(), razao_social: r.razao_social.trim(), id: null, status: 'pendente' });
      });

      limparForm();
      renderTabela();
      return;
    }

    if (!cnpj || !razao_social) {
      alert('Preencha todos os campos obrigatórios (CNPJ, Razão Social, Filial, Vendedor e Meta).');
      return;
    }

    const dados = { ...compartilhado, cnpj, razao_social };

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
```

- [ ] **Step 2: Atualizar `limparForm` para resetar as linhas de grupo**

Substituir:

```js
  function limparForm() {
    ['cnpj','razao_social','vendedor','meta','fornecedores','percentual_estimado']
      .forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('#filial-grid .radio-item').forEach(r => r.classList.remove('selected'));
  }
```

Por:

```js
  function limparForm() {
    ['cnpj','razao_social','vendedor','meta','fornecedores','percentual_estimado']
      .forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('#filial-grid .radio-item').forEach(r => r.classList.remove('selected'));
    if (modoGrupo) {
      grupoRows = [{ cnpj: '', razao_social: '' }];
      renderGrupoRows();
    }
  }
```

- [ ] **Step 3: Forçar modo Individual ao editar um item existente**

Substituir a primeira linha da função `editarItem`:

```js
  function editarItem(pos) {
    const item = itens[pos];
```

Por:

```js
  function editarItem(pos) {
    if (modoGrupo) {
      document.querySelector('#modo-grid .radio-item[data-value="individual"]').click();
    }
    const item = itens[pos];
```

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: generate one pending item per CNPJ row when adding a group"
```

---

### Task 4: Verificação manual no navegador

**Files:** nenhum (validação).

- [ ] **Step 1: Subir o servidor local**

Use o preview server já configurado (`formulario`, porta 3050) ou `npm start` com `DATABASE_URL` de teste.

- [ ] **Step 2: Modo Individual continua igual**

Logue como qualquer gerente (ex: claudio@agross.com.br / claudio). Sem tocar no toggle, cadastre um item como sempre.
Esperado: comportamento idêntico ao de antes desta feature — 1 item pendente criado.

- [ ] **Step 3: Cadastro em grupo com 3 CNPJs**

Clique em "Grupo (vários CNPJs)". Adicione 2 linhas extras (total 3). Preencha CNPJ + Razão Social nas 3 linhas com valores diferentes. Preencha Filial, Vendedor e Meta (únicos). Clique "+ Adicionar".
Esperado: 3 itens pendentes aparecem na tabela "Metas da filial", cada um com o CNPJ/Razão Social da sua linha e a mesma Filial/Vendedor/Meta.

- [ ] **Step 4: Validação de linha incompleta**

Em modo Grupo, preencha o CNPJ de uma linha mas deixe a Razão Social vazia. Clique "+ Adicionar".
Esperado: alerta "Cada linha do grupo precisa ter CNPJ e Razão Social preenchidos." — nenhum item é criado.

- [ ] **Step 5: Enviar o lote misto**

Clique "Enviar Formulário" com os itens pendentes da Task 3 (Step 3) na tabela.
Esperado: `POST /api/formulario` (visível em `preview_network`) recebe os 3 itens de uma vez, retorna sucesso, e os 3 passam de "Pendente" para "Salvo".

- [ ] **Step 6: Editar reverte pro modo Individual**

Com o toggle em "Grupo", clique em "Editar" num item qualquer da tabela (salvo ou pendente).
Esperado: o toggle volta automaticamente para "Individual", os campos únicos de CNPJ/Razão Social aparecem preenchidos com os dados do item.
