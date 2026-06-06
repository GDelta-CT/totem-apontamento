-- =====================================================================
-- Rollback da Migration 014 — OS como Container (um apontamento ativo/operário)
-- >>> ALVO: TESTE (ref pvrnimckfgdmgjrjueap). NUNCA em produção.
--
-- Remove a RPC e o índice único. NÃO desfaz a limpeza (1) da 014 — pausar
-- duplicados 'Em andamento' é seguro/desejado e não deve ser revertido.
-- Depois disto, reverter o código (.ts): iniciarApontamento volta ao INSERT cru.
-- =====================================================================

begin;

drop index  if exists public.uq_apontamento_ativo_por_operario;
drop function if exists public.fn_iniciar_apontamento(uuid, text, text, text, boolean, text);

commit;
