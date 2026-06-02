# Plano de Blindagem de Segurança — antes do 1º cliente real

> Produzido pela auditoria (gap-hunter) em 2026-06-02. **Análise/PLANO — nada aplicado.**
> Os itens GATED exigem aprovação explícita do fundador, **por ambiente** e **só no TESTE**.
> **Produção (`ccpxwnbxvmadcafxnbjs`) permanece intocada** em todos eles.

## Os 4 críticos

### #1 — Hook de JWT + triggers de `oficina_id` NÃO versionados (P0 — recuperação de desastre)

- **Onde:** ausência no repo — nenhum `.sql` contém `auth.access_token_hook` nem o
  `BEFORE INSERT ... oficina_id`. O `000_bootstrap_test.sql:8` anota que NÃO replica o hook.
- **Risco:** as policies `oficina_isolation_*` (`002_multi_tenant.sql:98-125`) leem
  `auth.jwt() ->> 'oficina_id'`, e os INSERTs do app (`admin-queries.ts`, `queries.ts:157`)
  NÃO setam `oficina_id` — dependem de um trigger que vive **só no banco de teste**. Se o
  banco for recriado a partir do repo, o isolamento multi-tenant **some**.
- **Conserto:** (1) introspecção read-only no TESTE via `scripts/db.mjs` (pg_proc /
  information_schema.triggers + conferir o hook no Dashboard > Auth Hooks); (2) colar o DDL
  capturado numa migration `009_*.sql` idempotente (+ rollback); (3) espelhar no
  `000_bootstrap_test.sql`.
- **GATED?** Capturar = não (read-only). **Aplicar a 009 = SIM** (toca auth/isolamento), só TESTE.

### #2 — Tempos ancorados no relógio do TABLET, não do servidor (P1)

- **Onde:** `queries.ts:194` (pausar), `:273` (finalizar), `anomalias-queries.ts:132` (fechar fantasma).
- **Evidência:** `pausado_em`/`hora_fim` gravados com `new Date().toISOString()` do browser.
  Tablet com relógio errado → tempo errado (corrompe "horas tocadas" e o teto anti-fantasma).
  **Nuance:** o INÍCIO já é do servidor (`hora_inicio DEFAULT now()`); o gap é parcial (pausa/fim).
- **Conserto:** trocar os 3 writes por RPCs `SECURITY DEFINER` que usam `now()` do banco.
- **GATED?** Leve — mostrar o DDL ao fundador antes de aplicar.

### #3 — Correção de anomalia DESTRUTIVA, sem trilha (P0 — credibilidade do dado)

- **Onde:** `anomalias-queries.ts:122-145` (`fecharApontamento` faz UPDATE direto);
  `006_correcao_anomalias_admin.sql` só cria a flag `editado_admin`.
- **Risco:** sobrescreve o tempo original sem motivo nem rastro ("mexeram no meu tempo escondido").
- **Conserto:** **já existe plano pronto** em `docs/PLANO-CORRECAO-ANOMALIA.md` — tabela
  `apontamento_correcoes` (motivo obrigatório, antes→depois, quem/quando) + trocar o UPDATE por
  INSERT na trilha; não aplicar a 006 como está.
- **GATED?** SIM (cria tabela + RLS + grants + trigger), só TESTE.

### #4 — Vazamento de leitura entre oficinas: policies abertas do anon (007 não aplicada) (P0)

- **Onde:** banco de TESTE — policies `anon ... USING (true)` ainda vivas; conserto = a `007_lockdown_leitura.sql`.
- **Risco:** com 2 oficinas, qualquer sessão lê tudo de todas. Materializa no 1º+2º cliente.
- **Pré-requisito travado:** o app hoje lê do browser com anon key — aplicar a 007 **antes** de
  mover as queries pro servidor **quebra o totem**. A 007 é a **ÚLTIMA** peça.
- **Conserto (ordenado):** (a) #1 capturado → (b) mover queries p/ API Routes (passo 3 travado) →
  (c) remover `/diagnostico` → (d) só então aplicar a 007 no TESTE + validar com 2 oficinas.
- **GATED?** SIM, duplo (RLS+GRANTS, por ambiente). Passo (b) é código no escopo (sem gate, mas é pré-req).

## Ordem de execução recomendada (um passo pequeno e reversível por vez)

| Ordem | Ação | Tipo | Gated? |
|---|---|---|---|
| 1 | Introspecção read-only do hook/triggers no TESTE (`scripts/db.mjs`) | Leitura | Não |
| 2 | Escrever migration `009` + rollback (capturar hook/triggers); espelhar no `000_bootstrap` | SQL (não aplicar) | Aplicar = **sim** |
| 3 | Mover leitura/escrita do browser → API Routes (passo 3 travado) | Código | Não (pré-req) |
| 4 | RPCs de tempo no servidor (`now()`) — fecha #2 | SQL + 3 funções TS | Aplicar = **leve** |
| 5 | Tabela `apontamento_correcoes` + `fecharApontamento` append-only — fecha #3 | SQL + código | **Sim** |
| 6 | Remover `/diagnostico`; aplicar `007` no TESTE; validar com 2 oficinas — fecha #4 | RLS/GRANTS | **Sim** |
