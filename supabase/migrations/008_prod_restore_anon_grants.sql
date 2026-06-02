-- =====================================================================
-- Migration 008 — PRODUCAO: restaurar GRANTs do anon (conserto do 401)
-- >>> ALVO: PRODUCAO  "GDelta-CT's Project"  (ref ccpxwnbxvmadcafxnbjs, Oregon)
--
-- >>> NAO APLICAR SEM APROVACAO EXPLICITA DO FUNDADOR, E SO EM PRODUCAO. <<<
-- >>> Aplicar SOMENTE depois do diagnostico (so-leitura) confirmar que:  <<<
-- >>>   (a) os GRANTs do anon nas 4 tabelas estao FALTANDO, e            <<<
-- >>>   (b) as politicas "anon pode ..." EXISTEM (senao o grant nao basta).
-- >>> NAO rodar no TESTE (la o caminho e o oposto: lockdown).            <<<
--
-- CONTEXTO: a Migration 001 (RLS) revogou os GRANTs do anon nas 4 tabelas-base
--   e nunca restaurou -> o totem de producao (que usa anon) da 401. Isto devolve
--   so o que o totem anon precisa. E ADITIVO (nao dropa nada, nao mexe em RLS).
--
-- ESCOPO/VALIDADE: vale enquanto a producao for de UMA oficina (single-tenant de
--   fato) e o totem de prod usar anon. Se/quando a producao migrar para o login
--   de device (Fase 1) + lockdown, este grant deve ser revisto.
-- Rollback: supabase/rollbacks/008_rollback.sql
-- =====================================================================

begin;

grant select                 on public.funcionarios       to anon;
grant select                 on public.ordens_servico     to anon;
grant select, insert, update on public.apontamentos       to anon;
grant select, insert         on public.pontos_eletronicos to anon;

commit;
