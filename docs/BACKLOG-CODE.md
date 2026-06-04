# Backlog do Code — fila única priorizada

> **Reconciliado em 2026-06-04** com o estado real do repo. O backlog antigo
> (P0–P4 das auditorias) está ~90% concluído — ver "✅ Já fechado". O que segue
> abaixo é o que **realmente falta**. Escrita de código serializada (anti-colisão).
> Legenda: 🔴 = precisa de decisão/OK do fundador · ▶️ = autônomo (o Code faz) ·
> 📦 = Fase 2 (fora do MVP travado).

---

## ✅ Já fechado (era o grosso do backlog antigo)

- **P0** — bug de recovery em queda de conexão (distingue erro de "sem tarefa");
  anomalia append-only (migration 010 `apontamento_correcoes` + correção do admin).
- **P1** — G1 (faixa "Equipe agora" com estado vazio); G2 (`oficina_id` no JWT);
  jargão do operário ("carro", não "OS").
- **P1.5** — iniciar tarefa em ~2–3 toques (cortada a tela de confirmação).
- **P2** — G7 (totem não aponta em OS "Entregue", usa índice).
- **P2.5** — G4 (nome de funcionário duplicado → confirmação); G5 (desativar com
  apontamento ativo → confirmação em modal).
- **P3 (design)** — admin com cabeçalho/marca, tokens semânticos, pílulas de status,
  cor de prazo, abas de navegação, kanban; **redesenho comercial do totem** (navy
  alto-contraste) + logo no selo.
- **P3.5 (a11y)** — `:focus-visible` com anel; **contraste APCA** do totem e do
  login (texto secundário, teal-como-texto, placeholder) corrigidos.
- **P3.7 (nome)** — `package.json` = `gdelta-totem`; marca "GDelta".
- **P4 (parcial)** — leituras do painel movidas pro **servidor** (RSC + Server
  Actions); **lockdown 007** aplicado; gate de leitura por papel (`sessaoGestorOuNull`).
- **Outros (desta rodada)** — nomes de oficina removidos (sem piloto ainda);
  "Entregue fecha apontamentos abertos"; retrabalho + complexidade no totem.

---

## 🔴 Precisa de decisão / OK do fundador (mexe em permissão, auth ou publicação)

1. **Relógio do servidor (migration 011).** Pausa/fim ainda usam o relógio do
   tablet; o escopo exige o do servidor. As funções estão escritas (011), mas
   aplicá-las **cria funções com permissão especial no banco** → precisa do seu OK.
   Plano: mostrar a 011 → aplicar **só no TESTE** → migrar o código → testar o totem.
2. **Grant de escrita admin em `apontamentos`.** Sem ele, o "Entregue fecha
   apontamentos" (código já pronto) é recusado pelo banco em silêncio. Aplicar o
   grant = mudança de permissão → seu OK.
3. **Totem escrevendo no servidor (Passo 2) + lockdown final.** Mover a escrita do
   totem pro servidor e então revogar os acessos abertos do `anon` + travar FK entre
   oficinas. **Só antes de cadastrar a 2ª oficina.** Permissões/auth → seu OK.
4. **`git push` / deploy.** 7+ commits locais acumulados, nenhum publicado. Sua decisão.

## ▶️ Autônomo — o Code faz sem travar você (escopo travado do MVP)

5. **Bloqueio com motivo** (peça / aprovação / cura / outro setor; problema × fluxo,
   cor/ícone distintos). A base de dados já existe (migration 003 + tipos +
   `MOTIVOS_BLOQUEIO`); falta a tela no `/admin/os` e a exibição no kanban.
6. **"Etapa concluída?"** ao finalizar (escopo travado, nunca construído nem cortado).
   Recomendação: **construir** mínimo (+1 toque, com padrão) — dá ao painel o sinal
   real de "aguardando próxima etapa" (hoje ele só deriva/adivinha).
7. **Placa buscável** — lista de carros ativos por placa (tocar em vez de digitar
   com mão suja). É o que o escopo de adoção pede.
8. **`next/font`** — auto-hospedar as fontes (hoje `@import` do Google bloqueia o
   render). Adiado do pass de a11y por ser mais delicado.
9. **Miudezas a verificar/ajustar** — validação `data_prometida ≥ data_entrada` e
   `valor ≥ 0` (G3); flash "OS criada." auto-sumir (~3s, G6); tamanhos de toque/fonte
   residuais no totem.

## 📦 Fase 2 — fora do MVP (travado, não construir agora)

Integração Cília · PIN forte (atribuição intra-oficina) · Realtime · multi-totem ·
sync offline · ROI "antes × depois" (hora-homem) · ranking/reconhecimento ·
análise de complexidade por nível · 4º tipo de cliente "frota" · etapas configuráveis.

---

## Decisões do fundador — registradas

- **Marca SEM dourado** (navy + teal + off-white). Logos oficiais não regenerar.
- **Nome:** marca **GDelta**, produto **GDelta Totem**.
- **Piloto:** _a definir_ — ainda não há oficina piloto.
- **Sem 2ª oficina** até o lockdown final (item 🔴 3).
