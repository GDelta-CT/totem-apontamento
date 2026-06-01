-- =====================================================================
-- Rollback da Migration 004 — Permissões de escrita do ADMIN
-- Alvo: projeto de TESTE  (ref pvrnimckfgdmgjrjueap)
-- Revoga a escrita do `authenticated`, voltando essas tabelas a só leitura.
-- =====================================================================

begin;

revoke insert, update, delete on public.ordens_servico from authenticated;
revoke insert, update, delete on public.funcionarios   from authenticated;

commit;
