# Plano — Correção de Anomalia (log à prova de auditoria)

**Status: PLANO PARA APROVAÇÃO.** Não aplicar. Mexe em schema + grants → pela CLAUDE.md exige
o aval do fundador antes do Code implementar (o SQL é do Code). Resolve a violação apontada na
auditoria: hoje a correção **sobrescreve** o tempo original, sem motivo e sem rastro.

---

## 1. Objetivo e invariantes (o "laço fatal" do Pacote 2)

A correção precisa manter o dado **crível**: o admin conserta um fantasma sem ninguém poder
acusar "mexeram no meu tempo escondido". Invariantes inegociáveis:

1. **Registro original imutável.** Nunca sobrescrever o apontamento bruto (nem `hora_inicio`,
   nem `hora_fim`, nem `status`).
2. **Correção é acréscimo** (append-only): um registro novo, separado e ligado ao apontamento.
3. **Motivo obrigatório.** Sem motivo, não salva.
4. **Quem + quando + antes + depois** sempre gravados.
5. **Marca "editado pelo admin" visível** (operário e dono veem que houve correção).
6. **Só admin/gerente** corrige (operário não edita o próprio tempo).
7. **Tempos do servidor** (a correção carimba `now()` do banco, nunca do dispositivo).

---

## 2. Modelo de dados (o "quê" — o Code escreve o DDL)

**Tabela nova `apontamento_correcoes`** (aditiva, append-only). Campos conceituais:

| Campo | Para quê |
| --- | --- |
| `id` | identidade da correção |
| `apontamento_id` | liga ao apontamento original (FK) |
| `oficina_id` | isolamento multi-tenant (carimbado pelo trigger do JWT, igual às outras tabelas) |
| `admin_user_id` | QUEM corrigiu (`auth.uid()`) |
| `corrigido_em` | QUANDO (`default now()` do servidor) |
| `acao` | `ajustar_fim` · `descartar` · `confirmar` (as 3 ações do Pacote 2) |
| `valor_original` | foto do bruto no momento (início, fim, status, duração) — o "antes" |
| `valor_corrigido` | o "depois" (novo fim / status / duração efetiva); vazio em `descartar` |
| `motivo` | texto **obrigatório** (não nulo, não vazio) |
| `motivo_codigo` | opcional, lista curta: `esqueceu_parar` · `saiu_sem_registrar` · `erro_toque` · `outro` |

**No apontamento original:** manter a coluna-flag `editado_admin` (já criada na 006) **só como
marcador** ("tem correção") para o badge na UI e para os leitores saberem que devem consultar a
correção. O valor bruto do apontamento **não muda**.

---

## 3. Fluxo de UX (admin corrigindo um fantasma)

1. Painel destaca a anomalia (quem, OS, início, duração, **por que** foi marcada).
2. Admin escolhe a ação: **Ajustar o fim** (sistema sugere horários plausíveis) · **Descartar**
   (não houve trabalho) · **Confirmar** (era real, raro).
3. **Motivo é exigido** (lista curta + campo livre). **Sem motivo, o botão não salva.**
4. Confirma → grava 1 linha em `apontamento_correcoes` + marca `editado_admin = true`.
5. UI mostra o badge leve "editado pelo admin" na linha dali em diante.

---

## 4. Leitura correta (pra não "ressuscitar" o fantasma)

Como o bruto não muda, todo leitor de tempo deve usar **uma derivação canônica única** de
"tempo efetivo" e "ainda ativo?", que consulta a correção mais recente:

- "apontamento ativo?" = status ativo **e** sem correção que o encerre/descarte.
- "tempo trabalhado efetivo" = `valor_corrigido` se houver correção; senão, o bruto.

Definir isso **uma vez** (ex.: uma view ou função no banco) e todos os painéis lerem dali —
senão um leitor esquece a regra e o fantasma reaparece. (Casa com a frente "servidor calcula o
tempo" do diagnóstico.)

---

## 5. Multi-tenant e permissões

- `oficina_id` carimbado pelo trigger do JWT (mesmo padrão das outras tabelas) — isolamento.
- RLS na `apontamento_correcoes`: leitura/escrita só da própria oficina; **escrita só para papel
  gerente/dono**.
- Grants alinhados (a 006 já abriu UPDATE de `editado_admin`; agora o grant principal é INSERT
  na tabela de correções, não UPDATE destrutivo no apontamento).

---

## 6. O que muda na Migration 006 atual

A 006 hoje habilita um **UPDATE destrutivo** no apontamento. O plano **substitui** isso:
- Nova migration **aditiva**: cria `apontamento_correcoes` + RLS + trigger de `oficina_id`.
- A lógica de correção passa a **INSERIR** na nova tabela (e marcar `editado_admin`), em vez de
  sobrescrever o apontamento.
- Manter a 006 **desligada** até esta troca (ela já vem com "não aplicar sem aprovação").

---

## 7. Sequência e o que precisa do seu aval

1. **Você aprova este plano** (toca schema/grants).
2. Code escreve a migration aditiva + ajusta a query de correção (INSERT, não UPDATE) + a
   derivação canônica de tempo efetivo.
3. Testar no TESTE: criar um fantasma, corrigir, conferir que o **bruto continua lá** e a
   trilha (quem/quando/motivo/antes→depois) aparece.
4. Só então ligar a correção no painel.

**Decisão sua:** aprovar o desenho append-only acima como está, ou ajustar algo antes de mandar
o Code implementar?
