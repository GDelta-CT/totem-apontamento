-- =====================================================================
-- ROLLBACK do bootstrap da Fase 0 — projeto de TESTE (pvrnimckfgdmgjrjueap)
-- Reverte 000_bootstrap_test.sql. Seguro porque o teste partiu vazio.
-- NUNCA rodar em produção.
-- =====================================================================
DROP TABLE IF EXISTS public.apontamentos       CASCADE;
DROP TABLE IF EXISTS public.pontos_eletronicos CASCADE;
DROP TABLE IF EXISTS public.ordens_servico     CASCADE;
DROP TABLE IF EXISTS public.funcionarios       CASCADE;
DROP TABLE IF EXISTS public.user_oficinas      CASCADE;
DROP TABLE IF EXISTS public.oficinas           CASCADE;
DROP FUNCTION IF EXISTS public.set_atualizado_em() CASCADE;
