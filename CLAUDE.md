@AGENTS.md

# GDelta-Totem — Fonte da verdade (escopo + regras de trabalho)

> ⛔ **DECISÕES APROVADAS PELO FUNDADOR — NÃO REVERTER (autoridade máxima).**
> As decisões abaixo foram **aprovadas explicitamente pelo fundador (Eliel)** e são **lei**.
> NENHUM agente, Code ou workflow pode revertê-las, "melhorá-las" ou ignorá-las por conta
> própria. Discordou? **Sinaliza ao fundador e PARA — nunca reverte.** Reverter decisão
> aprovada do fundador é **violação de governança** e está proibido.
>
> 1. **Marca SEM dourado.** GDelta = **marinho `#0b3857` + teal `#13678d` + off-white
>    `#f5f4f2`**. **NÃO existe gold/dourado, "escudo dourado" nem tema "premium gold".**
>    Remover todo token `--gd-gold*`, todo anel/selo/chip/realce dourado e o
>    `public/gdelta-shield.png`. Logos oficiais (NÃO regenerar):
>    `public/gdelta-logo-full.png` e `public/gdelta-totem-symbol.png`.
> 2. **Padrão de nome:** marca **GDelta** (uma palavra), produto **GDelta Totem** (ver abaixo).
> 3. **AIOX ativo** sob os checks de segurança (ver Processo).
> 4. **agents-guru integrado (caminho A)** — não desfazer.

> **Padrão de nome (01/06/2026):** marca = **GDelta** (uma palavra; logo estilizada
> "G|DELTA"); produto = **GDelta Totem**. Em texto visível ao usuário e metadados, usar
> **GDelta** — nunca "G Delta" com espaço. Nomes literais externos NÃO mudam (pasta
> `GDelta-Totem`, projeto Supabase `GDelta-Totem-Teste`).

> Estas regras valem em TODA sessão. Leia antes de qualquer ação. Em conflito com
> qualquer outra orientação, as regras de **segurança/ambiente** (Ambientes, Disciplina)
> prevalecem. O **escopo MVP (abaixo) está TRAVADO** — não reabrir decisões fechadas.

## Produto

**GDelta-Totem** — SaaS de **produtividade OPERACIONAL** para oficinas de **funilaria e
pintura**. Dois componentes:

- **Totem** (tablet-quiosque): operário toca no nome → acha a OS pela placa → escolhe a
  etapa → roda cronômetro/pausa (apontamento). Adoção é lei: **nenhuma ação comum pode
  custar mais de dois toques**.
- **Painel** (`/admin`): o dono vê produtividade e saúde de prazos em tempo real.

**Complementa a Cília** (sistema de gestão dominante no setor, ~5000 oficinas, sem módulo
de chão de oficina). **Não compete** com ela.
Posicionamento: _"A Cília te mostra onde o carro está; o GDelta te mostra quanto tempo o
operário passou nele e se a equipe está dentro do benchmark."_

**NÃO faz** (fora de escopo, definitivo): financeiro/DRE, BPO, CRM, pipeline de orçamento,
fiscal, cobrança Asaas. O banco tem colunas financeiras + Asaas **dormentes** na tabela
`oficinas` (resíduo de escopo antigo): **não dropar, não construir em cima**.

**Piloto:** oficina "Auto Risco" (full-service, mas o piloto rastreia só funilaria/pintura).
**Critério de sucesso (TRAVADO):** _o dono abre o painel sozinho, ≥1x/dia, por 2 semanas
seguidas, e afirma que pagaria por isso._

## Objetivo (técnico)

Conectar o app (hoje **single-tenant, anon key no browser**) ao banco **multi-tenant**
**SEM quebrar o totem que já funciona**.

## Sequência segura (NESTA ordem, um passo por vez)

1. **Auth real** (oficina autentica o device; dono tem conta real) — **FEITO (Fase 1)**
2. **`oficina_id` no JWT** — **FEITO (Fase 1)**
3. **Mover queries para o servidor (API Routes)**
4. **SÓ ENTÃO Migration 003** — remover/restringir as policies abertas do `anon`.

> ⚠️ A **Migration 003 é a ÚLTIMA coisa**. Rodá-la antes dos passos 1–3 **quebra o
> totem** (o app usa anon key e depende das policies abertas do anon).

> ⚠️ **NÃO cadastrar uma SEGUNDA oficina real enquanto a migration de lockdown de
> leitura não for aplicada.** Hoje as políticas abertas de leitura deixam qualquer usuário
> logado ler tudo — com duas oficinas, isso **vazaria dado entre clientes**. Com UMA
> oficina (piloto) está ok.

