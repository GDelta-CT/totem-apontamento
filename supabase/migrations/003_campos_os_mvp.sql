-- =====================================================================
-- Migration 003 — Campos da OS (MVP)  [ADITIVA — segura]
-- Alvo: projeto de TESTE  GDelta-Totem-Teste  (ref pvrnimckfgdmgjrjueap)
-- Natureza: só ADICIONA colunas, CHECKs dos novos campos e índices.
--   NÃO mexe em permissões/GRANTS nem em RLS  (isso fica na 004).
--   NÃO altera nem remove nada existente -> o totem segue funcionando
--   (ele lê apenas placa/modelo_veiculo/status_geral/data_entrada).
-- Idempotente: pode rodar de novo sem erro (IF NOT EXISTS / drop+add do CHECK).
-- Rollback: supabase/rollbacks/003_rollback.sql
-- =====================================================================

begin;

-- 1) Novas colunas (todas opcionais; OS antigas ficam com NULL) ---------
alter table public.ordens_servico
  add column if not exists data_prometida  date,
  add column if not exists tipo_cliente    text,
  add column if not exists valor_orcamento numeric(12,2),
  add column if not exists ref_externa     text,
  add column if not exists etapa_atual     text,
  add column if not exists bloqueado       boolean not null default false,
  add column if not exists motivo_bloqueio text;

-- 2) Valores travados dos novos campos (permitem NULL) -----------------
alter table public.ordens_servico drop constraint if exists chk_os_tipo_cliente;
alter table public.ordens_servico add constraint chk_os_tipo_cliente
  check (tipo_cliente is null or tipo_cliente in
    ('seguradora','cooperativa','particular'));

alter table public.ordens_servico drop constraint if exists chk_os_etapa_atual;
alter table public.ordens_servico add constraint chk_os_etapa_atual
  check (etapa_atual is null or etapa_atual in
    ('Desmontagem','Funilaria','Preparacao','Pintura',
     'Polimento','Montagem','Qualidade','Entrega'));

alter table public.ordens_servico drop constraint if exists chk_os_motivo_bloqueio;
alter table public.ordens_servico add constraint chk_os_motivo_bloqueio
  check (motivo_bloqueio is null or motivo_bloqueio in
    ('aguardando_peca','em_outro_setor','aguardando_aprovacao','aguardando_cura'));

-- 3) Índices para o painel do dono (prazo) e para o kanban (etapa) ------
create index if not exists idx_os_data_prometida on public.ordens_servico (data_prometida);
create index if not exists idx_os_etapa_atual     on public.ordens_servico (etapa_atual);

commit;
