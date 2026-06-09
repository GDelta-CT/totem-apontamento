/**
 * Cliente mínimo da Google Sheets API via Service Account (JWT) — SEM dependências
 * externas (usa `node:crypto` + `fetch`). Roda SÓ no servidor (runtime nodejs).
 *
 * Reaproveita a técnica já validada no projeto gdelta-local (assina um JWT RS256
 * com a chave da SA → troca por access_token → chama a API). Mantido pequeno e
 * trocável: é "escreve matriz na aba", nada de SDK pesado.
 */
import 'server-only';
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

type Cell = string | number | null;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Troca a chave da SA por um access_token de curta duração. */
export async function getSheetsToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signingInput = `${header}.${claim}`;
  // A chave costuma vir do .env com \n escapado — desescapa antes de assinar.
  const pem = privateKey.replace(/\\n/g, '\n');
  const signature = b64url(createSign('RSA-SHA256').update(signingInput).sign(pem));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token Google falhou: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token Google sem access_token');
  return json.access_token;
}

async function ensureTab(sheetId: string, tab: string, token: string): Promise<void> {
  const metaRes = await fetch(`${SHEETS}/${sheetId}?fields=sheets.properties(title)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Ler abas falhou: ${metaRes.status} ${await metaRes.text()}`);
  const meta = (await metaRes.json()) as { sheets?: { properties: { title: string } }[] };
  if ((meta.sheets ?? []).some((s) => s.properties.title === tab)) return;
  const res = await fetch(`${SHEETS}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  if (!res.ok) throw new Error(`Criar aba falhou: ${res.status} ${await res.text()}`);
}

/**
 * Espelho IDEMPOTENTE: garante a aba, escreve a matriz a partir de A1 e limpa
 * as linhas que sobraram de um sync maior anterior. Reflete inserts/updates/deletes.
 */
export async function mirrorToTab(
  sheetId: string,
  tab: string,
  matrix: Cell[][],
  token: string
): Promise<void> {
  await ensureTab(sheetId, tab, token);
  const enc = encodeURIComponent(tab);
  const put = await fetch(`${SHEETS}/${sheetId}/values/${enc}!A1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: `${tab}!A1`, majorDimension: 'ROWS', values: matrix }),
  });
  if (!put.ok) throw new Error(`Escrever planilha falhou: ${put.status} ${await put.text()}`);

  const firstEmpty = matrix.length + 1;
  const clr = await fetch(`${SHEETS}/${sheetId}/values/${enc}!A${firstEmpty}:Z2000:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!clr.ok) throw new Error(`Limpar sobras falhou: ${clr.status} ${await clr.text()}`);
}
