-- =====================================================================
-- Rollback da Migration 008 (PRODUCAO) — revoga de novo os GRANTs do anon.
-- ALVO: PRODUCAO  ref ccpxwnbxvmadcafxnbjs (Oregon).
-- Use SO se restaurar os grants causar algum problema e for preciso voltar atras.
-- (Voltar atras recoloca o totem de producao no estado de 401.)
-- =====================================================================

begin;

revoke select, insert, update, delete on public.funcionarios       from anon;
revoke select, insert, update, delete on public.ordens_servico     from anon;
revoke select, insert, update, delete on public.apontamentos       from anon;
revoke select, insert, update, delete on public.pontos_eletronicos from anon;

commit;
