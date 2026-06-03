-- =====================================================================
-- Migration 011 — Relógio do SERVIDOR para pausa/retomada/fim (P2)
-- >>> ALVO: TESTE (ref pvrnimckfgdmgjrjueap, São Paulo). NUNCA em produção
-- >>>       (ref ccpxwnbxvmadcafxnbjs).
--
-- >>> NÃO APLICAR SEM APROVAÇÃO EXPLÍCITA DO FUNDADOR <<<
--   Cria FUNCTIONs SECURITY DEFINER + GRANT EXECUTE. Mexe em permissões de
--   execução (não em GRANTs de tabela, não em RLS). Aprovação é por ambiente.
--   A IA PARA E PERGUNTA antes de aplicar — não infere de notas.
--
-- PROBLEMA QUE RESOLVE
--   Hoje pausa/retomada/fim/correção gravam o tempo com o relógio do TABLET
--   (new Date().toISOString() no browser — ver src/lib/supabase/queries.ts:
--   pausarApontamento / retomarApontamento / finalizarApontamento; e
--   src/lib/supabase/anomalias-queries.ts: registrarCorrecao). O CLAUDE.md manda:
--   "Tempos ancorados no relógio do SERVIDOR, nunca do tablet". hora_inicio já é
--   DEFAULT now() (servidor); o GAP é pausado_em / hora_fim / tempo_pausado_seg.
--
-- O QUE FAZ (aditivo / idempotente — create or replace)
--   3 RPCs que carimbam o tempo com now() do SERVIDOR e devolvem a linha:
--     • fn_pausar_apontamento(p_id, p_motivo) -> status='Pausado',
--         motivo_pausa=p_motivo, pausado_em=now().
--     • fn_retomar_apontamento(p_id)         -> tempo_pausado_seg += epoch(now()-pausado_em),
--         status='Em andamento', motivo_pausa=null, pausado_em=null.
--     • fn_finalizar_apontamento(p_id)        -> status='Finalizado', hora_fim=now();
--         se estava 'Pausado', acumula a última janela de pausa antes de fechar.
--   tempo_pausado_seg passa a ser DERIVADO no banco (não mais somado no browser).
--
-- ISOLAMENTO (multi-tenant)
--   SECURITY DEFINER roda como o DONO da função, então o RLS NÃO filtra sozinho.
--   Por isso cada função restringe no WHERE à oficina do JWT
--   (auth.jwt() ->> 'oficina_id'). Sem JWT válido / oficina nula -> ZERO linhas
--   afetadas, devolve NULL, e o chamador trata como erro. search_path fixo
--   (public, pg_temp) — defesa contra hijack de search_path em SECURITY DEFINER.
--
-- GRANTS
--   EXECUTE para `authenticated` (totem e admin rodam autenticados, com
--   oficina_id no JWT — Fase 1 / DeviceAuthGate / AdminAuthGate). Também para
--   `anon` por compatibilidade durante a transição pré-lockdown (007): se a
--   oficina do JWT vier nula, a função não acha linha e é no-op segura — não
--   vaza nada. Pós-lockdown o `anon` puro não tem JWT de oficina e segue inócuo.
--
-- DEPENDE DE: 002 (colunas/RLS de apontamentos), 006 (grant UPDATE — embora a
--   função use o privilégio do DEFINER, manter o grant não atrapalha).
-- NÃO mexe em: GRANTs de tabela, políticas RLS, schema (nenhuma coluna nova).
-- Rollback: supabase/rollbacks/011_rollback.sql
--
-- ---------------------------------------------------------------------
-- PLANO DA MUDANÇA DE CÓDIGO (.ts) — APLICAR DEPOIS, em diff separado:
--   Ver docs/PLANO-RELOGIO-SERVIDOR.md. Resumo:
--     • pausarApontamento  -> supabase.rpc('fn_pausar_apontamento', {p_id, p_motivo})
--         em vez de .update({ pausado_em: new Date()... }).
--     • retomarApontamento -> supabase.rpc('fn_retomar_apontamento', {p_id})
--         em vez de calcular segundosPausados com Date.now() no browser.
--     • finalizarApontamento -> supabase.rpc('fn_finalizar_apontamento', {p_id})
--         em vez de .update({ hora_fim: new Date()... }).
--     • registrarCorrecao (ajustar_fim) -> usar fn_finalizar_apontamento OU uma
--         RPC futura de correção; o "depois" deixa de usar new Date() no browser.
--   Os hooks de UI (useCronometro/useTempoPausado) continuam usando o relógio
--   local SÓ para a contagem visual ao vivo — a VERDADE gravada vem do servidor.
-- =====================================================================

