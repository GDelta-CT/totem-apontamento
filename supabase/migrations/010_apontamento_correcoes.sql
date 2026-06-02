-- =====================================================================
-- Migration 010 — Trilha de correcao de anomalia (APPEND-ONLY, auditavel)
-- >>> ALVO: TESTE (ref pvrnimckfgdmgjrjueap, Sao Paulo). NUNCA em producao.
--
-- ADITIVA: cria a tabela apontamento_correcoes + RLS + trigger de oficina_id.
-- Substitui o caminho DESTRUTIVO (UPDATE no apontamento, habilitado pela 006):
-- a correcao do admin passa a ser um ACRESCIMO (INSERT), e o apontamento bruto
-- (hora_inicio/hora_fim/status) NUNCA e sobrescrito pela correcao. A flag
-- editado_admin (ja criada na 006) vira so MARCADOR de "tem correcao".
--
-- >>> APLICAR exige aprovacao do fundador (cria tabela + RLS + grants + trigger).
-- >>> Depende da 009 (funcao set_oficina_id_from_jwt) — ja existe no banco.
-- Rollback: supabase/rollbacks/010_rollback.sql
-- =====================================================================

begin;

create table if not exists public.apontamento_correcoes (
  id             uuid primary key default gen_random_uuid(),
  apontamento_id uuid not null references public.apontamentos(id) on delete cascade,
  oficina_id     uuid not null,                       -- carimbado pelo trigger do JWT
  admin_user_id  uuid not null default auth.uid(),    -- QUEM corrigiu
  corrigido_em   timestamptz not null default now(),  -- QUANDO (relogio do servidor)
  acao           text not null check (acao in ('ajustar_fim','descartar','confirmar')),
  valor_original jsonb,                                -- o "antes" (foto do bruto)
  valor_corrigido jsonb,                               -- o "depois" (vazio em descartar)
  motivo         text not null check (length(btrim(motivo)) > 0),  -- OBRIGATORIO
  motivo_codigo  text check (motivo_codigo in
                   ('esqueceu_parar','saiu_sem_registrar','erro_toque','outro'))
);

create index if not exists idx_apont_correcoes_apont   on public.apontamento_correcoes(apontamento_id);
create index if not exists idx_apont_correcoes_oficina on public.apontamento_correcoes(oficina_id);

-- Carimbo de oficina_id (mesmo trigger/funcao das tabelas-base; depende da 009).
drop trigger if exists trg_set_oficina_id on public.apontamento_correcoes;
create trigger trg_set_oficina_id
  before insert on public.apontamento_correcoes
  for each row execute function public.set_oficina_id_from_jwt();

-- RLS: habilitar + forcar (padrao do projeto).
alter table public.apontamento_correcoes enable row level security;
alter table public.apontamento_correcoes force row level security;

-- Leitura: somente a propria oficina.
create policy "correcoes_isolation_select"
  on public.apontamento_correcoes for select to authenticated
  using (oficina_id = (auth.jwt() ->> 'oficina_id')::uuid);

-- Escrita (INSERT): somente a propria oficina E papel gerente/dono.
-- (Sem policy de UPDATE/DELETE = append-only: a trilha nunca e alterada/apagada.)
create policy "correcoes_insert_admin"
  on public.apontamento_correcoes for insert to authenticated
  with check (
    oficina_id = (auth.jwt() ->> 'oficina_id')::uuid
    and (auth.jwt() ->> 'oficina_role') in ('gerente','dono')
  );

grant select, insert on public.apontamento_correcoes to authenticated;

commit;
