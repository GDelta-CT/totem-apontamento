/**
 * /admin/anomalias — Correção de anomalias do admin (Passo 4 da ordem A.1).
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): esta página agora é um SERVER COMPONENT
 * (note a AUSÊNCIA de 'use client' no topo). A LEITURA (detecção dos
 * apontamentos-fantasma) saiu do browser e roda no SERVIDOR: chamamos
 * listarAnomaliasServer() (DAL + cookie httpOnly → RLS isola por oficina_id). O
 * resultado já pronto desce como prop (`estadoInicial`) para o componente client
 * <AnomaliasView>, que mantém a UX 100% idêntica (AdminAuthGate, AdminShell, tema
 * dark, loading/empty/error, copy, a11y) e re-lê NO SERVIDOR via router.refresh()
 * (botão "Atualizar" e após cada correção bem-sucedida).
 *
 * SERVER-MOVE (passo 3): a ESCRITA (a correção append-only) AGORA RODA NO SERVIDOR
 * via Server Action (anomalias-actions.ts): a View chama registrarCorrecao(), que
 * faz requireGestor() no servidor e revalidatePath('/admin/anomalias') no sucesso.
 * A View também dá router.refresh() para o servidor re-ler.
 *
 * Por que a busca fica antes do gate client: a query server só roda se houver
 * SESSÃO no cookie (getSessao); sem sessão devolve `empty` e o gate client
 * renderiza a tela de login — o anon NÃO lê dado de negócio.
 *
 * dynamic='force-dynamic': a tela é AO VIVO (depende da sessão do cookie e muda a
 * cada apontamento). Sem cache de página — toda visita/refresh re-lê fresh.
 */

import { listarAnomaliasServer } from '@/lib/supabase/anomalias-queries.server';
import { AnomaliasView } from './AnomaliasView';

// Tela viva e dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminAnomaliasPage() {
  const estadoInicial = await listarAnomaliasServer();
  return <AnomaliasView estadoInicial={estadoInicial} />;
}
