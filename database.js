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
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS formularios_cnpj_idx ON formularios (cnpj)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gerentes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      filiais TEXT[] NOT NULL
    )
  `);
}

async function inserirFormulario(dados) {
  await pool.query(
    `INSERT INTO formularios
       (cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (cnpj) DO UPDATE SET
       razao_social        = EXCLUDED.razao_social,
       filial              = EXCLUDED.filial,
       vendedor            = EXCLUDED.vendedor,
       meta                = EXCLUDED.meta,
       fornecedores        = EXCLUDED.fornecedores,
       percentual_estimado = EXCLUDED.percentual_estimado,
       criado_em           = NOW()`,
    [dados.cnpj, dados.razao_social, dados.filial, dados.vendedor,
     dados.meta, dados.fornecedores || null, dados.percentual_estimado || null]
  );
}

async function listarFormularios() {
  const { rows } = await pool.query(`
    SELECT id, cnpj, razao_social, filial, vendedor,
           meta::float, fornecedores, percentual_estimado::float,
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

module.exports = {
  pool, init, inserirFormulario, listarFormularios,
  buscarGerentePorEmail, listarMetasPorFiliais, buscarMetaPorId,
  atualizarMeta, excluirMeta
};
