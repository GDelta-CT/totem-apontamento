-- =====================================================================
-- Migration 009 — Captura do ISOLAMENTO multi-tenant em codigo (versionar)
-- >>> ALVO: TESTE  (ref pvrnimckfgdmgjrjueap, Sao Paulo)
--
-- CAPTURA fiel (introspeccao SO-LEITURA em 2026-06-02) dos objetos que ate
-- agora viviam SOMENTE no banco e NAO estavam no repo. Versiona-los garante
-- que, se o banco for recriado, o isolamento por oficina_id se mantem.
--
-- >>> APLICAR exige aprovacao do fundador (toca auth/isolamento: CREATE FUNCTION/
-- >>> TRIGGER + GRANT + POLICY). NAO RODAR EM PRODUCAO (ref ccpxwnbxvmadcafxnbjs).
-- >>> OBS: no TESTE estes objetos JA EXISTEM — aplicar aqui e idempotente (no-op).
-- >>>      O valor desta migration e o controle de versao / recuperacao de desastre.
-- Rollback: supabase/rollbacks/009_rollback.sql  (CUIDADO: remove o isolamento)
-- =====================================================================

begin;

-- ----------------------------------------------------------------------
-- (A) WRITE-SIDE: carimba oficina_id (vindo do JWT) em todo INSERT das
--     tabelas-base. Sem isto, INSERTs autenticados gravam oficina_id nulo.
-- ----------------------------------------------------------------------
create or replace function public.set_oficina_id_from_jwt()
returns trigger
language plpgsql
as $$
begin
  if new.oficina_id is null then
    new.oficina_id := (auth.jwt() ->> 'oficina_id')::uuid;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_oficina_id on public.apontamentos;
create trigger trg_set_oficina_id before insert on public.apontamentos
  for each row execute function public.set_oficina_id_from_jwt();

drop trigger if exists trg_set_oficina_id on public.funcionarios;
create trigger trg_set_oficina_id before insert on public.funcionarios
  for each row execute function public.set_oficina_id_from_jwt();

drop trigger if exists trg_set_oficina_id on public.ordens_servico;
create trigger trg_set_oficina_id before insert on public.ordens_servico
  for each row execute function public.set_oficina_id_from_jwt();

drop trigger if exists trg_set_oficina_id on public.pontos_eletronicos;
create trigger trg_set_oficina_id before insert on public.pontos_eletronicos
  for each row execute function public.set_oficina_id_from_jwt();

-- ----------------------------------------------------------------------
-- (B) READ-SIDE: Custom Access Token Hook — injeta oficina_id + oficina_role
--     no JWT a cada login, lendo public.user_oficinas.
-- ----------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_oficina uuid;
  v_role text;
begin
  select oficina_id, role into v_oficina, v_role
  from public.user_oficinas
  where user_id = (event->>'user_id')::uuid
  order by criado_em
  limit 1;

  claims := event->'claims';
  if v_oficina is not null then
    claims := jsonb_set(claims, '{oficina_id}',   to_jsonb(v_oficina::text));
    claims := jsonb_set(claims, '{oficina_role}', to_jsonb(v_role));
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- O hook roda como supabase_auth_admin; precisa EXECUTAR a funcao e LER user_oficinas.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.user_oficinas to supabase_auth_admin;

drop policy if exists auth_admin_read_user_oficinas on public.user_oficinas;
create policy auth_admin_read_user_oficinas on public.user_oficinas
  as permissive for select
  to supabase_auth_admin
  using (true);

commit;

-- ----------------------------------------------------------------------
-- (C) PASSO MANUAL (NAO e SQL) — registrar o hook no painel do Supabase:
--     Authentication > Hooks > "Custom Access Token" > selecionar
--     public.custom_access_token_hook
--     Sem esse registro, logins novos NAO recebem oficina_id no JWT.
--     (No TESTE ja esta registrado; este lembrete e para recriar o ambiente.)
-- ----------------------------------------------------------------------
