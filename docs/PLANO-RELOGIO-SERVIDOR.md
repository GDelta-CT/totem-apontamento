# Plano — Relógio do servidor (P2)

> Estado: migration **escrita, NÃO aplicada**. Código `.ts` **NÃO alterado** ainda.
> Este doc descreve o que muda no código **depois** que o fundador aprovar o apply da
> migration `011`. Um passo de cada vez, reversível.

## O problema, em uma frase

Hoje, quando o operário **pausa** ou **finaliza** uma tarefa no totem, a hora gravada vem do
**relógio do tablet** (o navegador faz `new Date()`). Se o tablet estiver com a hora errada,
o tempo fica errado. A regra do projeto (CLAUDE.md) é clara: **"tempos ancorados no relógio do
servidor, nunca do tablet"**. O início (`hora_inicio`) já usa o servidor; o que falta consertar
é **pausa**, **retomada**, **fim** e a **correção** do admin.

## A correção, em uma frase

Mover o "carimbo de hora" para **dentro do banco** (funções RPC que usam o `now()` do
servidor). O totem deixa de mandar a hora; ele só diz **"pausa este apontamento"** e o banco
preenche a hora certa. O contador que aparece na tela continua usando a hora local **só para a
animação ao vivo** — a verdade que fica salva passa a ser sempre do servidor.

## O que a migration 011 cria (já escrita)

Três funções no banco (`supabase/migrations/011_relogio_servidor.sql`):

| Função                             | O que faz                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `fn_pausar_apontamento(id, motivo)`| Marca `Pausado`, grava o motivo e `pausado_em = now()` (servidor).                                     |
| `fn_retomar_apontamento(id)`       | Soma o tempo que ficou pausado (`now() - pausado_em`, calculado no servidor) e volta a `Em andamento`. |
| `fn_finalizar_apontamento(id)`     | Marca `Finalizado` e grava `hora_fim = now()` (servidor); se estava pausado, fecha a pausa antes.      |

Cada função **só mexe em linhas da própria oficina** (confere o `oficina_id` do JWT) — o
isolamento entre clientes continua garantido.

Importante: **`tempo_pausado_seg` passa a ser calculado no banco**, não mais somado no
navegador. Some um lugar onde o tablet podia introduzir erro.

## O que muda no código `.ts` (passo de DEPOIS — ainda NÃO feito)

Arquivo: `src/lib/supabase/queries.ts`

1. **`pausarApontamento`** (hoje ~linha 204)
   - **De:** `.from('apontamentos').update({ status_tarefa: 'Pausado', motivo_pausa, pausado_em: new Date().toISOString() })`
   - **Para:** `.rpc('fn_pausar_apontamento', { p_id: apontamentoId, p_motivo: motivo })`
   - Sai o `new Date()`; a hora vem do servidor.

2. **`retomarApontamento`** (hoje ~linha 236)
   - **De:** cálculo no browser de `segundosPausados = (Date.now() - pausado_em) / 1000` + `update`.
   - **Para:** `.rpc('fn_retomar_apontamento', { p_id: apontamento.id })`.
   - O cálculo do tempo pausado sai do browser e vira responsabilidade do banco.

3. **`finalizarApontamento`** (hoje ~linha 279)
   - **De:** `.update({ hora_fim: new Date().toISOString(), status_tarefa: 'Finalizado', ... })` + soma do tempo pausado no browser.
   - **Para:** `.rpc('fn_finalizar_apontamento', { p_id: apontamento.id })`.
   - A função do banco já fecha a janela de pausa pendente, então a conta no browser some.

Arquivo: `src/lib/supabase/anomalias-queries.ts`

4. **`registrarCorrecao`** — ramo `ajustar_fim` (hoje ~linha 182)
   - Hoje o "depois" usa `hora_fim: params.horaFimISO ?? new Date().toISOString()`.
   - Quando o admin **não** informa uma hora específica (fechar fantasma "agora"), o `new Date()`
     do browser deve ser trocado pelo fim do servidor — via `fn_finalizar_apontamento` ou uma
     RPC de correção dedicada. Quando o admin **escolhe** uma hora no passado (ajuste manual),
     essa hora escolhida continua valendo (é uma decisão humana, não o relógio do tablet).
   - **Decisão a confirmar antes de implementar:** a correção é append-only (grava em
     `apontamento_correcoes`, não sobrescreve o bruto). Definir se o "fim agora" do fantasma
     passa a chamar a RPC. **Recomendação:** sim, para "agora"; manter a hora escolhida quando
     o admin digita uma. (Ponto de parada — alinhar com o fundador/architect neste item.)

## O que NÃO muda

- **`useCronometro` / `useTempoPausado`** (hooks de UI em `queries.ts`): continuam usando o
  relógio local **só para a contagem visual**. Não é a verdade gravada — é só a animação na
  tela. Trocar isso não traz benefício e adicionaria latência de rede a cada segundo.
- **`iniciarApontamento`**: já usa o servidor (`hora_inicio` é `DEFAULT now()`); nada a fazer.
- **Nenhuma coluna nova, nenhuma mudança de RLS, nenhum GRANT de tabela.** A 011 só adiciona
  funções e o `EXECUTE` delas.

## Como verificar quando o código for trocado (critérios verdes)

1. `npx tsc --noEmit` sai 0 (sem erro de tipo nas chamadas `.rpc`).
2. `npm run lint` sem novos erros.
3. No totem (teste): pausar uma tarefa → `pausado_em` no banco bate com a hora do **servidor**
   (não com a hora do tablet, mesmo que se altere o relógio do tablet de propósito).
4. Retomar → `tempo_pausado_seg` aumenta de forma coerente com a janela de pausa real.
5. Finalizar → `hora_fim` é a hora do servidor; tarefa some da lista de ativas.
6. Finalizar **estando pausado** → o tempo pausado da última janela é contabilizado.

## Ordem segura de execução (quando autorizado)

1. Fundador aprova → aplicar `011` no **teste** (apenas teste; produção intocada).
2. Confirmar no banco que as 3 funções existem e o `EXECUTE` está concedido.
3. **Só então** trocar as chamadas no `.ts` (passo acima), em diff revisável.
4. Testar no totem do teste (critérios acima).
5. Manter o totem funcionando a cada passo; nada disso vai para produção sem ordem explícita.

> Rollback do banco: `supabase/rollbacks/011_rollback.sql` (dropa as 3 funções; não toca dados).
> Reverter o código: voltar as chamadas `.rpc(...)` para os `.update({...})` anteriores.
> Reverter o `.ts` **antes** de dropar as funções, senão pausa/fim falham no totem.
