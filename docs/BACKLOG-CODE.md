# Backlog do Code — fila única priorizada

Consolida TUDO que os agentes acharam (design, funcional, segurança, gaps, awwwards, UX do
totem, acessibilidade) numa fila deduplicada. Detalhes nos docs citados. **Escrita de código
serializada** (um executor por vez — regra anti-colisão). Fale com o Code por nome de item.

> Já em andamento pelo Code (apareceu desde a última auditoria): benchmark bars, tokens
> semânticos, anel de foco no login do totem, `prefers-reduced-motion`. Bom — manter.

---

## P0 — Correção / integridade (faz primeiro)

- **BUG do recovery em queda de conexão** (`totem/page.tsx:99`): hoje, se a checagem de tarefa
  ativa falha (timeout), o operário é tratado como "sem tarefa" e mandado começar do zero →
  risco de **apontamento duplicado / trabalho perdido**. Distinguir `status==='error'` de "sem
  tarefa" e mostrar "não consegui conferir, tenta de novo" — **nunca seguir em frente**.
- **Anomalia append-only** (substituir o UPDATE destrutivo): conforme `PLANO-CORRECAO-ANOMALIA.md`.
  **Requer aval do fundador no plano de schema.** Manter a 006 desligada até a troca.

## P1 — Demo de HOJE (caminho feliz, 1 oficina, teste) — ref. `GAPS-PILOTO-E-POLIMENTO.md`

- **G1**: faixa "Equipe agora" some em dia sem apontamento (`producao:127` `return null`) → estado
  vazio "Ninguém apontou ainda hoje".
- **G2**: conferir no navegador que a claim `oficina_id` do JWT está preenchida (crachá ≠ "—").
- **G3**: validar no cadastro de OS — `data_prometida ≥ data_entrada` e `valor ≥ 0`.
- **Mensagens técnicas vazando pro operário** (`queries.ts` `traduzirErro`, telas Vazio): textos de
  RLS/admin aparecem na tela do operário. Esconder; mostrar só mensagem amigável.

## P1.5 — Adoção do totem (a lei dos 2 toques) — ref. agente UX do totem

- **Iniciar tarefa custa 5 toques** (viola a regra de ouro na ação mais comum). Cortar a tela de
  confirmação (passo 5) e, quando a placa retorna 1 OS ativa, ir direto pra etapas → ~2-3 toques.
- **Placa só por digitação**: o escopo pede "lista buscável de carros ativos por placa, mais
  recentes primeiro" — tocar é muito mais rápido que digitar com mãos sujas.
- **Jargão "OS"** na tela do operário → "carro". ("NOVA CONSULTA" → linguagem de chão.)

## P2 — Acurácia / regras — ref. `AUDITORIA-FUNCIONAL.md`

- **Relógio do servidor**: tempo decorrido (teto de fantasma, prazo) calculado no Postgres, não
  com `Date.now()` do dispositivo.
- **G7**: totem `buscarOSPorPlaca` filtrar `status_geral != 'Entregue'` + ordenar (não apontar em OS entregue).
- **G8**: "atrasado" no card usa relógio/UTC do cliente — corrigir com o tempo do servidor.

## P2.5 — Integridade rápida

- **G4**: bloquear/avisar nome de funcionário duplicado (totem identifica só por nome).
- **G5**: confirmar antes de desativar funcionário com apontamento ativo (senão vira fantasma órfão).
- **G6**: flash "OS criada." auto-limpar em ~3s.

## P3 — Credibilidade / design — ref. `PUNCH-LIST-DESIGN.md` + awwwards (73/100)

- **Cabeçalho branco + ícone da marca** nas telas do admin (hoje barra navy sem marca) — **maior
  ganho de credibilidade**; replicar nas 5 telas.
- **Centralizar cores nos tokens semânticos** (`--gd-ok/warn/danger/neutral/info`) — hexes hoje
  divergem do guia em vários lugares.
- **`tabular-nums`** em KPIs, placa, datas, valor, horas ("números com autoridade").
- **Benchmark sob cada KPI** ("● meta < 7 dias") onde ainda falta.
- **Pílulas de status semânticas** (os/funcionarios): cada status na sua família de cor.
- **Cor de prazo na tabela de OS** (coluna Prometida): verde/âmbar/vermelho.
- **Funcionário inativo**: trocar `line-through` (hostil) por opacidade + pílula cinza.
- **Abas de navegação** entre OS/Funcionários/Anomalias/Produção/Prazos (underline teal).
- **Precedência de cor do Kanban**: cinza "parado sem bloqueio"; separar bloqueio-problema
  (vermelho) × fluxo (âmbar). Padronizar KPI 24/700, raio 10px.

## P3.5 — Acessibilidade — ref. agente de a11y

- Tag **"DISPARA ALERTA" a 9px** no totem → ≥11px (é consequência, tem que ler).
- **Alvos de toque ≥44px**: "SAIR" e "Trocar" no totem (hoje ~32-36px); botões refresh.
- **`:focus-visible`** com anel claro (vários `outline:none` sem substituto no totem/forms).
- **Contraste**: `--gd-neutral-ink` sobre fill claro ≈4.0:1 (abaixo de AA) → escurecer.
- **`aria-label`** no refresh de anomalias (as outras telas já têm).
- Texto secundário do totem (descrições 12px) → 13px (uso de parede).

## P3.7 — Padronização do nome (GDelta) — ref. CLAUDE.md "Padrão de nome"

Marca **GDelta** (uma palavra), produto **GDelta Totem**. No `src` + config (Code):
- `package.json` `name`: `app-nextjs` → `gdelta-totem`.
- Trocar **"G Delta"** (com espaço) → **"GDelta"** em strings visíveis e metadados:
  `layout.tsx` (title/keywords), `globals.css` (comentários), `DeviceAuthGate.tsx` /
  `AdminAuthGate.tsx` (rodapés + `alt` das imagens). Não tocar nos nomes literais externos
  (pasta, projeto Supabase). A logo mantém o estilo "G|DELTA".

## P4 — Segurança (antes de QUALQUER 2ª oficina) — ref. `AUDITORIA-FUNCIONAL.md` D

- Mover leituras do painel pro **servidor** (não browser/anon) **e** aplicar o **lockdown** das
  policies abertas do anon (nessa ordem). Plano + aprovação. **NÃO cadastrar 2ª oficina até lá.**

## Decisões do fundador — RESOLVIDAS (01/06/2026)

1. **Plano append-only da anomalia: APROVADO.** Code implementa conforme
   `PLANO-CORRECAO-ANOMALIA.md`, com diff antes de aplicar a migration; 006 desligada até a troca.
2. **G9: SIM — o totem seta `etapa_atual` ao operário dar play.** É o que o escopo travado já
   manda ("último que iniciou vence"); corrigir em `iniciarApontamento` (atualizar
   `ordens_servico.etapa_atual` para a etapa iniciada). Não é mais decisão aberta.
