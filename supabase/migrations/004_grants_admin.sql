-- =====================================================================
-- Migration 004 — Permissões de escrita do ADMIN  [MEXE EM GRANTS]
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
--
-- >>> NÃO APLICAR SEM APROVAÇÃO EXPLÍCITA DO FUNDADOR <<<
--   (regra "Autonomia e escalonamento" do CLAUDE.md: mudanças de GRANTS/RLS
--    param e pedem aprovação. A IA PARA E PERGUNTA — nunca infere de notas.)
--
-- STATUS DE APLICAÇÃO:
--   • TESTE (pvrnimckfgdmgjrjueap): APLICADA em 2026-05-31, com OK explícito do
--     fundador para o teste. Esta aprovação vale SÓ para o teste.
--   • PRODUÇÃO (ccpxwnbxvmadcafxnbjs): PROIBIDA sem novo OK explícito do fundador
--     E somente DEPOIS da migration de lockdown de leitura. NÃO aplicar antes.
--
-- O que faz: dá ao papel `authenticated` (o admin logado com conta real)
--   permissão de criar/editar/excluir OS e funcionários. O RLS já existente
--   (oficina_isolation_*) garante que ele só enxerga/altera a PRÓPRIA oficina.
--   O papel `anon` (o totem) NÃO ganha nada aqui — segue só leitura, o que
--   já prepara o terreno para o lockdown final.
-- Rollback: supabase/rollbacks/004_rollback.sql
-- =====================================================================

begin;

grant insert, update, delete on public.ordens_servico to authenticated;
grant insert, update, delete on public.funcionarios   to authenticated;

commit;
