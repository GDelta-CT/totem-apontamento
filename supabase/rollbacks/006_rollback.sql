-- =====================================================================
-- Rollback da Migration 006 — remove a marca e revoga o UPDATE do admin.
-- Alvo: TESTE (pvrnimckfgdmgjrjueap). NÃO rodar em produção sem aprovação.
-- =====================================================================

begin;

revoke update on public.apontamentos from authenticated;
alter table public.apontamentos drop column if exists editado_admin;

commit;
