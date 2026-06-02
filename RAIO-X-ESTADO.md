# RAIO-X — Estado atual (para revisão)

> Gerado em 2026-06-01 ~12:45 (horário do servidor da máquina). Saída CRUA dos comandos,
> sem narrativa otimista. Nada foi aplicado para gerar este relatório (só leitura).

---

## 1) Time / AIOX

### `ls .claude/agents/`
```
ls: cannot access '.claude/agents/': No such file or directory
```
Não existe. Os agentes ficam em **`.aiox-core/development/agents/`**:
```
aiox-master.md   analyst.md   architect.md   data-engineer.md
dev.md           devops.md    pm.md          po.md
qa.md            sm.md        squad-creator.md   ux-design-expert.md
```
(espelhados em `.claude/commands/AIOX/agents`, `.antigravity/`, `.codex/`, `.cursor/`, `.gemini/`, `.github/`)

### Função de cada agente (de `.claude/rules/agent-authority.md`)
- **aiox-master** — governança do framework; executa qualquer task; pode dar override nos limites dos outros.
- **analyst** — pesquisa/análise; relatórios (`research.json`, executivo).
- **architect** — arquitetura, seleção de tecnologia, planos de implementação.
- **data-engineer** — schema/DDL, RLS, índices, migrations (delegado do architect).
- **dev** — implementação; `git add/commit/branch` local. BLOQUEADO: `git push`.
- **devops** — autoridade EXCLUSIVA de `git push`, PRs, CI/CD, MCP, releases.
- **pm** — épicos, requisitos, specs (orquestração).
- **po** — valida story (checklist 10 pontos), backlog.
- **qa** — quality gate, loop de review.
- **sm** — cria story (draft).
- **squad-creator** — cria squads/agentes.
- **ux-design-expert** — design frontend/UX.

### CLAUDE.md — marcação do AIOX (linhas 255/257) + Processo
```
## Processo

- AIOX **ativo** sob governança plena (decisão do fundador, 01/06/2026), MAS manter os **checks de segurança**
  e a regra de **não publicar sem revisão**.
- **AIOX ATIVO (decisão do fundador, 01/06/2026):** as regras em `.claude/rules/` (matriz de delegação,
  workflows, governança de agentes) estão **em vigor** — **devemos
  acionar os agentes e a matriz de delegação** conforme definido. Os **checks de segurança** continuam valendo sobre tudo:
  revisar antes de publicar, diff antes de salvar, um passo pequeno e reversível por vez. **Anti-colisão:** enquanto um executor estiver com posse de um build ativo, a escrita de código fica serializada — um por vez no mesmo arquivo/área — pra não conflitar nem atrasar.
```
Estado no disco: **AIOX = ATIVO**, com checks de segurança + anti-colisão por cima.

### CLAUDE.md — bloco de autonomia/escalonamento (travas)
```
**PARE e apresente plano/diff para aprovação:**
- Migrations que mudem permissões/GRANTS/RLS, ou destrutivas (drop/perda de dado).
- Mudanças em autenticação ou no isolamento multi-tenant.

**PARE e peça DECISÃO do fundador:**
- Qualquer coisa que toque a PRODUÇÃO (ccpxwnbxvmadcafxnbjs).
- git push, deploy, publicar.
- Gastar dinheiro / serviço pago.
- Mudar o escopo travado ou adicionar feature fora dele.
```

---

## 2) Estado real do código (saída crua)

### `git log --oneline -10`
```
d3b7011 refactor(escopo): remove a camada de presenca/ponto do totem (produtividade-only)
20a76b4 feat(admin): painel do gestor + auth de device + marca G Delta (Fase 1, Passos 1 e 3)
fd6f8c2 chore: adiciona .prettierignore para proteger pastas geradas
bef521d chore: aplica formatação Prettier
faede99 docs: adiciona arquivos de inspeção e mapas de queries do totem
b3b1bd6 feat(db): adiciona RLS (001) e estrutura multi-tenant (002)
a978ecb docs: salva contexto da pausa
d7c3286 fix: separa rollbacks das migrations versionadas
8f78804 feat: adiciona kit de automação v1 (CONTROLE, migrations, backup, CI melhorado)
0887cf7 fix: build error on diagnostico import
```