## Ambientes — REGRA CRÍTICA

- **Trabalhar SOMENTE no projeto de TESTE:** `GDelta-Totem-Teste` — São Paulo —
  ref `pvrnimckfgdmgjrjueap`.
- **NUNCA tocar (escrever/alterar) no de PRODUÇÃO:** `GDelta-CT's Project` — Oregon —
  ref `ccpxwnbxvmadcafxnbjs`. Somente leitura, e apenas até autorização explícita do fundador.
  (Bug conhecido, só anotado: totem de produção dá 401 no anon — a migration 001 revogou os
  GRANTs do anon e nunca restaurou; correção futura via GRANT cirúrgico, sob ordem explícita.)
- Antes de QUALQUER operação de escrita no banco, **confirmar o ref de destino** e mostrar ao fundador.

## Arquitetura (totem compartilhado)

- A **OFICINA** autentica o **device** → é daí que vem o `oficina_id` no JWT.
- O **OPERÁRIO** só se identifica por **nome** (o PIN de 6 dígitos validado no servidor já
  tem lugar no schema via `pin_hash`, mas o **piloto roda SEM PIN** — a sessão do device já
  isola a oficina; PIN só afeta atribuição intra-oficina, aceitável no piloto com dono presente).
- O **DONO** tem **conta real** e acessa `/admin`.

Stack: Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase + Vercel.

## Escopo MVP — TRAVADO (não reabrir)

### Produtividade (sem ponto/jornada)

A GDelta é produto de **produtividade**, não de ponto/jornada (não RH/folha/CLT — não toca
na relação trabalhista). **Não há camada de presença** (removida): o gancho de adoção é
tocar no nome → achar a OS → iniciar a etapa. O trabalho é logado pelo **apontamento**
(tarefa), não por batida de ponto. Almoço/fim de expediente = **pausas de apontamento**.
A tabela `pontos_eletronicos` fica **deprecada** (não dropada).

### Modelo de tempo

- **Tempo trabalhado** (soma dos apontamentos ativos) × **tempo de calendário**
  (entrada→agora). O painel mostra os dois.
- **Um** apontamento ativo por operário (iniciar outro pausa o atual).
- **Regra dos 15 min = regra de USO** (treino no dia 1, não cálculo do sistema): só pausa
  se a parada for prevista >15 min, escolhendo motivo; paradas curtas viram tempo trabalhado.
- **Teto anti-fantasma:** apontamento ativo muito acima de ~10,5h → anomalia para o admin
  corrigir. (Sem presença/fim-de-expediente automático: timer esquecido vira anomalia,
  tratada só pela correção do admin sobre `apontamentos`.)
- Tempos ancorados no relógio do **servidor**, nunca do tablet.

### Kanban / OS

- Colunas = as **8 etapas do código**: Desmontagem · Funilaria · Preparação · Pintura ·
  Polimento · Montagem · Qualidade · Entrega. ("Orçamento" fica fora = pré-produção/Cília.)
- `etapa_atual` (coluna do kanban) ≠ `status_geral` (ciclo de vida). `etapa_atual` é setada
  quando o operário **inicia** uma tarefa naquela etapa (explícito, não derivado); admin pode
  arrastar para corrigir. Dois operários em etapas diferentes no mesmo carro → "último que
  iniciou vence" seta a coluna, mas o card mostra **TODOS** os apontamentos ativos.
- Card mostra 3 estados do carro: em trabalho / etapa concluída aguardando próxima / bloqueado.
- Ao finalizar tarefa: perguntar **"etapa concluída?"** (sim → "aguardando próxima etapa").
  _(Primeiro candidato a cortar se a adoção sofrer.)_
- **Placa:** única-PARCIAL (uma OS **ativa** por placa, histórico preservado) + normalização
  maiúsculas + buscar-antes-de-criar.
- **Entregue:** admin marca "entregue" → OS sai do quadro ativo para o arquivo + fecha
  apontamentos abertos.

### Bloqueio (distinto da pausa do operário)

Flag com motivo: {aguardando peça, em outro setor, aguardando aprovação, aguardando cura}.
Divisão visual (mesmo modelo de dados, cor/ícone diferente): **bloqueio-PROBLEMA** (peça,
aprovação) × **bloqueio-FLUXO** (outro setor, cura). Tempo de calendário corre; trabalhado não.

### Retrabalho e complexidade

