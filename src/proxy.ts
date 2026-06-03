/**
 * Proxy (o que era "middleware" antes do Next 16 — renomeado, mesma função).
 * Vive em `src/proxy.ts`, no MESMO nível de `src/app`.
 *
 * Papel ÚNICO neste Passo 0: RENOVAR o token do Supabase e PROPAGAR o cookie
 * da sessão a cada requisição (padrão @supabase/ssr para SSR frameworks). Sem
 * isso, a sessão em cookie expiraria sem refresh — e o totem no kiosk (sessão
 * de longa duração) perderia o login. O proxy roda na borda de cada request:
 *  1. cria um cliente Supabase ligado aos cookies do request/response;
 *  2. chama getUser() CEDO — isso dispara o refresh do token quando preciso;
 *  3. escreve os cookies renovados de volta na resposta, junto dos headers de
 *     no-cache que a lib fornece (resposta que seta auth cookie NÃO pode ser
 *     cacheada por CDN/proxy — senão a sessão de um vaza pra outro).
 *
 * NÃO faz authz/redirect aqui (decisão do plano: authz mora no DAL, perto do
 * dado; proxy só renova sessão). O guia de auth do Next reforça: o proxy não é
 * a linha de defesa — cada Server Action/Route Handler revalida no DAL.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function proxy(request: NextRequest) {
  // Resposta-base: deixa o request seguir; os cookies renovados entram nela.
  let response = NextResponse.next({ request });

  // Sem variáveis configuradas, não há o que renovar — segue a vida.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // (a) reflete nos cookies do request (leituras posteriores no mesmo ciclo)
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // (b) recria a resposta a partir do request atualizado...
        response = NextResponse.next({ request });
        // ...e grava os cookies renovados na resposta que vai ao browser.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // (c) headers anti-cache que a lib pede ao setar auth cookies.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Dispara o refresh do token, se necessário. NÃO remova esta chamada: é ela
  // que faz o setAll acima rodar e propagar a sessão renovada.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Roda em todas as rotas, exceto assets estáticos e otimização de imagem.
  // (Recomendado para auth: cobrir o app todo, deixando estáticos de fora.)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
