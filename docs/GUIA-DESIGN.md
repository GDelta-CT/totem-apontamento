# GDelta Totem — Guia de Design dos Painéis (`/admin`)

Padrão visual de **credibilidade** pra todas as telas do gestor/dono: painel operacional ao
vivo, CRUD de OS e funcionários, formulários, anomalias. Insumo pro Claude Code — ele
implementa; este doc define o "como tem que parecer".

> **Escopo:** vale para `/admin` (e telas de login, já feitas). O **interior do totem**
> (preto/âmbar do operário) **fica preservado** — não aplicar este guia lá.
> **Tema dos painéis:** claro (apropriado ao monitor do escritório), marca GDelta.

---

## 1. Princípios

1. **Hierarquia clara** em toda tela: marca/título → contexto → conteúdo → ação.
2. **Consistência** — os mesmos componentes e cores em todas as telas. Nada de estilo ad-hoc.
3. **Densidade controlada** — respiro entre blocos; tabela legível; nada espremido.
4. **Números com autoridade** — alinhados, tabulares, com benchmark ao lado quando houver.

---

## 2. Cores (tokens já no `globals.css`)

**Marca:** `--gd-navy #0b3857` (títulos/ícone) · `--gd-teal #13678d` / `--gd-teal-bright #1c84ad`
(ação/destaque) · `--gd-paper #f5f4f2` / off-white · `--gd-ink #0b2233` (texto) ·
`--gd-muted #5d7689` (secundário) · `--gd-line` (bordas claras).

**Superfícies dos painéis:** fundo da página `#f7f8fa`; cartões/tabelas brancos `#ffffff`;
bordas `#e6ebf0`; cabeçalho branco.

**Cores semânticas — uma cor = um significado** (texto sempre no tom escuro da própria família):

| Significado | Uso | Fill claro / Texto |
| --- | --- | --- |
| Produzindo / no prazo / OK | estado bom | `#e1f5ee` / `#0f6e56` (verde) |
| Em pausa / atenção / perto de estourar | aviso | `#faeeda` / `#854f0b` (âmbar) |
| Bloqueio-fluxo (outro setor, cura) | espera esperada | `#faeeda` / `#854f0b` (âmbar) |
| Bloqueio-problema (peça, aprovação) / estourado / anomalia | ação urgente | `#fcebeb` / `#a32d2d` (vermelho) |
| Parado sem bloqueio / aguardando próxima | neutro | `#f1efe8` / `#5f5e5a` (cinza) |
| Ausente | apagado | cinza apagado `#b4b2a9` |
| Info / entrega pronta | informativo | `#e6f1fb` / `#0c447c` (azul) |

---

## 3. Tipografia (fonte Inter, já carregada)

| Nível | Tamanho / peso | Uso |
| --- | --- | --- |
| Título de tela | 15–16px / 700, cor navy | "Painel Operacional", "Painel do Gestor" |
| Número de KPI | 24px / 700, navy | valor grande do cartão |
| Rótulo / cabeçalho de coluna | 11px / 600, muted, UPPERCASE, letter-spacing leve | labels de KPI, th da tabela |
| Corpo | 12,5–13px / 400–500 | células, textos |
| Microcópia | 11px / 400, muted | dicas, contadores, rodapé |

Números (tempo, %, R$, contagem): **tabular-nums** e alinhados.

---

## 4. Layout & espaçamento

- **Cabeçalho** branco com ícone GDelta (`gdelta-symbol.png`) + título à esquerda; status/usuário à direita.
- **Navegação** por abas sob o cabeçalho (aba ativa com underline teal de 2px).
- **Raio:** cartões 10px; pílulas/inputs 9px; pílula de status 10px (formato cápsula).
- **Sombra:** evitar; usar **borda 1px** `#e6ebf0` pra separar. Sombra só em modal/overlay.
- **Espaço:** padding de seção 14–16px; gap entre cartões 10px.

---

## 5. Componentes (biblioteca)

- **Cartão de KPI:** fundo branco, borda; rótulo (uppercase muted) → número (24/700) → linha de
  benchmark com bolinha colorida (ex.: "● meta < 7 dias"). Grid responsivo `minmax(120px,1fr)`.
- **Pílula de status:** cápsula, fill+texto da mesma família (tabela §2). Sempre rótulo curto.
- **Cartão de OS (Kanban):** branco, **borda esquerda 4px** na cor do estado dominante; placa
  (13/700) → veículo (muted) → linha do operário (bolinha de estado + nome + tempo) → pílula de
  prazo. Mostrar **todos os apontamentos ativos** do carro, cada um com a etiqueta da etapa.
- **Tabela de dados (CRUD):** dentro de um cartão branco com borda; cabeçalho `#f3f6f8` com th
  em label-style; linhas separadas por borda clara; placa em 700; status em pílula; prazo
  colorido. Rodapé com contagem + regra ("placa em maiúsculas · busca-antes-de-criar").
- **Toolbar:** busca (input com ícone de lupa, placeholder "Buscar por placa…") à esquerda;
  botão de ação primário à direita.
- **Botões:** **primário** = fill teal `#1c84ad`, texto branco, ícone à esquerda; **secundário**
  = branco com borda; **fantasma** = transparente com borda (ex.: "Sair"). Raio 9px.
- **Faixa "Operários agora":** chips brancos com bolinha de estado + nome + contexto
  (etapa/motivo). Estados **sem tarefa** e **ausente** aparecem **só aqui**, nunca colorindo card.
- **Badge de usuário:** chip com avatar circular (iniciais em fundo teal) + nome + papel.
- **Aba de anomalias:** rótulo + contador vermelho (pílula). É a porta do fluxo de correção.
- **Empty state:** traço "—" cinza centralizado na coluna/área vazia (sem card fantasma).

---

## 6. Mapa de cor de ESTADO (consolida a revisão do Pacote 1)

Cor dominante do **card** segue a precedência (primeiro que bate, vence):

1. **Bloqueio-problema** → vermelho (DOMINA).
2. **Bloqueio-fluxo** → âmbar.
3. **Produzindo** (≥1 apontamento rodando) → verde. _(Produzindo ganha de pausado no mesmo card.)_
4. **Parado sem bloqueio / aguardando próxima** → cinza.

A **pílula de prazo** é independente da cor de estado: no prazo (verde) · perto de estourar
(âmbar) · estourado (vermelho).

> Degradação graciosa: se o passo "etapa concluída? sim/não" for cortado, o card simplesmente
> cai em "parado sem bloqueio" (cinza) — a tela não quebra.

---

## 7. Regras de credibilidade (do / don't)

- **Faça:** alinhar números; mostrar benchmark junto do KPI; usar uma cor por significado;
  manter respiro; usar o ícone da marca no cabeçalho.
- **Não faça:** cor decorativa sem significado; mais de uma cor "urgente" disputando atenção;
  fonte abaixo de 11px; sombra pesada/gradiente; pintar card por estado de pessoa que não está nele.

---

## 8. Onde aplicar

- **Painel operacional ao vivo** (dono): cabeçalho + KPIs + faixa de operários + Kanban (§5/§6).
- **CRUD de OS** (gestor): toolbar + tabela (§5).
- **CRUD de Funcionários:** mesma tabela/forma.
- **Formulários (Nova/Editar OS):** campos no padrão de input do login (`gd-auth__input`),
  botão primário teal, validação inline.
- **Anomalias:** lista no mesmo padrão de tabela + ação de correção.
- **Login / sem acesso:** já implementados (classes `.gd-auth*`).
