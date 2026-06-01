-- =====================================================================
-- Migration 005 — status_geral fixo + placa única-PARCIAL
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
--
-- >>> MUDA SCHEMA (constraint da placa) — NÃO APLICAR SEM APROVAÇÃO. <<<
--   Aprovação é por ambiente. PRODUÇÃO (ccpxwnbxvmadcafxnbjs) intocada.
--
-- O que faz:
--   1) Trava status_geral numa lista fixa (4 valores) via CHECK, em vez de
--      texto livre — senão "Entregue" apareceria escrito de vários jeitos e
--      a regra de "OS ativa" furaria.
--   2) Troca a unicidade TOTAL da placa por unicidade PARCIAL: só pode haver
--      UMA OS ativa (status_geral <> 'Entregue') por placa. Um carro entregue
--      que volta para serviço PODE abrir OS nova; só não pode ter duas abertas.
-- Idempotente. Rollback: supabase/rollbacks/005_rollback.sql
-- =====================================================================

begin;

-- 0) Normaliza dados legados para caber no CHECK (mapeia variações conhecidas).
--    Hoje no teste só existe 'Aguardando Produção'; o COALESCE cobre nulos.
update public.ordens_servico
   set status_geral = 'Aguardando Produção'
 where status_geral is null
    or status_geral not in
      ('Aguardando Produção','Em Produção','Pronto para Entrega','Entregue');

-- 1) status_geral: default + lista fixa (CHECK)
alter table public.ordens_servico
  alter column status_geral set default 'Aguardando Produção';

alter table public.ordens_servico drop constraint if exists chk_os_status_geral;
alter table public.ordens_servico add constraint chk_os_status_geral
  check (status_geral in
    ('Aguardando Produção','Em Produção','Pronto para Entrega','Entregue'));

-- 2) Placa única-PARCIAL:
--    remove a UNIQUE total (criada como ordens_servico_placa_key no schema base)
alter table public.ordens_servico drop constraint if exists ordens_servico_placa_key;

--    índice único parcial por (oficina_id, placa) só quando NÃO entregue.
--    Inclui oficina_id para não vazar/colidir placa entre oficinas (multi-tenant).
drop index if exists uq_os_placa_ativa;
create unique index uq_os_placa_ativa
  on public.ordens_servico (oficina_id, placa)
  where status_geral <> 'Entregue';

commit;