begin;

-- ----------------------------------------------------------------------
-- (1) PAUSAR — carimba pausado_em com now() do servidor.
-- ----------------------------------------------------------------------
create or replace function public.fn_pausar_apontamento(
  p_id uuid,
  p_motivo text
)
returns public.apontamentos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oficina uuid := (auth.jwt() ->> 'oficina_id')::uuid;
  v_row public.apontamentos;
begin
  if v_oficina is null then
    return null;  -- sem oficina no JWT: no-op seguro (não vaza, não grava)
  end if;

  update public.apontamentos
     set status_tarefa = 'Pausado',
         motivo_pausa  = p_motivo,
         pausado_em    = now()           -- <<< relógio do SERVIDOR
   where id = p_id
     and oficina_id = v_oficina          -- isolamento explícito (SECURITY DEFINER)
     and status_tarefa = 'Em andamento'  -- só pausa o que está rodando
  returning * into v_row;

  return v_row;  -- NULL se nada bateu (id de outra oficina / não estava em andamento)
end;
$$;

-- ----------------------------------------------------------------------
-- (2) RETOMAR — acumula a janela de pausa (epoch no servidor) e volta a rodar.
--     tempo_pausado_seg passa a ser DERIVADO aqui (não somado no browser).
-- ----------------------------------------------------------------------
create or replace function public.fn_retomar_apontamento(
  p_id uuid
)
returns public.apontamentos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oficina uuid := (auth.jwt() ->> 'oficina_id')::uuid;
  v_row public.apontamentos;
begin
  if v_oficina is null then
    return null;
  end if;

  update public.apontamentos
     set tempo_pausado_seg =
           coalesce(tempo_pausado_seg, 0)
           + greatest(0, floor(extract(epoch from (now() - pausado_em)))::int),  -- <<< servidor
         status_tarefa = 'Em andamento',
         motivo_pausa  = null,
         pausado_em    = null
   where id = p_id
     and oficina_id = v_oficina
     and status_tarefa = 'Pausado'
     and pausado_em is not null  -- precisa estar pausado com carimbo de início da pausa
  returning * into v_row;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------
-- (3) FINALIZAR — carimba hora_fim com now() do servidor. Se estava PAUSADO,
--     fecha a última janela de pausa antes (rede de segurança), igual ao que o
--     browser fazia em finalizarApontamento, mas com o relógio do servidor.
-- ----------------------------------------------------------------------
create or replace function public.fn_finalizar_apontamento(
  p_id uuid
)
returns public.apontamentos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oficina uuid := (auth.jwt() ->> 'oficina_id')::uuid;
  v_row public.apontamentos;
begin
  if v_oficina is null then
    return null;
  end if;

  update public.apontamentos
     set tempo_pausado_seg =
           coalesce(tempo_pausado_seg, 0)
           + case
               when status_tarefa = 'Pausado' and pausado_em is not null
               then greatest(0, floor(extract(epoch from (now() - pausado_em)))::int)  -- <<< servidor
               else 0
             end,
         status_tarefa = 'Finalizado',
         hora_fim      = now(),          -- <<< relógio do SERVIDOR
         pausado_em    = null
   where id = p_id
     and oficina_id = v_oficina
     and status_tarefa in ('Em andamento', 'Pausado')  -- não re-finaliza nem corrige fantasma encerrado
  returning * into v_row;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------
-- (4) GRANTS de execução. (Revoga de public para não deixar EXECUTE aberto a
--     todos por padrão; concede só aos papéis do app.)
-- ----------------------------------------------------------------------
revoke execute on function public.fn_pausar_apontamento(uuid, text) from public;
revoke execute on function public.fn_retomar_apontamento(uuid)      from public;
revoke execute on function public.fn_finalizar_apontamento(uuid)    from public;

grant execute on function public.fn_pausar_apontamento(uuid, text)  to authenticated, anon;
grant execute on function public.fn_retomar_apontamento(uuid)       to authenticated, anon;
grant execute on function public.fn_finalizar_apontamento(uuid)     to authenticated, anon;

commit;
