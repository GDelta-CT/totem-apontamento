/**
 * POST /api/sync/patio — espelha o pátio (OS ativas) da oficina na planilha Google.
 *
 * Segurança:
 *  - Protegido por segredo no header `x-sync-secret` (= env SYNC_SECRET).
 *  - Usa service role (ignora RLS) MAS filtra explicitamente por `oficina_id`
 *    (env SYNC_OFICINA_ID) — uma oficina por chamada, sem vazamento.
 *  - Escreve numa aba DEDICADA (env SYNC_TAB, default "Totem · Pátio"), sem tocar
 *    nas abas/fórmulas do dashboard do dono. Idempotente (regrava + limpa sobras).
 *
 * Dispare por cron na VPS:
 *   curl -fsS -X POST -H "x-sync-secret: $SYNC_SECRET" https://SEU_DOMINIO/api/sync/patio
 */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getSheetsToken, mirrorToTab } from '@/lib/sheets/google-sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADER = [
  'OS',
  'Placa',
  'Modelo',
  'Etapa',
  'Status',
  'Tipo Cliente',
  'Entrada',
  'Prazo',
  'Valor (R$)',
  'Bloqueado',
  'Motivo',
];

function fmtDate(d: string | null): string {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Compara o segredo em tempo CONSTANTE (evita timing attack — é o único gate). */
function secretOk(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a); // gasta o mesmo tempo; nunca vaza o comprimento
    return false;
  }
  return timingSafeEqual(a, b);
}

type OSRow = {
  placa: string | null;
  modelo_veiculo: string | null;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  tipo_cliente: string | null;
  valor_orcamento: number | null;
  etapa_atual: string | null;
  bloqueado: boolean | null;
  motivo_bloqueio: string | null;
};

export async function POST(req: Request) {
  // 1) Autorização por segredo (comparação em tempo constante)
  const secret = process.env.SYNC_SECRET;
  if (!secret || !secretOk(req.headers.get('x-sync-secret'), secret)) {
    return NextResponse.json({ ok: false, erro: 'não autorizado' }, { status: 401 });
  }

  // 2) Config (tudo via env; nada hard-coded)
  const sheetId = process.env.SYNC_SHEET_ID;
  const oficinaId = process.env.SYNC_OFICINA_ID;
  const tab = process.env.SYNC_TAB || 'Totem · Pátio';
  const saEmail = process.env.GOOGLE_SA_EMAIL;
  const saKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!sheetId || !oficinaId || !saEmail || !saKey) {
    return NextResponse.json(
      { ok: false, erro: 'config ausente: SYNC_SHEET_ID / SYNC_OFICINA_ID / GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY' },
      { status: 500 }
    );
  }
  // Garante que o escopo multi-tenant é sempre UMA oficina bem-formada.
  if (!UUID_RE.test(oficinaId)) {
    return NextResponse.json({ ok: false, erro: 'config inválida' }, { status: 500 });
  }

  try {
    // 3) Lê as OS ativas da oficina (service role, ESCOPADO por oficina_id)
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(
        'placa, modelo_veiculo, status_geral, data_entrada, data_prometida, tipo_cliente, valor_orcamento, etapa_atual, bloqueado, motivo_bloqueio'
      )
      .eq('oficina_id', oficinaId)
      .neq('status_geral', 'Entregue')
      .order('data_entrada', { ascending: true });
    if (error) throw new Error(`Supabase: ${error.message}`);

    const os = (data ?? []) as OSRow[];
    const rows = os.map((o, i) => [
      i + 1,
      o.placa ?? '',
      o.modelo_veiculo ?? '',
      o.etapa_atual ?? '',
      o.status_geral ?? '',
      o.tipo_cliente ?? '',
      fmtDate(o.data_entrada),
      fmtDate(o.data_prometida),
      o.valor_orcamento ?? '',
      o.bloqueado ? 'Sim' : '',
      o.motivo_bloqueio ?? '',
    ]);

    const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const matrix = [
      [`🔄 Pátio do GDelta Totem — sincronizado em ${stamp} (não editar; sobrescrito a cada sync)`],
      HEADER,
      ...rows,
    ];

    // 4) Escreve na planilha
    const token = await getSheetsToken(saEmail, saKey);
    await mirrorToTab(sheetId, tab, matrix, token);

    return NextResponse.json({ ok: true, oficina_id: oficinaId, aba: tab, linhas: rows.length });
  } catch (e) {
    console.error('[sync/patio] falha:', e); // detalhe fica só no log do servidor
    return NextResponse.json({ ok: false, erro: 'falha interna ao sincronizar' }, { status: 500 });
  }
}
