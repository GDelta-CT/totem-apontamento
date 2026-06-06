# Plano — #2 "OS como Container" (um apontamento ativo por operário)

> Status: **PROPOSTA — aguardando OK do fundador.** GATED (cria FUNCTION + GRANT
> EXECUTE + índice ÚNICO + limpeza de dados). Só TESTE (pvrnimckfgdmgjrjueap).
> Produção intocada. Apresentar o diff da migration antes de aplicar.

## O furo (hoje)

`src/lib/supabase/queries.ts:217` — `iniciarApontamento` só faz `INSERT` de um
timer novo (`status_tarefa = 'Em andamento'`). **Nunca pausa/fecha o timer
anterior do MESMO operário.** Resultado:

- Operário começa 2ª tarefa (ou dá toque duplo, ou esquece de finalizar) → fica
  com **2+ timers 'Em andamento' ao mesmo tempo**.
- O **tempo trabalhado conta em dobro** (cada timer soma o relógio ao vivo).
- O painel do dono mostra **horas infladas** → decisão errada sobre produtividade.
- A regra do CLAUDE.md _"Um apontamento ativo por operário (iniciar outro pausa o
  atual)"_ **não está implementada em lugar nenhum** (nem código, nem banco).

## "OS como Container" (o alvo)

- Um carro (OS) pode ter **VÁRIOS timers ao mesmo tempo — um por operário
  DIFERENTE** (dois mecânicos no mesmo carro = OK, é o objetivo do produto).
- Cada operário tem **no máximo UM timer 'Em andamento'** por vez, em qualquer
  carro. Começar outro **pausa o dele** — sem encostar nos timers dos OUTROS.
- "Último que iniciou vence" seta a coluna do kanban (`etapa_atual`); o card
  mostra TODOS os timers ativos do carro.

## A solução (mesmo padrão da migration 011, já aprovada e no ar)

A 011 criou 3 RPCs server-side (`fn_pausar/retomar/finalizar`) — `SECURITY
DEFINER`, isoladas pela oficina do JWT, relógio do servidor. O #2 é **mais uma no
mesmo molde**:

### 1) Nova RPC `fn_iniciar_apontamento(...)` — atômica, no servidor

Numa transação só:

1. Acha o(s) timer(s) **'Em andamento' do MESMO operário** (`nome_funcionario`)
   **nesta oficina** e PAUSA (server `now()`, acumula `tempo_pausado_seg`,
   `motivo_pausa = 'troca_tarefa'`).
2. INSERE o novo apontamento (`'Em andamento'`, `hora_inicio = now()` do servidor).
3. Seta `ordens_servico.etapa_atual = nova etapa` (último-que-iniciou-vence) na
   mesma transação.
4. Retorna a linha nova.

Parâmetros: `p_os_id, p_nome, p_cargo, p_etapa, p_retrabalho, p_complexidade`.
Isolamento: `oficina_id` do JWT (idêntico à 011). `search_path` fixo
(`public, pg_temp`).

### 2) Rede de segurança no banco — índice único parcial

```sql
create unique index uq_apontamento_ativo_por_operario
  on public.apontamentos (oficina_id, nome_funcionario)
  where status_tarefa = 'Em andamento';
```

- Garante **no banco**: ≤ 1 timer rodando por operário/oficina, mesmo se o app
  falhar (toque duplo, corrida, retry offline).
- Permite **vários 'Pausado'** (o `WHERE` só restringe 'Em andamento').
- Permite **vários operários no mesmo carro** (a chave é por nome, não por carro).

### 3) Limpeza única dos dados (antes de criar o índice)

Se já existir operário com 2+ timers 'Em andamento' (resíduo do bug), o índice
falha ao criar. A migration primeiro **pausa os duplicados mais antigos**
(mantém o mais recente rodando), preservando o tempo. Idempotente.

### 4) Código (.ts)

`iniciarApontamento` passa a chamar `supabase.rpc('fn_iniciar_apontamento', {…})`
em vez do `INSERT` cru — exatamente como `pausar/retomar/finalizar` já fazem. O
fluxo do totem e a UI **não mudam** (recebe a linha nova igual).

## Decisões de domínio (confirmar)

1. **Pausar vs finalizar o timer anterior:** ao começar nova tarefa, o timer
   anterior do operário é **PAUSADO** (preserva, dá pra retomar) — não finalizado.
   (CLAUDE.md: _"pausa o atual"_.) Motivo = "troca de tarefa". **Recomendo PAUSAR.**
2. **Identidade = nome** (piloto sem PIN). Dois funcionários não podem ter o mesmo
   nome (o admin gere o cadastro). OK no piloto.
3. **Pausas penduradas:** um operário pode juntar vários 'Pausado' ao longo do dia
   (trocou de carro várias vezes). Ficam congelados (não contam tempo ao vivo) até
   retomar/finalizar. Aceitável — não infla nada. (Fase 2: o admin ver/fechar as
   "pausadas penduradas".)

## Segurança / gating

- **GATED:** cria FUNCTION + GRANT EXECUTE + índice ÚNICO + limpeza de dados.
  Apresentar o **diff da migration** antes de aplicar. **Só TESTE**
  (`pvrnimckfgdmgjrjueap`). Produção (`ccpxwnbxvmadcafxnbjs`) intocada.
- **Reversível:** rollback dropa a função + o índice; o código volta pro `INSERT`.
- **Totem segue funcionando:** a RPC devolve a linha nova igual ao `INSERT`.
- **Verificação pós-aplicação:** (a) iniciar tarefa funciona; (b) começar 2ª
  tarefa do mesmo operário pausa a 1ª; (c) dois operários no mesmo carro rodam
  juntos; (d) toque duplo não cria 2 ativos.

## Sub-item do "Container" (verificar)

Confirmar que o card na visão de produção (`/admin/producao`) mostra TODOS os
timers ativos do carro, não só um. Se não, é ajuste de leitura/UI pequeno (sem
migration).

## Fluxo de execução (AIOX) — depois do OK

Aprovado → `backend-forge` implementa a migration + o swap no código (serializado,
um executor) → auditores read-only (`build-verifier`, `security-auditor` confere o
isolamento da nova RPC, `code-reviewer` no diff) → eu reviso → push (com seu OK).
