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
