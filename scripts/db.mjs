// scripts/db.mjs — runner de SQL para o banco de TESTE (uso de desenvolvimento).
// Le SUPABASE_DB_URL de .env.db.local (gitignored). NUNCA imprime a credencial.
//
// Uso (a partir da raiz do projeto):
//   node scripts/db.mjs --file supabase/migrations/007_lockdown_leitura.sql
//   node scripts/db.mjs --sql "select 1 as ok"
//
// Trava de seguranca: so conecta se a string for do projeto de TESTE
// (pvrnimckfgdmgjrjueap) e NUNCA se apontar para producao (ccpxwnbxvmadcafxnbjs).

import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const TESTE = 'pvrnimckfgdmgjrjueap';
const PROD = 'ccpxwnbxvmadcafxnbjs';

function loadDbUrl() {
  let txt = '';
  try {
    txt = readFileSync('.env.db.local', 'utf8');
  } catch {
    return process.env.SUPABASE_DB_URL || '';
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*SUPABASE_DB_URL\s*=\s*(.*)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return process.env.SUPABASE_DB_URL || '';
}

const url = loadDbUrl();
if (!url || url.includes('COLE_AQUI')) {
  console.error('FALTA credencial: cole a connection string do TESTE em .env.db.local (SUPABASE_DB_URL=...).');
  process.exit(2);
}
if (url.includes(PROD)) {
  console.error('BLOQUEADO: a connection string aponta para PRODUCAO. Proibido. Use so o TESTE.');
  process.exit(3);
}
if (!url.includes(TESTE)) {
  console.error('BLOQUEADO: a connection string NAO e do projeto de TESTE (pvrnimckfgdmgjrjueap). Abortando por seguranca.');
  process.exit(3);
}

const args = process.argv.slice(2);
const asJson = args.includes('--json'); // imprime JSON completo (nao trunca DDL longo)
let sql = '';
const fi = args.indexOf('--file');
const si = args.indexOf('--sql');
if (fi >= 0 && args[fi + 1]) sql = readFileSync(args[fi + 1], 'utf8');
else if (si >= 0 && args[si + 1]) sql = args[si + 1];
else {
  console.error('uso: node scripts/db.mjs --file <arquivo.sql>  |  --sql "<sql>"');
  process.exit(2);
}

// SSL: verifica a cadeia do Supabase com a CA baixada (supabase/prod-ca-2021.crt).
// Verificacao ESTRITA (rejectUnauthorized: true) — NAO afrouxamos TLS.
let ssl = { rejectUnauthorized: true };
try {
  ssl = { ca: readFileSync('supabase/prod-ca-2021.crt', 'utf8'), rejectUnauthorized: true };
} catch {
  console.error('AVISO: supabase/prod-ca-2021.crt nao encontrado. Baixe a CA do Supabase (Settings > Database > SSL Configuration > Download certificate) e salve nessa pasta.');
}
const client = new Client({ connectionString: url, ssl });
try {
  await client.connect();
  const res = await client.query(sql);
  const results = Array.isArray(res) ? res : [res];
  for (const r of results) {
    if (r && r.command) console.log(`-> ${r.command}${r.rowCount != null ? ' (' + r.rowCount + ')' : ''}`);
    if (r && r.rows && r.rows.length) {
      if (asJson) console.log(JSON.stringify(r.rows, null, 2));
      else console.table(r.rows);
    }
  }
  console.log('OK');
} catch (e) {
  console.error('ERRO SQL:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
