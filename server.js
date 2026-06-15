const express = require('express');
const path = require('path');
const session = require('express-session');
const XLSX = require('xlsx');
const { init, inserirFormulario, listarFormularios } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = 'patricia.viana@agross.com.br';
const ADMIN_SENHA = 'pati@agross';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'agross-dev-secret',
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
app.get('/api/admin/formularios', requireAdmin, async (req, res) => {
  try {
    res.json(await listarFormularios());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar registros.' });
  }
});

app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const dados = await listarFormularios();
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar exportação.' });
  }
});

// ── Formulário público ──
app.post('/api/formulario', async (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0)
    return res.status(400).json({ error: 'Nenhum item para salvar.' });
  for (const item of itens) {
    if (!item.cnpj || !item.razao_social || !item.filial || !item.vendedor || !item.meta)
      return res.status(400).json({ error: 'Um ou mais itens estão com campos obrigatórios faltando.' });
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

// ── Inicializar banco e subir servidor ──
init()
  .then(() => app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)))
  .catch(err => { console.error('Falha ao inicializar banco:', err); process.exit(1); });
