/**
 * /admin/os — Gestão de Ordens de Serviço (Passo 1 da ordem A.1).
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): esta página agora é um SERVER COMPONENT
 * (note a AUSÊNCIA de 'use client' no topo). A LEITURA (lista de OS) saiu do
 * browser e roda no SERVIDOR: chamamos listarOSServer() (DAL + cookie httpOnly →
 * RLS isola por oficina_id). O resultado já pronto desce como prop
 * (`estadoInicial`) para o componente client <OSView>, que mantém a UX 100%
 * idêntica (AdminAuthGate, AdminShell, tema dark, loading/empty/error, copy, a11y)
 * e re-lê NO SERVIDOR via router.refresh() após cada escrita bem-sucedida.
 *
 * SERVER-MOVE (passo 3): a ESCRITA (criar/editar OS) e a busca "antes-de-criar"
 * AGORA RODAM NO SERVIDOR via Server Actions (admin-actions.ts): a View chama
 * criarOS/atualizarOS/buscarOSAtivaPorPlacaAction, cada uma com requireGestor()
 * no servidor e revalidatePath('/admin/os') no sucesso. A View também dá
 * router.refresh() — a tela atualiza após a ação como antes.
 *
 * Por que a busca fica antes do gate client: a query server só roda se houver
 * SESSÃO no cookie (getSessao); sem sessão devolve `empty` e o gate client
 * renderiza a tela de login — o anon NÃO lê dado de negócio.
 *
 * dynamic='force-dynamic': a tela depende da sessão do cookie e muda a cada
 * cadastro/edição. Sem cache de página — toda visita/refresh re-lê fresh.
 */

import { listarOSServer } from '@/lib/supabase/admin-queries.server';
import { OSView } from './OSView';

// Tela viva e dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminOSPage() {
  const estadoInicial = await listarOSServer();
  return <OSView estadoInicial={estadoInicial} />;
}
