-- =====================================================================
-- Rollback da Migration 010 (TESTE) — remove a trilha de correcao.
-- ALVO: TESTE (pvrnimckfgdmgjrjueap). NUNCA em producao.
-- Seguro: a tabela e aditiva; dropa-la (cascade) leva junto policies/trigger/indices.
-- (O apontamento bruto e a flag editado_admin nao sao tocados por este rollback.)
-- =====================================================================
begin;
drop table if exists public.apontamento_correcoes cascade;
commit;
