-- =====================================================================
-- Rollback da Migration 009 (TESTE) — REMOVE os objetos de isolamento.
-- >>> PERIGO: rodar isto DESLIGA o isolamento multi-tenant — o oficina_id
-- >>> deixa de ser carimbado nos INSERTs e o JWT para de receber oficina_id.
-- >>> Use SOMENTE se precisar remover de proposito a captura. Normalmente NAO.
-- ALVO: TESTE (pvrnimckfgdmgjrjueap). NUNCA em producao.
-- =====================================================================
begin;

drop trigger if exists trg_set_oficina_id on public.apontamentos;
drop trigger if exists trg_set_oficina_id on public.funcionarios;
drop trigger if exists trg_set_oficina_id on public.ordens_servico;
drop trigger if exists trg_set_oficina_id on public.pontos_eletronicos;

drop policy if exists auth_admin_read_user_oficinas on public.user_oficinas;

-- As FUNCOES ficam por padrao (outros objetos podem depender). Descomente
-- so se realmente quiser remove-las:
-- drop function if exists public.set_oficina_id_from_jwt();
-- drop function if exists public.custom_access_token_hook(jsonb);

commit;
