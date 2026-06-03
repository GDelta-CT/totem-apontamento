/**
 * /admin/producao — Visão Operacional AO VIVO (Passo 3 da ordem A.1).
 *
 * SERVER-MOVE (passo 1 — a tela MAIS complexa: kanban ao vivo com auto-refresh):
 * esta página agora é um SERVER COMPONENT (note a AUSÊNCIA de 'use client' no
 * topo). A LEITURA do kanban saiu do browser e roda no SERVIDOR: chamamos
 * carregarVisaoLiveServer() (DAL + cookie httpOnly → RLS isola por oficina_id). O
 * resultado já pronto desce como prop (`estadoInicial`) para o componente client
 * <ProducaoView>, que mantém a UX 100% idêntica (AdminAuthGate, AdminShell, tema
 * dark, loading/empty/error, KPIs com benchmark, faixa dos 3 estados e o kanban
 * premium) e cuida do AUTO-REFRESH re-buscando NO SERVIDOR via router.refresh()
 * na MESMA cadência de 20s (sem polling de Supabase no Network do browser).
 *
 * Esta é uma tela SÓ LEITURA: não há arrastar/corrigir etapa aqui (a edição de
 * etapa_atual vive no formulário da OS, em /admin/os). Nada do totem/escrita/RLS
 * foi tocado.
 *
 * Por que a busca fica antes do gate client: a query server só roda se houver
 * SESSÃO no cookie (getSessao); sem sessão devolve `empty` e o gate client
 * renderiza a tela de login — o anon NÃO lê dado de negócio. O gestor logado tem
 * o dado renderizado no servidor; o gate client só decide login/papel/liberado.
 *
 * dynamic='force-dynamic': a tela é AO VIVO (depende da sessão do cookie e muda a
 * cada apontamento). Sem cache de página — toda visita/refresh re-lê fresh.
 */

import { carregarVisaoLiveServer } from '@/lib/supabase/live-queries.server';
import { ProducaoView } from './ProducaoView';

// Tela viva e dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminProducaoPage() {
  const estadoInicial = await carregarVisaoLiveServer();
  return <ProducaoView estadoInicial={estadoInicial} />;
}
