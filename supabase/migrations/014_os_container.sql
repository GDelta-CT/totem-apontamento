-- =====================================================================
-- Migration 014 — OS como Container: UM apontamento ativo por operário (P1 #2)
-- >>> ALVO: TESTE (ref pvrnimckfgdmgjrjueap, São Paulo). NUNCA em produção
-- >>>       (ref ccpxwnbxvmadcafxnbjs).
--
-- >>> NÃO APLICAR SEM APROVAÇÃO EXPLÍCITA DO FUNDADOR <<<
--   Cria FUNCTION SECURITY DEFINER + GRANT EXECUTE + ÍNDICE ÚNICO parcial +
--   limpeza única de dados (pausa duplicados ativos). Mexe em permissão de
--   execução e adiciona constraint. Aprovação é por ambiente. A IA PARA E
--   PERGUNTA antes de aplicar — não infere de notas.
--
-- PROBLEMA QUE RESOLVE
--   Hoje iniciarApontamento (src/lib/supabase/queries.ts) só faz INSERT — NÃO
--   pausa o timer anterior do MESMO operário. Resultado: começar 2ª tarefa (ou
--   toque duplo) deixa 2+ apontamentos 'Em andamento' do mesmo operário ao mesmo
--   tempo → TEMPO TRABALHADO CONTA EM DOBRO. O CLAUDE.md manda "Um apontamento
--   ativo por operário (iniciar outro pausa o atual)" — nunca foi implementado.
--
-- "OS COMO CONTAINER"
--   Um carro (OS) PODE ter vários apontamentos ativos — UM por operário DIFERENTE
--   (dois mecânicos no mesmo carro = OK). A trava é POR OPERÁRIO (nome_funcionario),
--   não por carro: começar nova tarefa pausa só o timer DAQUELE operário.
--
-- O QUE FAZ (aditivo / idempotente)
--   (1) LIMPEZA única: para cada (oficina_id, nome_funcionario) com >1 'Em
--       andamento', mantém o mais recente e PAUSA os demais (motivo 'troca_tarefa',
--       pausado_em=now()) — senão o índice único (3) falharia ao criar.
--   (2) RPC fn_iniciar_apontamento(...): numa transação só — VALIDA que a OS é da
--       oficina do JWT (guard anti FK cross-tenant), PAUSA o 'Em andamento' do mesmo
--       operário (server now()), INSERE o novo ('Em andamento', now()), seta
--       ordens_servico.etapa_atual (último-que-iniciou-vence) e devolve a linha.
--   (3) ÍNDICE ÚNICO parcial: no máximo 1 'Em andamento' por (oficina_id,
--       nome_funcionario) — rede de segurança no banco (toque duplo / corrida).
--       Permite vários 'Pausado'; permite vários operários no mesmo carro.
--
-- ISOLAMENTO (multi-tenant) — idêntico à 011
--   SECURITY DEFINER → o RLS não filtra sozinho; a função restringe no WHERE à
--   oficina do JWT (auth.jwt()->>'oficina_id') E carimba oficina_id explícito no
--   INSERT. Sem oficina no JWT → no-op seguro (NULL). search_path fixo
--   (public, pg_temp) — defesa contra hijack de search_path em SECURITY DEFINER.
--
-- GRANTS: EXECUTE para `authenticated` (totem/admin rodam autenticados, com
--   oficina_id no JWT) + `anon` por compatibilidade pré-lockdown (007): sem
--   oficina no JWT a função é no-op e não vaza. Mesmo critério da 011.
-- DEPENDE DE: 002 (schema/RLS apontamentos), 009 (trigger oficina_id), 011 (padrão).
-- NÃO mexe em: GRANTs de tabela, políticas RLS, schema (nenhuma coluna nova).
-- Rollback: supabase/rollbacks/014_rollback.sql
--
-- ---------------------------------------------------------------------
-- PLANO DA MUDANÇA DE CÓDIGO (.ts) — APLICAR DEPOIS, em diff separado:
--   • src/lib/supabase/queries.ts — iniciarApontamento passa a chamar
--     supabase.rpc('fn_iniciar_apontamento', { p_os_id, p_nome, p_cargo, p_etapa,
--     p_retrabalho, p_complexidade }) em vez do INSERT cru + update de etapa_atual.
--   • src/lib/supabase/client.ts — adicionar 'troca_tarefa' em MotivoPausaId +
--     MOTIVOS_PAUSA (rótulo "Trocou de tarefa") para a UI nomear a auto-pausa.
--   Os hooks de UI (useCronometro) seguem usando o relógio local só para a
--   contagem visual; a VERDADE gravada vem do servidor.
-- =====================================================================

