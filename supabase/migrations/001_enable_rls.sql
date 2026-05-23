-- ============================================================
-- MIGRATION 001 — Ativar Row Level Security (RLS)
-- ============================================================
-- O QUE FAZ:
--   Fecha o vazamento de segurança identificado no diagnóstico.
--   Hoje qualquer pessoa pode ler/alterar TODAS as tabelas com
--   apenas a ANON_KEY que está exposta no frontend.
--   Esta migration bloqueia isso.
--
-- IMPACTO:
--   Depois desta migration, o app NÃO vai funcionar até implementarmos
--   autenticação (Migration 002 em diante). Isso é POSITIVO.
--   Significa que o banco está blindado.
--
-- COMO RODAR:
--   1. Abrir Supabase Studio (https://supabase.com/dashboard)
--   2. Ir em "SQL Editor" no menu lateral
--   3. Colar TODO este arquivo
--   4. Clicar em "Run"
--   5. Se aparecer "Success. No rows returned" — deu certo
--
-- ROLLBACK:
--   Se der ruim, rodar o arquivo 001_rollback.sql
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

-- 4. Garantir que role 'anon' NÃO tem acesso de leitura por padrão
--    (Sem policies, ninguém entra)
-- Isso é automático após ENABLE RLS, mas reforçamos.

-- 5. Verificação — listar tabelas com RLS ativo
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_ativo,
  forcerowsecurity AS rls_forcado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('funcionarios','ordens_servico','apontamentos','pontos_eletronicos')
ORDER BY tablename;

-- Esperado: 4 linhas, todas com rls_ativo=true e rls_forcado=true
