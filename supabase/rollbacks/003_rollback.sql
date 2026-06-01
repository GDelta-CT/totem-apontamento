-- =====================================================================
-- Rollback da Migration 003 — Campos da OS (MVP)
-- Alvo: projeto de TESTE  (ref pvrnimckfgdmgjrjueap)
-- Remove as colunas/CHECKs/índices adicionados pela 003.
-- ATENÇÃO: dropar coluna apaga os dados dessas colunas (mas elas são novas).
-- =====================================================================

begin;

drop index if exists public.idx_os_data_prometida;
drop index if exists public.idx_os_etapa_atual;

alter table public.ordens_servico drop constraint if exists chk_os_tipo_cliente;
alter table public.ordens_servico drop constraint if exists chk_os_etapa_atual;
alter table public.ordens_servico drop constraint if exists chk_os_motivo_bloqueio;

alter table public.ordens_servico
  drop column if exists data_prometida,
  drop column if exists tipo_cliente,
  drop column if exists valor_orcamento,
  drop column if exists ref_externa,
  drop column if exists etapa_atual,
  drop column if exists bloqueado,
  drop column if exists motivo_bloqueio;

commit;