begin;

-- ----------------------------------------------------------------------
-- (1) LIMPEZA única: pausa duplicados 'Em andamento' do mesmo operário,
--     mantendo o MAIS RECENTE. Sem isto, o índice único (3) falha ao criar se
--     já houver duplicata (resíduo do bug atual). Idempotente.
-- ----------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by oficina_id, nome_funcionario
           order by hora_inicio desc, id desc
         ) as rn
  from public.apontamentos
  where status_tarefa = 'Em andamento'
)
update public.apontamentos a
   set status_tarefa = 'Pausado',
       motivo_pausa  = 'troca_tarefa',
       pausado_em    = now()
  from ranked r
 where a.id = r.id
   and r.rn > 1;

-- ----------------------------------------------------------------------
-- (2) RPC: inicia um apontamento pausando o ATIVO anterior DO MESMO operário.
--     Atômica (uma transação). Relógio do servidor. Isolada por oficina do JWT.
-- ----------------------------------------------------------------------
create or replace function public.fn_iniciar_apontamento(
  p_os_id        uuid,
  p_nome         text,
  p_cargo        text,
  p_etapa        text,
  p_retrabalho   boolean,
  p_complexidade text
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

  -- GUARD multi-tenant: a OS precisa ser DESTA oficina. Sem isto, um p_os_id de
  -- OUTRA oficina criaria um apontamento com FK órfã cross-tenant (achado Médio da
  -- auditoria — integridade, não vazamento). No-op seguro se a OS não for daqui.
  if not exists (
    select 1 from public.ordens_servico
     where id = p_os_id and oficina_id = v_oficina
  ) then
    return null;
  end if;

  -- (a) pausa o(s) 'Em andamento' DESTE operário NESTA oficina (server now()).
  --     NÃO toca em outros operários: é o "Container" (vários mecânicos no carro).
  update public.apontamentos
     set status_tarefa = 'Pausado',
         motivo_pausa  = 'troca_tarefa',
         pausado_em    = now()
   where oficina_id       = v_oficina
     and nome_funcionario = p_nome
     and status_tarefa    = 'Em andamento';

  -- (b) cria o novo apontamento. oficina_id EXPLÍCITO (defesa dupla, além do
  --     trigger 009). hora_inicio vem do DEFAULT now() (servidor).
  insert into public.apontamentos (
    oficina_id, ordem_servico_id, nome_funcionario, cargo_funcionario,
    status_tarefa, etapa, retrabalho, complexidade, tempo_pausado_seg
  ) values (
    v_oficina, p_os_id, p_nome, p_cargo,
    'Em andamento', p_etapa, p_retrabalho, p_complexidade, 0
  )
  returning * into v_row;

  -- (c) "último que iniciou vence": alinha a coluna do kanban da OS (mesma
  --     oficina). Best-effort dentro da transação; a OS é a mesma do apontamento.
  update public.ordens_servico
     set etapa_atual = p_etapa
   where id = p_os_id
     and oficina_id = v_oficina;

  return v_row;  -- NULL só se v_oficina nulo (tratado acima)
end;
$$;

-- ----------------------------------------------------------------------
-- (3) ÍNDICE ÚNICO parcial: ≤ 1 'Em andamento' por (oficina_id, nome_funcionario).
--     Rede de segurança no BANCO (toque duplo / corrida / retry). Permite vários
--     'Pausado' (cláusula WHERE) e vários operários no mesmo carro (chave por nome).
-- ----------------------------------------------------------------------
create unique index if not exists uq_apontamento_ativo_por_operario
  on public.apontamentos (oficina_id, nome_funcionario)
  where status_tarefa = 'Em andamento';

-- ----------------------------------------------------------------------
-- (4) GRANTS de execução (mesmo critério da 011: revoga de public, concede aos
--     papéis do app).
-- ----------------------------------------------------------------------
revoke execute on function public.fn_iniciar_apontamento(uuid, text, text, text, boolean, text) from public;
grant  execute on function public.fn_iniciar_apontamento(uuid, text, text, text, boolean, text) to authenticated, anon;

commit;
