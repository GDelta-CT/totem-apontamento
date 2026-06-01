# GDelta Totem — Pacotes de Produto & Comercial

Documentação e lógica de negócio. Sem código. Os Pacotes 1 e 2 são insumo pro Claude Code;
os Pacotes 3 e 4 são pra você ir a campo.

> **Nota de coordenação:** os números de "Passo" aqui são a visão de **estratégia**. O Claude
> Code tem a própria ordem de build (003/004 → camada de dados → login → telas). Quando for
> abastecer o Code, fale por **nome da funcionalidade** (Kanban, correção de anomalia), **não**
> por número de passo, pra não embolar as duas numerações.

---

## Pacote 1 — Arquitetura do Kanban e Estados (Visão Operacional ao Vivo)

Isto é o "o quê" (lógica de produto). O "como" técnico — tabelas, tempo-real — é o Code que
desenha na hora de construir.

### As duas dimensões

O painel cruza **DUAS coisas independentes**:

- **Colunas = as 8 etapas da OS** (onde o carro está no processo):
  Desmontagem → Funilaria → Preparação → Pintura → Polimento → Montagem → Qualidade → Entrega.
  Cada OS é um **card** que anda da esquerda pra direita conforme a `etapa_atual` muda.
- **Estado do operário** = o que a **PESSOA** está fazendo (independente da OS):
  - **Produzindo** — cronômetro rodando numa OS.
  - **Em pausa** — parou (almoço, descanso).
  - **Presente sem tarefa** — bateu ponto, está na oficina, mas sem OS atribuída.
  - **Ausente** — não está presente / saiu.

### Como cruzam

O card de cada OS mostra **quem está nela** e o **estado daquela pessoa**. Isso dá ao dono,
num relance:

- O que está **andando** (alguém produzindo).
- O que está **parado e por quê** (bloqueado, ou a pessoa em pausa / sem tarefa / ausente).
- Onde está o **gargalo** (coluna entupida, gente parada).

### A regra de cor (prioridade de exibição) — "bloqueado sobrepõe tudo"

A cor do card segue uma **ORDEM DE PRIORIDADE**. O primeiro que bater, vence:

1. **Bloqueado — problema** (aguardando peça, aguardando aprovação): **VERMELHO**. Sobrepõe
   qualquer outra info. É o que o dono precisa resolver AGORA. Mostra o motivo no card.
2. **Bloqueado — fluxo** (em outro setor, aguardando cura): **ÂMBAR**. Está parado, mas é
   espera esperada — não exige ação, só visibilidade.
3. **Produzindo**: **VERDE**. Tem gente trabalhando, cronômetro rodando.
4. **Presente sem tarefa**: **CINZA** (destaque na pessoa). Sinal pro dono: "tem mão livre,
   distribui serviço."
5. **Em pausa**: **AZUL/NEUTRO**. Normal, sem alarme.
6. **Ausente com cronômetro rodando**: o **"fantasma"** — borda de **ALERTA** (ver Pacote 2).

**Regra de ouro:** bloqueado (1 e 2) **sempre ganha** da cor de estado do operário (3–6). Um
carro parado esperando peça é mais importante de ver do que quem está mexendo nele.

### Máquina de estados (resumo)

- **OS:** ativa → (em uma das 8 etapas) → pode entrar em "bloqueada" (com motivo) a qualquer
  momento e voltar pro fluxo → **Entregue** (sai do board ativo).
- **Operário:** ausente ⇄ presente sem tarefa ⇄ produzindo ⇄ em pausa. "Produzindo" sempre
  aponta pra **UMA** OS. Sair de "produzindo" (pausa/ausente) **deveria** parar o cronômetro
  daquela OS — e quando NÃO para, nasce o **fantasma** do Pacote 2.

---

## Pacote 2 — Fluxo de Correção de Anomalias (o "laço fatal")

Se o dado fica obviamente errado, todo mundo para de confiar no totem e a adoção morre. Este
pacote existe pra manter o dado **crível**.

### Os alertas que o painel deve dar

O sistema marca como "suspeito" e mostra pro Admin quando:

- Um apontamento passa de **10,5h** rodando (mais que um turno real).
- O cronômetro **continua rodando depois do horário** de fechar a oficina.
- A pessoa está marcada como **ausente mas tem cronômetro rodando** numa OS (contradição).
- Uma OS está "produzindo" **há muito tempo sem nenhuma interação** (sem trocar de etapa, sem toque).

Esses casos aparecem numa área **"Revisar apontamentos"** + um **selo no card** da OS afetada.

### O fluxo de UX pro Admin corrigir um "fantasma"

1. O painel **destaca** o apontamento suspeito (quem, qual OS, início, tempo decorrido e
   **POR QUE** foi marcado).
2. O Admin abre e escolhe uma ação:
   - **Ajustar o fim** — "encerrou às 17:30, quando bateu o fim do turno."
   - **Descartar** — foi engano, não houve trabalho.
   - **Confirmar** — era legítimo (serviço longo raro).
