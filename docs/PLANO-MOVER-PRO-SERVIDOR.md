# Plano — Mover dados do browser para o SERVIDOR (passo 3 do CLAUDE.md)

> Produzido pelo backend-architect em 2026-06-02. É o **pré-requisito** pra aplicar o
> lockdown (007) com segurança. Implementação é **gated** (grande mudança de fundação) —
> exige OK do fundador. Manter o totem funcionando a cada passo.

## Problema
Hoje TODAS as queries rodam no **browser** com a anon key (`src/lib/supabase/*.ts`, páginas
`'use client'`). O RLS é a única defesa, e enquanto as policies abertas do anon vivem,
qualquer um com a anon key (pública) lê via REST direto. O lockdown só é seguro depois que
nada de negócio depender do anon no browser.

## Decisão: `@supabase/ssr` (cookie) + Server Components (leitura) + Server Actions (escrita)
A sessão sai do `localStorage` e vira **cookie httpOnly**; o servidor lê a sessão do cookie e
cria um client server-side **já autenticado como o usuário** → o **RLS continua isolando por
`oficina_id`** sem código extra. Anon key e queries saem do browser.

- Rejeitado A (token no header + tudo client): reescreve todo o consumo, mantém token exposto.
- Rejeitado C (service role + filtro manual `.eq('oficina_id')`): **desliga o RLS de fato** →
  risco de vazamento entre oficinas. Anti-padrão aqui.

**Service role NÃO entra no fluxo de request.** RLS via cookie cobre tudo.

## Camadas (dependência sempre pra baixo)
Páginas (RSC p/ leitura · Server Actions p/ escrita) → camada de dados (`*-queries.ts`,
agora `server-only`/`'use server'`) → **DAL** (`lib/supabase/dal.ts`: `getSessao()`,
`getServerClient()`, `requireGestor()`, `requireDevice()`) → fábricas `@supabase/ssr`
(`server.ts`/`proxy.ts`) → cookies httpOnly → Postgres (RLS).

Contrato: toda função de dados chama o DAL antes; **nenhuma query confia em `oficina_id`
vindo do cliente** (vem do JWT/cookie). Preservar `FetchState<T>` + `withTimeout` (8s).

## Ordem incremental (007 é a ÚLTIMA; totem vivo a cada passo)
| Passo | Entrega | Critério de verificação |
|---|---|---|
| 0 | `@supabase/ssr` + `server.ts`/`proxy.ts`/`dal.ts` + `proxy.ts` raiz; gates gravam cookie | App roda igual; `getSessao()` devolve `oficinaId` certo em RSC de teste; login admin+device setam cookie. **Aditivo, reversível, não toca RLS.** |
| 1 | 5 leituras admin server-side + auto-refresh por action | Telas admin idênticas; zero query Supabase no Network do browser; `oficina_id` do crachá confere |
| 2 | Totem leitura+escrita via Server Actions | **No tablet:** cookie do device persiste/renova sem relogin; apontar grava; queda de rede mostra "não salvou" |
| 3 | 6 escritas admin via Server Actions com `requireGestor()` | CRUD/correção OK como gestor; POST sem sessão de gestor → 401/403 |
| 4 | Varredura: nenhuma leitura/escrita de negócio em `'use client'` | grep limpo; bundle do browser sem queries de negócio |
| 5 | **Aplicar 007 (lockdown) — só com OK do fundador** | Totem+admin vivos; anon puro não lê; isolamento entre 2 oficinas confirmado |

## Riscos principais
1. **Cookie do device no kiosk** (elo mais fraco): precisa persistir + auto-renovar no tablet
   sem relogin. `proxy.ts` faz o refresh; **testar em tablet real no Passo 2**.
2. `cookies()`/`headers()` são **assíncronos** no Next 16 (`await`). Centralizar no DAL.
3. Server Action é endpoint POST público → **authz (`requireGestor`) dentro de cada action**.
4. Não pôr auth-check só no layout (não revalida em navegação) — mora no DAL.

## Próximo passo recomendado
**Passo 0** — fundação de sessão (puramente aditivo, reversível, não toca RLS). Implementação
pelo backend-forge. É AUTÔNOMO (não depende do fundador); o gate é só o Passo 5 (007).
