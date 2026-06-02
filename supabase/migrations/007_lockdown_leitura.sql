-- =====================================================================
-- Migration 007 — Lockdown de leitura (isolamento real por oficina)  [MEXE EM RLS]
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
--
-- >>> NÃO APLICAR SEM APROVAÇÃO EXPLÍCITA DO FUNDADOR <<<
--   Mexe em RLS/GRANTS. Aprovação é por ambiente.
--   PRODUÇÃO (ccpxwnbxvmadcafxnbjs) NÃO recebe isto enquanto o device de
--   produção for `anon` puro (sem sessão) — lá quebraria o totem. Só após
--   migrar o device de produção para sessão real, e com novo OK explícito.
--
-- O QUE FAZ:
--   Remove as políticas ABERTAS do `anon` (que hoje deixam qualquer sessão ler
--   tudo, de todas as oficinas). Sobram só as `oficina_isolation_*`
--   (authenticated + escopo da própria oficina via oficina_id no JWT), que
--   passam a ser o ÚNICO caminho de acesso. Reforço: revoga os GRANTs do `anon`
--   nas 4 tabelas-base (mantém o `authenticated`, que é como o totem roda hoje
--   via DeviceAuthGate, e o admin via AdminAuthGate).
--
-- POR QUE NÃO QUEBRA O TOTEM (no TESTE):
--   O totem do teste já roda autenticado (device com oficina_id no JWT, Fase 1).
--   Suas leituras/escritas passam a usar as oficina_isolation_*.
--
-- PRÉ-REQUISITO DE CÓDIGO: nenhuma página pode ler dados sem sessão.
--   totem = DeviceAuthGate, admin = AdminAuthGate. /diagnostico (debug) degrada
--   graciosamente (anon não lê nada pós-lockdown). Remover /diagnostico antes do
--   deploy de produção (checklist), mas não é bloqueador aqui.
--
-- oficinas / user_oficinas: já estão trancadas por RLS (não há política de
--   `anon` nelas), então o anon já não lê — não mexemos aqui pra manter o escopo
--   mínimo.
--
-- Rollback: supabase/rollbacks/007_rollback.sql  (recria o estado atual)
-- =====================================================================

begin;

-- 1) Remover as políticas abertas do anon (o "vazamento" de leitura)
drop policy if exists "anon pode ler funcionarios ativos" on public.funcionarios;
drop policy if exists "anon pode ler ordens_servico"      on public.ordens_servico;
drop policy if exists "anon pode ler apontamentos"        on public.apontamentos;
drop policy if exists "anon pode criar apontamentos"      on public.apontamentos;
drop policy if exists "anon pode atualizar apontamentos"  on public.apontamentos;
drop policy if exists "pontos_select_all"                 on public.pontos_eletronicos;
drop policy if exists "pontos_insert_all"                 on public.pontos_eletronicos;

-- 2) Reforço: revogar os GRANTs do anon nas 4 tabelas-base (mantém authenticated)
revoke select, insert, update, delete on public.funcionarios       from anon;
revoke select, insert, update, delete on public.ordens_servico     from anon;
revoke select, insert, update, delete on public.apontamentos       from anon;
revoke select, insert, update, delete on public.pontos_eletronicos from anon;

commit;
