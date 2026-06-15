const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? true : false
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
}

async function inserirFormulario(dados) {
  await pool.query(
    `INSERT INTO formularios
       (cnpj, razao_social, filial, vendedor, meta, fornecedores, percentual_estimado)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
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

module.exports = { pool, init, inserirFormulario, listarFormularios };
