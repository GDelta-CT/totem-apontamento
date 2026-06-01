# Auditoria Funcional & Segurança — telas/queries do `/admin`

Revisão só-leitura (agentes especialistas) das camadas de dados e do isolamento multi-tenant,
contra as regras travadas (CLAUDE.md, NOTAS-TECNICAS, Pacote 1/2). Handoff pro Code.
**Design fica no `PUNCH-LIST-DESIGN.md`** — aqui é lógica/segurança.

---

## A. DECISÕES DO FUNDADOR (PARE — não decidir por ele)

### A1. Ponto removido → o painel perde o estado "presente sem tarefa"
O totem **removeu a camada de ponto** (comentário no próprio `totem/page.tsx:7-8`:
"camada de ponto removida"). Mas `live-queries.ts:220-240` ainda deriva "presente sem tarefa"
× "ausente" lendo `pontos_eletronicos` — uma tabela que **ninguém mais escreve**. Efeito:
"presente sem tarefa" **nunca acontece**; todo operário sem cronômetro ativo cai em **"ausente"**.
É exatamente o efeito colateral que avisamos: sem presença, some a distinção "parado na oficina"
× "foi embora". **Decisão:** (a) aceitar **3 estados** (produzindo / em pausa / ausente) e
ajustar o painel; ou (b) derivar "presente" de outra coisa (ex.: teve apontamento hoje); ou
(c) reintroduzir uma presença leve (início/fim de turno) — sem cara de ponto/RH.

### A2. Correção de anomalia — precisa de plano de schema (toca banco/grants)
Ver C2: o jeito certo (log append-only + motivo obrigatório) exige **tabela nova** e mexe em
grants → pela CLAUDE.md, **PARE e aprove o plano** antes de aplicar (a própria Migration 006 já
vem com "NÃO APLICAR SEM APROVAÇÃO"). Bom: ainda **não está ativa**, então dá tempo de acertar.

### A3. Lockdown de leitura / 2ª oficina — toca RLS (decisão + plano)
Ver D. Resolver o lockdown mexe em RLS/grants → **PARE e aprove o plano**. E, até lá,
**NÃO cadastrar 2ª oficina real** (vazaria dado entre clientes).

---

## B. RELÓGIO DO SERVIDOR — regra travada VIOLADA (risco real)

Regra: todo tempo decorrido usa `now()` do **banco**, nunca do dispositivo.
- A **âncora** está certa (`hora_inicio`/`registrado_em` são `DEFAULT now()` do servidor).
- Mas o **"agora"** do cálculo é do cliente (`Date.now()`):
  - `anomalias-queries.ts:79` → alimenta o **teto anti-fantasma** (10,5h). **ALTA.**
  - `dono-queries.ts:105` → **dias na oficina** e **saúde de prazo**. **ALTA.**
  - `queries.ts` cronômetro ao vivo (`useCronometro` ~411) → **MÉDIA** (só display).
- Risco: relógio torto do tablet/PC cria fantasma falso ou esconde fantasma real; e marca carro
  "estourado" que não estourou. **Correção:** o read model devolve os tempos **já calculados
  pelo Postgres** (`extract(epoch from now() - hora_inicio)`), a tela só renderiza
  (NOTAS-TECNICAS item 2). Casa com mover a leitura pro servidor (ver D).

---

## C. ANOMALIA / APONTAMENTO

### C1. Teto anti-fantasma (10,5h): existe, valor certo, mas no relógio do cliente
`anomalias-queries.ts:18,82` — detecção OK, mas usa `Date.now()` (ver B). Os outros 3 gatilhos
do Pacote 2 (cronômetro após o turno; ausente-com-cronômetro; OS produzindo parada) **não**
existem ainda — aceitável no MVP se for consciente; o teto pega o caso mais comum.

### C2. Correção de fantasma VIOLA a regra de auditoria do Pacote 2 (ALTA)
`anomalias-queries.ts:122-145` faz **UPDATE destrutivo** na linha original (sobrescreve
`status_tarefa`/`hora_fim`), **sem** preservar o valor bruto, **sem** tabela de correções,
**sem** gravar quem/quando, e **sem exigir motivo**. O Pacote 2 manda o oposto: log
**append-only**, motivo **obrigatório**, trilha "marcou 14h → admin corrigiu pra 8h porque X".
**É o "laço fatal" da adoção.** Correção: tabela `apontamento_correcoes` (original imutável +
motivo NOT NULL + admin + timestamp + valor antes/depois). → **A2 (plano de schema).**

---

## D. ISOLAMENTO MULTI-TENANT — CRÍTICO com 2+ oficinas

- O banco de **teste** foi montado pelo `000_bootstrap_test.sql`, que recriou **policies
  abertas de leitura do anon** (`USING(true)` em ordens_servico, apontamentos, pontos,
  funcionários). As migrations 001/002 (que isolam por JWT) descrevem o estado de prod, **não**
  o que roda no teste.
- As queries do painel **não filtram por `oficina_id`** — confiam no RLS. Com as policies
  abertas, o RLS **não corta** → leitura traz dado de **todas** as oficinas.
- As leituras rodam **no browser com a anon key**; **não há API routes** (`src/app/api` não
  existe) — contraria a NOTA-TÉCNICA item 1.
- **Lockdown não existe** nas migrations atuais (001–006). Ainda dependemos das policies abertas
  pro totem/painel funcionarem com anon.
- **Veredito:** com **UMA** oficina (piloto Auto Risco) está **OK** — não há outro tenant de
  quem vazar. **NÃO cadastrar a 2ª oficina** até: (1) mover leitura pro servidor e (2) aplicar o
  lockdown das policies abertas — nessa ordem (senão o totem anon quebra). Ambos = **plano +
  aprovação** (A3).
- Conforme (bom): `oficina_id` sempre vem do **JWT**, nunca de input do cliente; escrita já é
  isolada por `WITH CHECK`; `user_oficinas` já tem policy isolada; índice de placa já é
  `(oficina_id, placa)`.

---

## E. CONFORME — não mexer

- Predicado "apontamento ativo" (rodando=Em andamento / pausado=Pausado) consistente entre
  escrita e leitura.
- Placa: normalização maiúsculas + buscar-antes-de-criar + uma OS ativa por placa (índice
  parcial 005). Tudo certo e multi-tenant-safe.
- Derivação dos estados do operário está logicamente correta (só furada pela ausência de ponto — A1).

---

## Prioridade pro PILOTO DE HOJE (1 oficina, ambiente de teste)

1. **Não bloqueia hoje:** isolamento multi-tenant (só morde com 2ª oficina) — apenas **não
   cadastre** uma segunda. Demo com Auto Risco roda.
2. **Decisão sua agora:** A1 (3 estados vs reintroduzir presença leve) — define se o painel
   mostra "presente sem tarefa".
3. **Antes de ligar a correção de anomalia:** redesenhar append-only + motivo (A2) — está
   inativa, então não quebra a demo, mas não ligue como está.
4. **Acurácia:** mover cálculo de tempo pro servidor (B) — senão anomalia/prazo erram com
   relógio torto.
