-- ============================================================
-- MIGRATION 001 — Ativar Row Level Security (RLS)
-- ============================================================

-- 1. Ativar RLS em todas as tabelas existentes
ALTER TABLE IF EXISTS public.funcionarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ordens_servico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apontamentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontos_eletronicos ENABLE ROW LEVEL SECURITY;

-- 2. Forçar RLS mesmo para o owner (defesa em profundidade)
ALTER TABLE IF EXISTS public.funcionarios       FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ordens_servico     FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.apontamentos       FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontos_eletronicos FORCE ROW LEVEL SECURITY;

-- 3. REVOGAR todos os acessos públicos das tabelas
REVOKE ALL ON public.funcionarios       FROM anon, authenticated;
REVOKE ALL ON public.ordens_servico     FROM anon, authenticated;
REVOKE ALL ON public.apontamentos       FROM anon, authenticated;
REVOKE ALL ON public.pontos_eletronicos FROM anon, authenticated;

-- 4. Após ENABLE RLS sem policies, nenhum acesso é permitido por padrão.
--    As policies de isolamento por oficina_id serão adicionadas na Migration 002.

-- Fim da Migration 001