### `git status --short`
```
 M CLAUDE.md
 M CONTROLE.md
 M HANDOFF-CRUD-ADMIN.md
 M docs/Pacotes-Produto-Comercial.md
 M src/app/admin/page.tsx
 M supabase/.temp/cli-latest
 M supabase/.temp/linked-project.json
 M supabase/.temp/pooler-url
 M supabase/.temp/postgres-version
 M supabase/.temp/project-ref
?? .claude/scheduled_tasks.lock
?? docs/AUDITORIA-FUNCIONAL.md
?? docs/PRONTO-PARA-DEMO-HOJE.md
?? docs/PUNCH-LIST-DESIGN.md
?? src/app/admin/anomalias/
?? src/app/admin/prazos/
?? src/lib/supabase/anomalias-queries.ts
?? src/lib/supabase/dono-queries.ts
?? supabase/migrations/006_correcao_anomalias_admin.sql
?? supabase/rollbacks/006_rollback.sql
```

### `npx tsc --noEmit`
```
TSC_EXIT=0
```

---

## 3) Remoção do ponto (tarefa atual)

| Item | Arquivo | Status |
|---|---|---|
| A | `src/app/totem/page.tsx` | FEITO — commitado em `d3b7011` |
| B | `src/lib/supabase/queries.ts` | FEITO — commitado em `d3b7011` |
| C | `src/lib/supabase/client.ts` | FEITO — commitado em `d3b7011` |
| D | `src/lib/supabase/live-queries.ts` | NÃO feito (inalterado; ainda 4 estados) |
| E | `src/app/admin/producao/page.tsx` | NÃO feito (inalterado) |
| F | `CLAUDE.md` | NÃO feito por mim (seção "Ponto/presença" e "4 estados" ainda presentes). Arquivo está `M`, mas por OUTRO agente. |

### `git diff` working-tree dos A/B/C
```
(saída vazia — já commitados)
```
Conteúdo da mudança = commit `d3b7011`:
```
 src/app/totem/page.tsx      | 477 ++------------------------------------------
 src/lib/supabase/client.ts  |  73 -------
 src/lib/supabase/queries.ts | 206 +------------------
 3 files changed, 21 insertions(+), 735 deletions(-)
```
Patch completo: `git show d3b7011` (735 linhas).

### Algum arquivo editado por mais de um agente?
**SIM.**
- `src/app/admin/page.tsx` — editado por mim (repaginação, commit `20a76b4`) E pelo terminal (cards `prazos`/`anomalias`, agora `M`).
- `totem/page.tsx`, `queries.ts`, `client.ts` — editados por mim, mas COMMITADOS pelo terminal (`d3b7011`); `totem` re-tocado 11:25 pelo terminal (conteúdo idêntico).

### A tabela `pontos_eletronicos` foi dropada?
**NÃO.**
```
grep -rin "drop" supabase/migrations supabase/rollbacks | grep -i ponto
exit_grep_drop=1   (1 = nenhum drop encontrado)
```

---

## 4) Coordenação

### Atividade recente (mtime) — agora = `2026-06-01 12:44:49`
```
2026-06-01 11:28:44  docs/AUDITORIA-FUNCIONAL.md
2026-06-01 11:25:30  src/app/totem/page.tsx
2026-06-01 11:24:35  docs/PUNCH-LIST-DESIGN.md
2026-06-01 11:13:02  src/lib/supabase/queries.ts
2026-06-01 11:05:34  CLAUDE.md
2026-06-01 11:04:52  src/lib/supabase/client.ts
2026-06-01 09:29:12  src/app/admin/page.tsx
2026-06-01 09:28:47  src/app/admin/prazos/page.tsx
2026-06-01 09:25:54  src/lib/supabase/dono-queries.ts
2026-06-01 03:16:02  src/lib/supabase/anomalias-queries.ts
```

- **Quem está editando agora:** ninguém. Última modificação de qualquer arquivo = **11:28** (~76 min atrás). O outro Claude (terminal) **parou de editar** (≥76 min).
- **Onde este agente está:** A/B/C feitos, commitados (`d3b7011`), `tsc` limpo, testados pelo fundador no navegador. Parado; nada novo aplicado.
- **Push:** NENHUM. `main` está **4 commits à frente** de `origin/main` (tudo local).
- **Esperando do fundador (decisões):**
  1. Lote grande não commitado do terminal (`anomalias/`, `prazos/`, `dono-queries.ts`, docs, **Migration 006**) + `CLAUDE.md`/`admin/page.tsx` modificados. Mexer em D/E/F agora ainda pode colidir.
  2. **Migration 006 (`006_correcao_anomalias_admin.sql`) é GRANTS** — não aplicar sem OK explícito.
  3. Quem commita o lote do terminal e se entra no mesmo push.
