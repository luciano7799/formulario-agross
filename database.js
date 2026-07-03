const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS formularios (
      id SERIAL PRIMARY KEY,
      cnpj TEXT NOT NULL,
      razao_social TEXT NOT NULL,
      filial TEXT NOT NULL,
      vendedor TEXT NOT NULL,
      meta NUMERIC NOT NULL,
      fornecedores TEXT,
      percentual_estimado NUMERIC,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Limpeza antes do índice único: remove linhas de teste e deduplica por CNPJ,
  // mantendo sempre o registro mais recente (maior id). Idempotente.
  await pool.query(`DELETE FROM formularios WHERE cnpj = '00.000.000/0001-TEST'`);
  await pool.query(`
    DELETE FROM formularios a
    USING formularios b
    WHERE a.cnpj = b.cnpj AND a.id < b.id
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS formularios_cnpj_idx ON formularios (cnpj)
  `);
  await pool.query(`ALTER TABLE formularios ADD COLUMN IF NOT EXISTS grupo TEXT`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gerentes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      filiais TEXT[] NOT NULL
    )
  `);
  await seedGerentes();
}

async function seedGerentes() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM gerentes');
  if (parseInt(rows[0].count, 10) > 0) return;
  const dados = [
    { nome: 'Claudio Tafner',  email: 'claudio.tafner@agross.com.br',  hash: '$2b$10$WjpnE3ouPfw5m9ywcVuv9./65EA2ushc4dotmKEpAcABZhisGr6w.', filiais: ['Paulínia'] },
    { nome: 'Vlademir Marino', email: 'vlademir.marino@agross.com.br', hash: '$2b$10$oGQXQrab2etUe7RN5psg8.dKz0tQuMYJRj1.pSNMfqB0y2mUx7nIq', filiais: ['Pouso Alegre','Sete Lagoas'] },
    { nome: 'Tulio Guirelli',  email: 'tulio.guirelli@agross.com.br',  hash: '$2b$10$6l9w33mXTo7rzHe8heqfD.NGOucZ5MuB77oYMjCunZrt2Gdq76ZJq',  filiais: ['Anápolis'] },
    { nome: 'Lucas Policarpo', email: 'lucas.policarpo@agross.com.br', hash: '$2b$10$t3q3MmyQqxHfz80lklC7A.v7xoYAQayN.v7aQ81LJ.IQRNZTekCUa', filiais: ['Lins'] },
    { nome: 'Fabio Pires',     email: 'fabio.pires@agross.com.br',     hash: '$2b$10$B5v3aA9Jmx5WTQamIR4VpuXaos9AVjCiCLFRFrFMOzYBVtz45UdvC', filiais: ['Petrolina'] },
    { nome: 'Marco Mendonca',  email: 'marco.mendonca@agross.com.br',  hash: '$2b$10$u0D8HQfkpWF4QxzEydlnTOc/kvlw8u3Uiph/1xmP/i.phsr.zx0Ra', filiais: ['Cariacica'] },
    { nome: 'Diego Schons',    email: 'diego.schons@agross.com.br',    hash: '$2b$10$IrGFsKBt0GZGzEM25U32kOIm337qGOY5hMT1tUZ..FeyA.KjU9zK.', filiais: ['Carazinho'] },
  ];
  for (const g of dados) {
    await pool.query(
      `INSERT INTO gerentes (nome, email, senha_hash, filiais)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      [g.nome, g.email, g.hash, g.filiais]
    );
  }
}

async function inserirFormulario(dados) {
  await pool.query(
    `INSERT INTO formularios
       (cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado, grupo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (cnpj) DO UPDATE SET
       razao_social        = EXCLUDED.razao_social,
       filial              = EXCLUDED.filial,
       vendedor            = EXCLUDED.vendedor,
       meta                = EXCLUDED.meta,
       fornecedores        = EXCLUDED.fornecedores,
       percentual_estimado = EXCLUDED.percentual_estimado,
       grupo               = EXCLUDED.grupo,
       criado_em           = NOW()`,
    [dados.cnpj, dados.razao_social, dados.filial, dados.vendedor,
     dados.meta, dados.fornecedores || null, dados.percentual_estimado || null,
     dados.grupo || null]
  );
}

async function listarFormularios() {
  const { rows } = await pool.query(`
    SELECT id, cnpj, razao_social, filial, vendedor,
           meta::float, fornecedores, percentual_estimado::float, grupo,
           TO_CHAR(criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS criado_em
    FROM formularios
    ORDER BY id DESC
  `);
  return rows;
}

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
           meta::float, fornecedores, percentual_estimado::float, grupo,
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
            fornecedores, percentual_estimado::float, grupo
     FROM formularios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function atualizarMeta(id, dados) {
  await pool.query(
    `UPDATE formularios SET
       cnpj = $1, razao_social = $2, filial = $3, vendedor = $4, meta = $5,
       fornecedores = $6, percentual_estimado = $7, grupo = $8,
       criado_em = NOW()
     WHERE id = $9`,
    [dados.cnpj, dados.razao_social, dados.filial, dados.vendedor, dados.meta,
     dados.fornecedores || null, dados.percentual_estimado || null,
     dados.grupo || null, id]
  );
}

// Propaga a meta para todos os CNPJs de um grupo, dentro das filiais do gerente.
// A meta é um alvo único do grupo, então editar um CNPJ atualiza o grupo inteiro.
async function propagarMetaDoGrupo(grupo, meta, filiais) {
  await pool.query(
    `UPDATE formularios SET meta = $1 WHERE grupo = $2 AND filial = ANY($3)`,
    [meta, grupo, filiais]
  );
}

async function excluirMeta(id) {
  const { rowCount } = await pool.query(`DELETE FROM formularios WHERE id = $1`, [id]);
  return rowCount;
}

module.exports = {
  pool, init, inserirFormulario, listarFormularios,
  buscarGerentePorEmail, listarMetasPorFiliais, buscarMetaPorId,
  atualizarMeta, propagarMetaDoGrupo, excluirMeta
};
