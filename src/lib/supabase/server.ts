/**
 * Fábrica do cliente Supabase para o SERVIDOR (Server Components, Server
 * Actions e Route Handlers). Passo 0 do server-move.
 *
 * Usa `createServerClient` do `@supabase/ssr`, lendo/gravando a sessão nos
 * COOKIES httpOnly da requisição via `cookies()` do Next (que é ASSÍNCRONO no
 * Next 16 — daí o `await`). O cliente nasce JÁ AUTENTICADO como o usuário do
 * cookie, então o RLS continua isolando por oficina_id sem nenhum filtro
 * manual no código. Anon key e service role NÃO entram aqui como atalho de
 * isolamento — é sempre a sessão do usuário.
 *
 * IMPORTANTE (padrão @supabase/ssr no Next):
 * - Em Server Components NÃO é permitido escrever cookies durante o render.
 *   Por isso o `setAll` é envolvido em try/catch: se for chamado de um RSC
 *   (refresh de token no meio de um render), o erro é engolido e o `proxy.ts`
 *   da raiz se encarrega de renovar/propagar o cookie na próxima requisição.
 *   Em Server Actions e Route Handlers o `set` funciona e persiste a sessão.
 * - Crie um cliente NOVO por request (não compartilhe entre requisições). Por
 *   isso esta função é `async` e não memoiza nada aqui — a memoização por
 *   render mora no DAL (getServerClient/getSessao com React cache()).
 */

import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[GDelta] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes (server.ts). Verifique o .env.local e reinicie o dev server.'
  );
}

/**
 * Cria um cliente Supabase server-side ligado aos cookies da requisição atual.
 * Use SEMPRE via `getServerClient()` do DAL (memoiza por render); esta função
 * é o tijolo de baixo nível.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { 'x-client-info': 'gdelta-totem-server/1.0' },
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component (render): escrever cookie aqui não é
          // permitido pelo Next. Sem problema — o proxy.ts renova a sessão e
          // propaga o cookie na borda da requisição. Ver comentário do topo.
        }
      },
    },
  });
}
