# Gaps do Piloto + Polimento de Credibilidade

Saída de 2 agentes (caça-gaps de prontidão + avaliação awwwards). Só achados **novos** — não
repete o que já está em `DIAGNOSTICO.md` / `AUDITORIA-FUNCIONAL.md`. Handoff pro Code.

> **Boa notícia:** a decisão A1 (derivar "presente" de apontamento do dia, não de
> `pontos_eletronicos`) **já está implementada** (`live-queries.ts:220-255`). Fechado no código.

---

## A. Gaps de prontidão do piloto (1 oficina, teste)

### Críticos pra DEMO DE HOJE (aparecem no caminho feliz)

- **G1 [ALTO] A faixa "Equipe agora" SOME inteira em dia sem apontamento.**
  `producao/page.tsx:127` faz `if (ops.length === 0) return null`. Como presença agora vem de
  "teve apontamento hoje", **antes do 1º play do dia ninguém aparece** → o dono abre o painel na
  reunião matinal (o Daily Huddle, que é o critério de sucesso) e vê o bloco sumido, parecendo
  quebrado. **Fechar:** estado vazio ("Ninguém apontou ainda hoje") em vez de `return null`.

- **G2 [ALTO] Passo 9 do teste de fumaça depende da claim `oficina_id` no JWT.** O crachá da
  sessão (`admin/page.tsx:98-107` via `cracheDaSessao()`) mostra "oficina —" **em silêncio** se
  o Custom Access Token Hook não estiver carimbando a claim na sessão do teste. **Fechar:**
  conferir no navegador, antes da demo, que aparece "oficina …" preenchido (não "—").

- **G3 [ALTO] Sem validação de prazo/valor no cadastro de OS.** `os/page.tsx` não impede
  `data_prometida` anterior à `data_entrada` nem valor negativo → dá pra salvar um carro "já
  nascido estourado", que o painel de prazos marca vermelho na hora — ruído logo na 1ª demo do
  holofote. **Fechar:** validar no submit (prometida ≥ entrada; valor ≥ 0).

### Médios (integridade — gerenciável no piloto, mas fácil de cair)

- **G4 [MÉDIO] `criarFuncionario` não bloqueia nome duplicado.** O totem identifica o operário
  **só por nome** — dois "João Silva" colidem (o recovery pode trazer o apontamento do outro).
  Avisar/bloquear nome repetido (e, idealmente, unique no banco — migração aditiva).
- **G5 [MÉDIO] Desativar funcionário com apontamento ativo cria fantasma órfão.** Ele some da
  seleção do totem mas o cronômetro segue correndo, sem dono pra retomar. Confirmar antes de
  desativar / avisar se há apontamento ativo.
- **G6 [MÉDIO] Flash "OS criada." nunca some.** `os/page.tsx:196` não limpa a mensagem (o totem
  limpa em ~3s; o admin não). Auto-limpar em ~3s.
- **G7 [MÉDIO] Totem pode apontar numa OS ENTREGUE.** `queries.ts:119-123`
  (`buscarOSPorPlaca`) usa `.ilike` com `.limit(1)` sem filtrar `Entregue` nem ordenar — com
  histórico de placa, pode pegar a OS errada. O admin já filtra; o totem não. **Fechar:**
  filtrar `status_geral != 'Entregue'` + ordenar por entrada desc no totem.

### Baixos / decisão de produto

- **G8 [BAIXO] "Atrasado" no card usa relógio do tablet + data UTC** (`producao/page.tsx:206`) —
  no fuso BR um prazo "hoje" aparece atrasado o dia todo. Casa com a frente "servidor calcula o
  tempo".
- **G9 [DECISÃO] `iniciarApontamento` não seta `etapa_atual`.** `queries.ts:147-167` grava o
  apontamento mas não move a OS de etapa → o card do kanban **não anda** quando o operário
  começa (fica em "sem etapa iniciada"). O escopo diz "etapa setada quando o operário inicia
  (explícito) / último que iniciou vence". **Confirmar:** o totem deve setar `etapa_atual` ao
  dar play? Hoje não seta.

---

## B. Polimento de credibilidade — avaliação awwwards: **73/100 ("Sólido")**

Veredito: confiável e legível, mas com "costuras visíveis" que um dono percebe como
não-acabado. Notas: Design 28/40 · Usabilidade 24/30 · Criatividade 13/20 · Conteúdo 8/10.
Ações de alto impacto / baixo custo (adequadas a um dashboard operacional):

1. **Centralizar as cores nos tokens do guia** (`--gd-ok/--gd-warn/--gd-danger/...`) — hoje os
   hexes de estado estão duplicados e **divergentes** do `GUIA-DESIGN.md` em 3 lugares por tela.
   Maior ganho de credibilidade pelo menor custo. (Casa com o `PUNCH-LIST-DESIGN.md`.)
2. **`font-variant-numeric: tabular-nums`** em KPIs, placa, dias, valor — uma linha de CSS; é o
   que dá "números com autoridade" (o que impressiona quem já viu relatório PPG/AkzoNobel).
3. **Benchmark embaixo de cada KPI** ("● meta < 7 dias", "● bom 3-4h/dia") — converte número em
   decisão no Daily Huddle; o dono não sabe se "8 dias" é bom sem a régua.
4. **Padronizar a escala tipográfica entre Produção e Prazos** (KPI 24/700, título 16/700) e
   **pôr o ícone da marca no cabeçalho** — hoje as duas telas-irmãs usam tamanhos diferentes.
5. **Botão ↻ ≥ 44px + `aria-label`**, e **abas Produção ↔ Prazos** (underline teal) pra
   navegação entre as telas operacionais.
6. **Holofote real de prazo:** dar aos "Estourados + Perto" um bloco superior maior, separado
   dos KPIs de contexto (o "grande na tela" que o CLAUDE.md pede) — só reordenar a grid.
7. **`:focus-visible` com outline teal** em links/botões + rótulo redundante nas bolinhas de
   estado (daltônicos).
8. **`<title>`/metadata por página** ("Produção ao vivo — GDelta", "Saúde de prazos — GDelta").

**NÃO fazer** (reduziria usabilidade num painel operacional): trocar a fonte por display,
animações de scroll/entrada, glassmorphism/gradiente, "interação única". Aqui "wow" = clareza e
autoridade, não efeito.

---

## Ordem sugerida pro Code (antes/na demo de hoje)
1. **G1, G2, G3** (caminho feliz da demo). 2. Polimento #1, #2, #3 (cor/tabular/benchmark —
baratos e de alto impacto visual). 3. G6, G7 (integridade rápida). 4. Resto conforme fôlego.
