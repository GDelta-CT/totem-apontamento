/**
 * /admin/funcionarios — Gestão da equipe (Passo 1 da ordem A.1).
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): esta página agora é um SERVER COMPONENT
 * (note a AUSÊNCIA de 'use client' no topo). A LEITURA (lista da equipe) saiu do
 * browser e roda no SERVIDOR: chamamos listarFuncionariosServer() (DAL + cookie
 * httpOnly → RLS isola por oficina_id). O resultado já pronto desce como prop
 * (`estadoInicial`) para o componente client <FuncionariosView>, que mantém a UX
 * 100% idêntica (AdminAuthGate, AdminShell, tema dark, loading/empty/error, copy,
 * a11y, G4/G5) e re-lê NO SERVIDOR via router.refresh() após cada escrita
 * bem-sucedida.
 *
 * A ESCRITA (criar/editar/ativar funcionário) e as checagens G4 (nome duplicado) /
 * G5 (apontamento ativo) CONTINUAM NO CLIENTE neste passo (Passo 3 do server-move
 * move a escrita): a View chama criarFuncionario/atualizarFuncionario/
 * setFuncionarioAtivo/buscarFuncionarioPorNome/funcionarioTemApontamentoAtivo de
 * admin-queries.ts e, no sucesso, dá router.refresh() para o servidor re-ler.
 *
 * Por que a busca fica antes do gate client: a query server só roda se houver
 * SESSÃO no cookie (getSessao); sem sessão devolve `empty` e o gate client
 * renderiza a tela de login — o anon NÃO lê dado de negócio.
 *
 * dynamic='force-dynamic': a tela depende da sessão do cookie e muda a cada
 * cadastro/edição. Sem cache de página — toda visita/refresh re-lê fresh.
 */

import { listarFuncionariosServer } from '@/lib/supabase/admin-queries.server';
import { FuncionariosView } from './FuncionariosView';

// Tela viva e dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminFuncionariosPage() {
  const estadoInicial = await listarFuncionariosServer();
  return <FuncionariosView estadoInicial={estadoInicial} />;
}
