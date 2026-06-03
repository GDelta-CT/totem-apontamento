/**
 * /admin/prazos — Painel do Dono: saúde de prazos (Passo 3.5 da ordem A.1).
 *
 * SERVER-MOVE (passo 1 — PROVA DE PADRÃO): esta página agora é um SERVER
 * COMPONENT (note a AUSÊNCIA de 'use client' no topo). A LEITURA do painel saiu
 * do browser e roda no SERVIDOR: chamamos carregarPainelDonoServer() (DAL +
 * cookie httpOnly → RLS isola por oficina_id). O resultado já pronto desce como
 * prop (`estadoInicial`) para o componente client <PrazosView>, que mantém a UX
 * 100% idêntica (AdminAuthGate, AdminShell, tema dark, loading/empty/error,
 * holofote, KPIs, extrato) e cuida do auto-refresh re-buscando NO SERVIDOR via
 * router.refresh() (sem polling de Supabase no Network do browser).
 *
 * Por que a busca fica antes do gate client: a query server só roda se houver
 * SESSÃO no cookie (getSessao); sem sessão devolve `empty` e o gate client
 * renderiza a tela de login — o anon NÃO lê dado de negócio. O dono logado tem o
 * dado renderizado no servidor; o gate client só decide login/papel/liberado.
 *
 * dynamic='force-dynamic': a tela é AO VIVO (depende da sessão do cookie e muda
 * a cada apontamento). Sem cache de página — toda visita/refresh re-lê fresh.
 */

import { carregarPainelDonoServer } from '@/lib/supabase/dono-queries.server';
import { PrazosView } from './PrazosView';

// Tela viva e dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminPrazosPage() {
  const estadoInicial = await carregarPainelDonoServer();
  return <PrazosView estadoInicial={estadoInicial} />;
}
