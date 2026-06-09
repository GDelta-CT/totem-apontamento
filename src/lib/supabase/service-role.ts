/**
 * Cliente Supabase com SERVICE ROLE — ⚠️ IGNORA o RLS.
 *
 * Uso EXCLUSIVO em jobs de servidor SEM sessão de usuário (ex.: o sync da
 * planilha disparado por cron). Quem usa este cliente DEVE filtrar manualmente
 * por `oficina_id` — o isolamento multi-tenant não é garantido pelo banco aqui.
 *
 * NUNCA importar isto em fluxo de usuário (totem/admin): lá vale o cliente de
 * sessão (`server.ts`), onde o RLS isola por oficina automaticamente.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[GDelta] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes (service-role.ts).'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-client-info': 'gdelta-totem-sync/1.0' } },
  });
}
