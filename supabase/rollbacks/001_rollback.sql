-- ============================================================
-- ROLLBACK 001 — Desativar RLS (caso algo dê errado)
-- ============================================================
-- ATENÇÃO: Use APENAS se a Migration 001 deixou o sistema travado
-- e você precisa voltar urgentemente ao estado anterior.
--
-- Isto REABRE o vazamento de segurança. Use com consciência.
-- ============================================================

ALTER TABLE IF EXISTS public.funcionarios       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ordens_servico     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apontamentos       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontos_eletronicos DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.funcionarios       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ordens_servico     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apontamentos       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontos_eletronicos NO FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apontamentos       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pontos_eletronicos TO anon, authenticated;