- **Retrabalho:** flag booleano no apontamento (checkbox no início). Auto-reportado → piso.
- **Complexidade:** campo em **todo** apontamento, escala única de 3 níveis
  (simples/médio/complexo), **"simples" pré-selecionado** (zero toque extra). Análise por
  nível / especialista = Fase 2.

### Conectividade

**"Não perder ação em queda de conexão" é obrigatório** (mostrar "não salvou, tenta de
novo"). Sync offline = Fase 2.

## Campos da OS (FINAL)

placa · modelo · ref Cília (opcional) · data de entrada (já existe) · **data prometida**
(prazo) · **tipo de cliente** · **valor do orçamento (R$)** · `etapa_atual` · `status_geral` ·
bloqueio/motivo.

- **`tipo de cliente`** (CONFIRMADO INCLUIR): **seguradora / cooperativa / particular**
  (frota = Fase 2). Pré-preenche o prazo sugerido (seguradora/cooperativa ~30 dias,
  particular menor) e segmenta a visão de valor do dono.
- **Princípio de escopo:** só campos que servem ao **tracking de produção** OU a uma
  **pergunta do dono**. Nome/telefone do cliente, seguradora, nº de sinistro, peças, serviços,
  preços ficam na **Cília** (replicar = digitação dupla).

## Papéis e painel

- **UM** painel com acesso por papel (não dois apps construídos do zero).
  - **Operário** → totem.
  - **Admin/gerente** (papel `gerente`) → cria/edita OS + funcionário, corrige anomalias,
    visão operacional. **Correção de anomalias é do ADMIN** — feature de primeira classe do
    MVP (editar tempo de apontamento, fechar fantasma, mover card); marca leve "editado pelo
    admin".
  - **Dono** → produtividade + saúde de prazos + ROI; **mais leitura**.
- **3 estados do operário no painel:** produzindo / em pausa (com motivo) / sem tarefa
  ativa. (Sem presença: a faixa mostra só quem teve apontamento hoje, derivado de apontamentos.)
- Painel responde 2 perguntas do dono: **"todo mundo produzindo agora?"** e **"que carro
  está travado/lento?"**.
- Operário acha o carro: lista buscável de carros **ativos** por placa, mais recentes primeiro.
- Admin cria OS / funcionário pelo **painel** (não pelo totem).

### Painel do dono — 2 camadas

1. **PRAZO = holofote** (grande na tela): carros dentro do prazo / perto de estourar +
   **ticket médio "dias na oficina × R$ do orçamento"** (revela barato-lento = prejuízo
   disfarçado × caro-rápido = ouro). **Fica no MVP.**
2. **PRODUTIVIDADE INDIVIDUAL = fundação agora** (coletada + mostrada via os 3 estados);
   ranking/reconhecimento = Fase 2 (não julgar pessoas em dado ainda não provado).

**ROI derivado de hora-homem = fast-follow (não MVP):** só com taxas reais setadas pelo
admin (os defaults 85/28 são placeholders que enganariam); nunca fabricar um "antes"; não
enquadrar toda ociosidade como puro prejuízo. O ticket "dias × R$" (acima) **não** é ROI de
hora-homem e **fica no MVP**.

**Papéis no piloto:** dona da Auto Risco = dono; Eliel + uma pessoa da Auto Risco =
admin/gerente, mas a pessoa da Auto Risco opera desde cedo e **Eliel tira a mão da operação
diária na semana 2** (entra no critério de sucesso, para a adoção não ser mascarada).

## Refinamentos do painel (pesquisa de domínio — incorporar)

1. **Vocabulário de KPI + benchmarks** (credibilidade com donos que já ouviram PPG/AkzoNobel):
   - **Tempo de Ciclo** (key-to-key) <5–7 dias = "dias na oficina".
   - **Horas Tocadas** (touch time) 3–4h/dia bom, <1,5h ruim = trabalhado × calendário.
   - **Retrabalho** → 0 (ou <3%).
   - **Ocupação de Pátio** 70–85% (100% = "efeito Tetris").
   - **Ticket Médio**.
2. **O painel é o quadro digital do "Daily Huddle"** (reunião matinal de pé, 10–15 min:
   quais carros estão atrasados, quais faturam hoje, o que travou). Esse ritual é o que faz
   o dono abrir o painel ≥1x/dia — exatamente o critério de sucesso. Valida a camada de prazo.
3. **Ordem das colunas A CONFIRMAR com a Auto Risco:** a pesquisa põe Montagem **antes** de
   Polimento; o código tem Polimento antes. Oficinas variam — confirmar e setar a ordem (custa nada).

## Estado atual e ordem de construção

**Feito e validado:** Fase 0 (espelho do ambiente de teste: 6 tabelas — `oficinas`,
`user_oficinas`, `funcionarios`, `ordens_servico`, `apontamentos`, `pontos_eletronicos`; RLS
habilitado+forçado, 13 policies, 17 índices, trigger `set_atualizado_em`, seed com 1 oficina
Demo, 4 funcionários, 3 OS incl. placa ABC1D23) e Fase 1 (auth de device + `oficina_id` no
JWT via Custom Access Token Hook + triggers BEFORE INSERT; `DeviceAuthGate` no totem; login →
totem → bater ponto grava, confirmado no navegador). App apontado ao teste via `.env.local`
(valores de produção comentados para revert fácil). Dev server em `http://localhost:3000`.

**Ordem de construção (A.1):**

1. **Admin cria OS + funcionário** (CRUD — próximo passo)
2. Totem aponta _(já existe — conectar ao multi-tenant)_
3. Visão operacional ao vivo (kanban + 3 estados do operário)
   - **3.5 — slot da visão de saúde de prazos do dono** (distinta do kanban operacional;
     logo após o passo 3)
4. Correção do admin
5. ROI / resumo

**Fase 2 (fora do MVP):** trava de etapa/função, integração Cília, PIN forte, Realtime,
multi-totem, sync offline, etapas configuráveis por oficina, ROI "antes × depois",
sobreposição dono+admin, reconhecimento/ranking, 4º tipo de cliente "frota", análise de
complexidade por nível, "tipo de defeito" no retrabalho, etapas de chassi/alinhamento e ADAS.

## Disciplina de execução

- **O fundador é não-técnico:** explicar em linguagem acessível, sem jargão desnecessário;
  quando usar um termo técnico, dizer o que ele significa na prática.
- **Mostrar o que vai fazer ANTES** de qualquer mudança (diff antes de salvar).
- **Um passo pequeno e reversível por vez.**
- **Manter o totem funcionando** a cada passo.
- **NÃO reabrir** decisões travadas no escopo MVP acima.
- **Em erro: PARAR e perguntar** (não improvisar).
- **NÃO fazer `git push` sem autorização explícita** do fundador.
- Recomendar **UMA** opção clara, não um menu (proteger o foco do fundador).

## Autonomia e escalonamento

O fundador é não-técnico e quer se envolver só no essencial. Aja com autonomia dentro
destas regras.

**FAÇA sem pedir aprovação** (e reporte depois em resumo curto):

- Ler/inspecionar repo e banco; comandos de leitura (`find`, `cat`, `grep`, `git status/diff`).
- Escrever código que implementa o escopo travado.
- Migrations puramente **ADITIVAS** no TESTE (só colunas/índices, sem mexer em
  permissões/RLS), **após confirmar que o CLI está linkado no TESTE** (`pvrnimckfgdmgjrjueap`).
- Rodar dev server, testar, verificar isolamento.
- Escolhas técnicas de implementação dentro do escopo (recomende UMA, siga, documente).

**PARE e apresente plano/diff para aprovação:**

- Migrations que mudem **permissões/GRANTS/RLS**, ou **destrutivas** (drop/perda de dado).
- Mudanças em **autenticação** ou no **isolamento multi-tenant**.

**PARE e peça DECISÃO do fundador** (não decida por ele):

- Qualquer coisa que toque a **PRODUÇÃO** (`ccpxwnbxvmadcafxnbjs`).
- `git push`, deploy, publicar.
- Gastar dinheiro / serviço pago.
- Mudar o **escopo travado** ou adicionar feature fora dele.
- Trade-off de produto/negócio sem resposta óbvia, ou quando estiver incerto e fosse chutar.

**Sempre:** um passo pequeno e reversível por vez; mantenha o totem funcionando; resumo
curto ao fim de cada passo.

## Processo

- AIOX **ativo** sob governança plena (decisão do fundador, 01/06/2026), MAS manter os **checks de segurança**
  e a regra de **não publicar sem revisão**.
- **AIOX ATIVO (decisão do fundador, 01/06/2026):** as regras em `.claude/rules/` (matriz de delegação,
  workflows, governança de agentes) estão **em vigor** — **devemos
  acionar os agentes e a matriz de delegação** conforme definido. Os **checks de segurança** continuam valendo sobre tudo:
  revisar antes de publicar, diff antes de salvar, um passo pequeno e reversível por vez. **Anti-colisão:** enquanto um executor estiver com posse de um build ativo, a escrita de código fica serializada — um por vez no mesmo arquivo/área — pra não conflitar nem atrasar.