3. A correção **EXIGE um motivo** (lista: "esqueceu de parar o cronômetro", "saiu sem
   registrar", "erro de toque"…). Sem motivo, não salva.

### A regra de negócio que protege o log de auditoria

**Nunca sobrescreva o registro original.** A correção é sempre **acrescentada**, nunca apagada
por cima:

- O apontamento original fica **imutável**.
- A correção entra como **registro separado e ligado**: quem corrigiu (Admin), quando, o
  valor original, o valor corrigido e o motivo.
- O "tempo trabalhado" que vai pros relatórios passa a ser o **valor corrigido** — mas o
  original e a trilha da correção continuam guardados.

**Resultado:** o log é **só-acréscimo**. Sempre dá pra ver "o sistema marcou 14h; o Admin
corrigiu pra 8h em [data] porque [motivo]". É isso que mantém a confiança — ninguém edita
número escondido, e ninguém pode acusar o dono de "mexer no tempo dos outros".

_(Isto é a regra. O Code decide a implementação — provavelmente uma tabela de
correções/ajustes ligada ao apontamento, nunca um UPDATE que apaga o valor antigo.)_

---

## Pacote 3 — Roteiro de Onboarding: o "Dia 1" na Auto Risco

5–10 min, pra você falar com os funileiros e pintores no dia de pendurar o totem.
Tom: **justiça e organização — nunca vigilância.** Adapte às suas palavras.

**Abertura (o porquê, de cara):** "Pessoal, esse aparelho na parede não é pra vigiar ninguém.
É pra organizar o serviço e pra cada um levar o crédito do que faz. Hoje, quando um carro
atrasa ou some uma peça, vira aquela conversa de 'quem fez, quem não fez'. Isso aqui acaba com
a adivinhação."

**O que é e como usa (simples):** "Quando você pega um carro pra trabalhar, bate aqui na OS
dele e diz que começou. Quando para — almoço, café, foi ajudar em outro setor — você marca a
pausa. Quando termina sua parte, marca e passa pra frente. Só isso. Leva 5 segundos."

**A regra dos 15 minutos de pausa (justa e clara):** "Pausa curta — banheiro, água, um café
rápido, até uns 15 minutos — não precisa marcar, é o normal do dia. Parada maior que isso —
almoço, sair da oficina — aí sim a gente marca, pra não contar como se você estivesse no
carro. É pra ser justo COM você: o tempo que aparece é o que você realmente trabalhou, não o
que passou na fila do banheiro."

**Como registrar um retrabalho (sem caça às bruxas):** "Se um carro volta pra refazer alguma
coisa, a gente marca como retrabalho. E olha: isso NÃO é pra achar culpado. É pra a gente
enxergar onde o processo está falhando e arrumar. Retrabalho marcado é problema sendo
resolvido; retrabalho escondido é problema que volta."

**Cortando o medo (fale antes que perguntem):** "Pode bater na cabeça: 'isso vai virar
cobrança? vão me mandar embora pelos números?'. Não é isso. É pra eu saber distribuir melhor o
serviço, ver onde tem gargalo e — sim — na hora de reconhecer quem puxa o carro, ter como
mostrar com clareza, não no achismo."

**Fechamento (o que eles ganham):** "No fim, ganha todo mundo: menos discussão sobre quem fez
o quê, serviço mais organizado, carro saindo no prazo, e a sua parte aparecendo de verdade.
Qualquer dúvida no aparelho, me chama que a gente resolve junto."

---

## Pacote 4 — Estruturação Comercial (Setup + Mensalidade)

Estrutura de venda pro pós-piloto, usando a Auto Risco como prova. Os números são **SEUS** —
abaixo está a lógica e como ancorar; preencha com seu custo real de hardware e com os
resultados do piloto.

### A oferta (o que o cliente leva)

O totem de produção + o painel de gestão do dono + acompanhamento. Vende-se o **RESULTADO**
(oficina organizada, prazo cumprido, tempo medido), não o software.

### Taxa de Setup — a argumentação

Cobre duas coisas, e as duas viram argumento de venda:

1. **Hardware e instalação** (tablet/totem, configuração, treinamento do Dia 1). É custo real,
   não dá pra absorver.
2. **Filtro de compromisso.** Cliente que paga setup tem "pele no jogo" — implanta de verdade,
   treina a equipe, usa. Cliente que ganha de graça larga na primeira semana. O setup protege
   a sua taxa de sucesso, e cada cliente que dá certo vira sua próxima referência.

**Argumento pro cliente:** "A taxa de setup cobre o equipamento e a implantação acompanhada —
e existe justamente pra garantir que isso entre na sua oficina pra funcionar, não pra virar
mais um aparelho encostado."

_(Defina o valor pelo custo do hardware + sua margem de implantação. Regra prática: alto o
bastante pra filtrar, baixo o bastante pra não travar a decisão.)_

### Mensalidade — ancorada no ROI

A mensalidade **não** se ancora no "preço do sistema", e sim no que ele **DEVOLVE**. As duas
alavancas:

1. **Tempo-homem salvo** — menos hora ociosa, menos hora-fantasma, menos retrabalho silencioso.
2. **Prazo cumprido** — throughput mais rápido, menos atraso → seguradora satisfeita → mais
   carros liberados pra você.

**Como montar o número (com dado real do piloto, não chute):**

- Pegue do piloto da Auto Risco: quantas horas/semana de ociosidade ou fantasma o painel
  revelou; quantos retrabalhos viraram visíveis; o quanto o prazo médio caiu.
- Traduza UMA dessas em dinheiro pro dono (ex.: "X horas/mês recuperadas × o valor da hora da
  equipe = R$ Y").
- A mensalidade tem que ser uma **FRAÇÃO confortável** desse Y. Se o sistema devolve R$ Y e
  custa uma fração disso, a conta se vende sozinha.

**Narrativa de venda (pós-piloto):** "Na Auto Risco, em [período], o painel mostrou [resultado
real]. Você paga [mensalidade] e recupera [múltiplo disso] em tempo e prazo. O setup garante a
entrada certa; a mensalidade se paga no primeiro mês."

**Lembrete honesto:** eu não inventei valores aqui de propósito — setup, mensalidade e ROI
saem do seu custo de hardware e dos dados reais que o piloto da Auto Risco gerar. Quando o
piloto fechar, me traz os números que a gente fecha a tabela e o discurso em cima deles.
