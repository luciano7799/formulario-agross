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

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = 'patricia.viana@agross.com.br';
const ADMIN_SENHA = 'pati@agross';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new pgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'agross-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

function requireGerente(req, res, next) {
  if (req.session && req.session.gerente) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado.' });
  res.redirect('/login');
}

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

app.use(express.static(path.join(__dirname, 'public')));

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

// ── Excluir registro ──
app.delete('/api/admin/formularios/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM formularios WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});

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

// ── Formulário protegido ──
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

// ── Inicializar banco e subir servidor ──
init()
  .then(() => app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)))
  .catch(err => { console.error('Falha ao inicializar banco:', err); process.exit(1); });
