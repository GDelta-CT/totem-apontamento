-- =====================================================================
-- Rollback da Migration 005 — volta a placa única-TOTAL e solta o status.
-- Alvo: TESTE (pvrnimckfgdmgjrjueap). NÃO rodar em produção sem aprovação.
-- ATENÇÃO: só volta para UNIQUE total se NÃO houver placas duplicadas; se um
--   carro voltou e abriu 2ª OS, remova/entregue uma antes de reverter.
-- =====================================================================

begin;

drop index if exists uq_os_placa_ativa;

alter table public.ordens_servico drop constraint if exists chk_os_status_geral;
alter table public.ordens_servico alter column status_geral drop default;

-- restaura a unicidade total da placa (nome original do schema base)
alter table public.ordens_servico
  add constraint ordens_servico_placa_key unique (placa);

commit;
