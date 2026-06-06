/**
 * /admin — Painel do Gestor (hub de navegação).
 *
 * SERVER-MOVE (passo 1): esta página agora é um SERVER COMPONENT (note a
 * AUSÊNCIA de 'use client' no topo). A LEITURA da identidade da sessão (e-mail +
 * papel + oficina_id do JWT) — usada na linha discreta "Sessão" do rodapé, a
 * "prova do isolamento" multi-tenant — saiu do browser e roda no SERVIDOR:
 * chamamos carregarSessaoAdminServer() (DAL getSessao → getUser/getClaims
 * VERIFICADOS). O resultado já pronto desce como prop (`estadoInicial`) para o
 * componente client <AdminHomeView>, que mantém a UX 100% idêntica (AdminAuthGate,
 * AdminShell, tema dark, grade de cartões, copy, a11y).
 *
 * Antes, o hub lia essa identidade no BROWSER via cracheDaSessao()/
 * papelDoUsuarioAtual() (getSession, que NÃO verifica o token). Agora a única
 * fonte é o servidor — sem leitura de JWT no browser para essa linha.
 *
 * Por que a busca fica antes do gate client: getSessao() só devolve dados se
 * houver SESSÃO no cookie; sem sessão devolve `empty` e o gate client (dentro da
 * View) renderiza a tela de login — o anon NÃO é lido. O hub é leve e estático
 * (a antessala não busca dado de negócio ao vivo); não há auto-refresh aqui.
 *
 * RESUMO DE PRAZOS NA HOME (Daily Huddle): além da sessão, buscamos TAMBÉM o
 * painel do dono no SERVIDOR — a MESMA carregarPainelDonoServer() que alimenta
 * /admin/prazos (RLS isola por oficina_id; nada de query no browser). As duas
 * leituras saem EM PARALELO (Promise.all). Não recriamos a tela de prazos: a
 * View só mostra um resumo compacto dos KPIs no topo e encaminha para o detalhe.
 * Sem sessão, carregarPainelDonoServer() devolve `empty` (não consulta como
 * anon) e a View simplesmente omite o bloco — a home nunca quebra por isso.
 *
 * dynamic='force-dynamic': a tela depende da sessão do cookie — nunca
 * pré-renderizar/cachear; toda visita re-lê a sessão fresh.
 */

import { carregarPainelDonoServer, carregarSessaoAdminServer } from '@/lib/supabase/dono-queries.server';
import { AdminHomeView } from './AdminHomeView';

// Tela dependente do cookie de sessão: nunca pré-renderizar/cachear.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [estadoInicial, painelInicial] = await Promise.all([
    carregarSessaoAdminServer(),
    carregarPainelDonoServer(),
  ]);
  return <AdminHomeView estadoInicial={estadoInicial} painelInicial={painelInicial} />;
}
