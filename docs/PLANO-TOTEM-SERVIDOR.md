# Plano — Passo 2 do server-move: TOTEM no servidor

> Produzido pelo backend-architect em 2026-06-03. **Read-only/design** — não implementado.
> O totem é a tela MAIS crítica (adoção do operário): revisar + testar em tablet antes de
> implementar. Manter o totem funcionando a cada passo é **sagrado**.

## Objetivo

Mover as **ESCRITAS** do totem (iniciar/pausar/retomar/finalizar apontamento + o `update` de
`etapa_atual`) e o **recovery** do navegador para o **servidor**, via Server Actions com
`requireDevice()`. Fecha o último vetor de escrita que o tablet podia explorar (o
`etapa_atual`, apontado pelo DB-audit), sem tirar nenhum toque do operário.

## Padrão escolhido (confiança: alta)

**Client component (como hoje) + Server Actions** — espelho de `admin-actions.ts`, trocando
`requireGestor` por `requireDevice` (já existe no DAL). Não usar RSC: o totem é imperativo
(reage a toques), e Server Action chamada do handler preserva o fluxo de **2 toques** exato.

- **Leituras que FICAM no cliente neste passo:** `useFuncionariosAtivos`, `buscarOSPorPlaca`.
  Já são seguras (RLS via cookie); mover = ganho marginal de segurança e risco alto na tela
  crítica. Migram depois, sem pressa (ou viram RSC num passo cosmético).
- **Recovery (`buscarApontamentoAtivo`) MIGRA junto:** é a leitura mais sensível (anti-
  duplicação) e tem regra de negócio (exclui correções). Vira action de leitura com
  `requireDevice` + a mesma degradação graciosa de hoje.

## Arquivos

- **CRIAR** `src/lib/supabase/totem-actions.ts` (`'use server'`): `iniciarApontamentoAction`
  (insert + update etapa_atual), `pausarApontamentoAction`, `retomarApontamentoAction`,
  `finalizarApontamentoAction`, `iniciarRecoveryAction`. Cada uma: `requireDevice()` primeiro,
  `withTimeout(8s)`, retorna `FetchState<T>`, reusa o `traduzirErro` do totem. Helper
  `exigirDeviceOuErro()` traduz sessão expirada sem deixar a exceção estourar.
- **ALTERAR** `src/app/totem/page.tsx`: trocar os imports das escritas+recovery de
  `queries.ts` para `totem-actions.ts` (mesmas assinaturas — handlers não mudam de lógica;
  exceção: `retomar`/`finalizar` passam a receber só `apontamentoId`). + o try/catch de
  conectividade (abaixo).
- **MANTER** `queries.ts`: hooks de UI (`useCronometro` etc.), `normalizarPlaca`,
  `parseISOComUTC`, e as leituras que ficam. Funções migradas ficam (não importadas) durante
  a transição → revert por import.

## Relógio do servidor (migration 011) — **GATED**

**Recomendado:** aplicar a **011** (RPCs `fn_pausar/retomar/finalizar_apontamento`,
`SECURITY DEFINER`) **no teste** e usar os RPCs em pausar/retomar/finalizar → `now()` canônico
do Postgres (fonte única). `iniciar` não precisa (`hora_inicio DEFAULT now()`).
⚠️ A 011 cria FUNCTION + GRANT EXECUTE = **mudança de permissões** → **PARAR e pedir OK do
fundador** antes de aplicar (regra do CLAUDE.md; o próprio cabeçalho da 011 exige).

**Alternativa 2b (sem 011):** mover as escritas mantendo `new Date()` dentro da action
(relógio do servidor de app — melhor que o do tablet). Fecha o vetor de segurança do
`etapa_atual` já; deixa o relógio canônico (RPCs) para um Passo 2b quando a 011 for aprovada.

## Conectividade (requisito TRAVADO) — o elo mais fraco

"Não perder ação em queda de conexão; mostrar 'não salvou, tenta de novo'." Server Action é um
fetch POST: se o tablet está offline, o fetch **rejeita no cliente** (antes da action
responder). **Obrigatório (sub-passo 2.4):** envolver cada `await ...Action()` nos handlers do
`page.tsx` num `try/catch` que converte a rejeição em `{status:'error', message:'Sem
conexão…'}` e **NÃO avança de tela**. `withTimeout(8s)` mantido. (Sync offline = Fase 2.)

## Sessão do device no kiosk (confirmado)

O cookie persiste/renova sem relogin: `client.ts` usa `createBrowserClient` com
`persistSession`/`autoRefreshToken`; `proxy.ts` renova o token a cada request e cobre `/totem`
(matcher do app todo). Risco residual leve: tablet horas ocioso sem request → só o
`autoRefreshToken` do client renova (refresh-token tem validade longa). Heartbeat opcional =
Fase 2.

## Ordem incremental (totem funcionando a cada passo; revert por import)

| # | Sub-passo | Reversão |
|---|---|---|
| 2.0 | **PARAR** e pedir ao fundador o OK pra aplicar a 011 no teste (mostrar diff) | — (decisão) |
| 2.1 | Aplicar a 011 **só no teste**; verificar funções + EXECUTE. Não toca `.ts` ainda | `011_rollback.sql` |
| 2.2 | Criar `totem-actions.ts` (arquivo "morto", não importado) | apagar o arquivo |
| 2.3 | Trocar **UMA** escrita por vez no `page.tsx`: pausar → retomar → finalizar → iniciar(+etapa) → recovery. Testar no tablet entre cada | reverter o import |
| 2.4 | `try/catch` de offline nos handlers (obrigatório) | remover o try/catch |
| 2.5 | (opcional) limpar funções mortas; promover `useFuncionariosAtivos` a RSC | restaurar |

**Maior risco:** trocar o import na tela de maior adoção → mitigado por 1-de-cada-vez + teste
no tablet + revert por import. `iniciar`(+`etapa_atual`) por penúltimo, depois que
pausar/retomar/finalizar provarem o `requireDevice` no tablet.

## Checklist de teste em TABLET real

1. Abre o totem → cai na lista de funcionários sem pedir login (sessão viva).
2. Nome → placa `ABC1D23` → etapa → cronômetro. Contar toques: igual a hoje (≤2 nas ações comuns).
3. Banco: apontamento criado com `hora_inicio` = hora do **servidor**; `etapa_atual` mudou.
4. **Mudar a hora do tablet** (+2h); pausar → `pausado_em` = hora do **servidor**, não a do tablet.
5. Retomar → `tempo_pausado_seg` coerente com o tempo real parado.
6. Finalizar → `hora_fim` = servidor; some das ativas. Finalizar pausado → última pausa conta.
7. Recovery: iniciar, fechar sem finalizar, reabrir, tocar no nome → cai em "trabalhando" (não duplica).
8. **Modo avião** → iniciar/pausar/finalizar → aviso "Sem conexão, tenta de novo"; tela **não avança**. Religar → retry completa.
9. Manhã→tarde com o tablet logado → não pede login de novo.
10. Isolamento: só vê funcionários/OS da própria oficina. Alvos de toque grandes; cronômetro anima.

## Decisão que exige o fundador

Aplicar a **011** no teste (permissões/EXECUTE). Sem esse "sim", só o caminho 2b (sem 011)
avança. Ver também `docs/PLANO-RELOGIO-SERVIDOR.md`.
