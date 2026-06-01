-- =====================================================================
-- Migration 006 — Correção de anomalias pelo ADMIN  [MEXE EM GRANTS]
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
--
-- >>> NÃO APLICAR SEM APROVAÇÃO EXPLÍCITA DO FUNDADOR <<<
--   Parte 2 mexe em GRANTS. A IA para e pergunta — não infere. Aprovação é
--   por ambiente. PRODUÇÃO (ccpxwnbxvmadcafxnbjs) NUNCA sem novo OK e só após
--   o lockdown de leitura.
--
-- O que faz:
--   PARTE 1 (aditiva, segura): coluna `editado_admin` (marca leve "editado pelo
--     admin") em apontamentos. OS antigas ficam false.
--   PARTE 2 (GRANTS): dá UPDATE em apontamentos ao papel `authenticated`, para o
--     admin corrigir tempo/fechar fantasma. O RLS oficina_isolation_* já garante
--     que ele só altera a PRÓPRIA oficina. NÃO dá DELETE (correção é editar, não
--     apagar histórico). `anon` (totem) não ganha nada.
-- Rollback: supabase/rollbacks/006_rollback.sql
-- =====================================================================

begin;

-- PARTE 1 — coluna de marca (aditiva)
alter table public.apontamentos
  add column if not exists editado_admin boolean not null default false;

-- PARTE 2 — permissão de correção do admin
grant update on public.apontamentos to authenticated;

commit;
