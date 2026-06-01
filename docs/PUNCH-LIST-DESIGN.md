# Punch-list de Design — telas do `/admin` vs GUIA-DESIGN

Revisão só-leitura das telas reais (produção, prazos, OS, funcionários, anomalias) contra o
`GUIA-DESIGN.md`. Handoff pro Code. Prioridade: **ALTA** (credibilidade/lógica), **MÉDIA**,
**BAIXA** (polimento).

> Veredito geral: o **chrome** (fundo, topbar, bordas, links) já usa os tokens `--gd-*` — bom.
> O problema concentrado é **cor semântica de estado hardcoded fora da paleta** e alguns
> componentes que não seguem o §5. Terminologia de RH/"ponto eletrônico" **não vaza** pra UI
> (só uma copy a revisar — ver fim).

## Transversais (consertar uma vez, resolve em todas)

- **[ALTA] Cores semânticas fora da paleta.** Várias telas usam hexes ad-hoc (`#1b7a3d`,
  `#b8860b`, `#b42323`, `#8a94a0`, `#92600c`, `#e6f6ec`, `#fdeaea`…) em vez dos pares do guia
  §2: verde `#e1f5ee`/`#0f6e56` · âmbar `#faeeda`/`#854f0b` · vermelho `#fcebeb`/`#a32d2d` ·
  neutro `#f1efe8`/`#5f5e5a` · ausente `#b4b2a9` · info `#e6f1fb`/`#0c447c`. **Recomendado:**
  criar tokens `--gd-ok / --gd-warn / --gd-danger / --gd-neutral / --gd-info` no `globals.css`
  e referenciar em todas as pílulas, flashes e bordas de estado.
- **[MÉDIA] Inputs não reusam o padrão do login.** Os formulários (OS, funcionários) redefinem
  input do zero e o foco só muda `border-color`, **sem o anel teal** (`box-shadow: 0 0 0 4px
  rgba(28,132,173,.16)`). §8 manda reusar `gd-auth__input`.
- **[MÉDIA] Raios inconsistentes.** Há 8/10/12/14/18px misturados. Guia §4: cartões 10px,
  pílulas/inputs/botões 9px. Normalizar.
- **[MÉDIA] Superfície clara divergente.** Telas usam `--gd-paper #f5f4f2`/`--gd-paper-2
  #eceae6` para fundo/cabeçalho de tabela; o guia §2 pede fundo de página `#f7f8fa`, cartões
  brancos e cabeçalho de tabela `#f3f6f8`. Alinhar qual vence (sugiro seguir o guia).
- **[BAIXA] Cabeçalho navy cheio sem a marca.** As telas usam barra navy sólida; §4 pede
  **cabeçalho branco** com o `gdelta-symbol.png` + título + abas com underline teal.
- **[BAIXA] Faltam `tabular-nums`** em R$, tempos e contagens (§3).

## Por tela

**`producao` (Kanban / ao vivo) — ALTA:**
- Precedência de cor do card **incompleta** (`CardCarro`, ~linhas 199-205): só 3 ramos. Falta o
  **cinza "parado sem bloqueio / aguardando próxima"** (hoje cai em âmbar = aviso indevido) e a
  separação **bloqueio-problema (vermelho) × bloqueio-fluxo (âmbar)** — hoje todo bloqueio é
  vermelho, apesar de `motivo_bloqueio` existir pra classificar.
- Borda default do `.card` é verde fixa `#1b7a3d` (~406) — deveria ser neutra.
- "Sem tarefa" no `ResumoEstados` usa teal de marca (cor de ação) — usar cinza neutro.
- ✅ Confirmado certo: "sem tarefa" e "ausente" só na faixa de operários, nunca pintam card.

**`prazos` (saúde de prazos do dono) — ALTA/MÉDIA:**
- Cores de saúde fora da paleta (`SAUDE_META`, 36-41).
- Pílula de situação via opacidade (`cor + '22'`) em vez dos fills claros nomeados do guia.
- **Faltam linhas de benchmark nos KPIs** (Dias na oficina, Ticket) — §5 + benchmarks do
  CLAUDE.md (ciclo <7d, ocupação 70-85%). É onde o benchmark mais agrega credibilidade.

**`os` (CRUD) — ALTA:**
- Pílula de status não segue o mapa §2 (todo status ativo cai no azul-teal = cor de ação).
- **Coluna "Prometida" sem cor de prazo** (texto cru) — deveria ser pílula no prazo/perto/
  estourado. É o holofote do dono.
- **Falta toolbar de busca** ("Buscar por placa…") — esperado pra busca-antes-de-criar.
- Flashes com hexes ad-hoc; sem rodapé de tabela (contagem + regra).

**`funcionarios` (CRUD) — MÉDIA:**
- Inputs sem anel de foco teal; raios fora da escala (8/10/14px).
- "Inativo" com `line-through` + tag cinza ad-hoc — usar pílula neutra do guia.

**`anomalias` (correção) — ALTA:**
- Não usa o padrão de tabela (sem cabeçalho de coluna).
- "10,5h" é texto vermelho solto — deveria ser **pílula de alerta** (`#fcebeb`/`#a32d2d`).
- **Marca "editado pelo admin" não aparece** na UI (o campo nem vem no `select` da query) —
  guia/CLAUDE.md pedem essa marca leve.
- ⚠️ **(flui pro audit funcional)** o fechamento de fantasma **não exige motivo** — o Pacote 2
  diz que a correção EXIGE motivo. Lacuna de fluxo, não só visual.

## Copy / terminologia (varredura feita)

- **[MÉDIA] `totem/page.tsx:370` — título "QUEM ESTÁ NO PONTO?"** é a **única** string visível
  com a palavra "ponto". É gíria de "presente/de prontidão", mas pode soar a RH. Sugiro
  **"QUEM ESTÁ NO TURNO?"** ou "QUEM VAI TRABALHAR?".
- Todo o resto que contém "ponto" é nome de classe CSS ou comentário (interno — pode ficar). A
  tabela `pontos_eletronicos` não aparece em nenhuma UI. Vocabulário visível usa "apontamento"
  (correto, produtividade). **Nada de RH/folha/CLT vaza.**
