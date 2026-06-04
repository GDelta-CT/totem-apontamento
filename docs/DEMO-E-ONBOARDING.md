# GDelta Totem — Demo & Onboarding

Dois entregáveis de campo. Sem código, sem SQL. Argumento de ROI ancorado no
`Pacotes-Produto-Comercial.md`.

> **Regra de honestidade na demo:** se uma tela ainda estiver em construção, **descreva o que
> ela vai fazer** — nunca finja dado nem invente número.

---

# 1) Roteiro de Demo — primeiro encontro na oficina piloto

## Abertura (2 frases pra um dono de oficina)

> "Hoje você sabe ONDE cada carro está, mas não sabe QUANTO TEMPO de gente cada um consumiu,
> nem qual está travado esperando peça agora. Esse totem mede o tempo real da sua equipe no
> chão e te mostra, num relance, o que está andando, o que parou e por quê — pra você cumprir
> prazo e parar de chutar."

Não fale "software", "sistema", "banco de dados". Fale **organização, tempo e prazo**.

## Fluxo de cliques — na ordem (operário → admin → dono)

A ordem importa: primeiro mostra como é **fácil pra equipe** (mata o medo da adoção), depois
o **controle do gestor**, e fecha com o **impacto pro dono** (onde está o dinheiro).

### Parte A — O Totem do operário (mostre primeiro)
1. **Bater ponto:** toca no nome. → _"Chegou, toca aqui. Pronto, tá na oficina."_
2. **Achar o carro:** digita a placa. → _"Pega o carro pela placa, do jeito que você já fala."_
3. **Escolher a etapa + dar play:** → _"Diz o que vai fazer — funilaria, pintura — e começa.
   Dois toques. O cronômetro corre sozinho."_
4. **Pausar com motivo:** → _"Parou pra almoço ou pra esperar peça? Um toque, diz o motivo.
   Isso vira prova de que o carro travou pela peça, não pela equipe."_

> Mensagem desta parte: **"se é fácil assim, sua equipe usa."**

### Parte B — O painel do Admin/gestor
5. **Quadro (Kanban) das 8 etapas:** → _"Cada carro é um cartão e anda pelas etapas. Você vê
   tudo numa tela só."_
6. **Os 4 estados da equipe ao vivo:** → _"Quem está produzindo, quem parou, quem está livre
   sem tarefa, quem não chegou. Responde na hora: 'todo mundo está produzindo agora?'"_
7. **Cartão bloqueado (vermelho):** → _"Esse carro está parado esperando peça. Salta aos olhos
   — é o que você precisa resolver hoje."_
8. **Correção de erro:** → _"Operário esqueceu o cronômetro rodando? Você corrige em dois
   toques, e fica registrado quem corrigiu e por quê. Ninguém mexe em tempo escondido."_

> Mensagem desta parte: **"você no controle, sem planilha e sem achismo."**

### Parte C — O impacto pro dono (feche aqui)
9. **Saúde de prazos:** → _"Quais carros estão dentro do prazo e quais vão estourar — antes de
   o cliente ligar cobrando."_
10. **Ticket "dias na oficina × R$ do orçamento":** → _"Aqui aparece o carro barato que arrasta
    (prejuízo disfarçado) e o caro que sai rápido (ouro). Você decide o que priorizar."_

> Mensagem de fecho: **"menos prazo perdido, menos hora parada, mais carro girando."**

## As 3 objeções mais prováveis — como responder

**"Minha equipe não vai usar."**
> "Por isso são só dois toques, e o treino do primeiro dia já está incluído. E o discurso pra
> equipe é **justiça, não vigilância**: o tempo conta a favor deles, mostra quem puxa o carro.
> Eu mesmo apresento pra sua equipe no Dia 1."

**"Quanto custa?"**
> "Tem uma taxa de setup, que cobre o equipamento e a implantação acompanhada, e uma
> mensalidade. Mas pensa no que ela devolve: se te evitar **um prazo estourado por mês** ou te
> mostrar **uma hora-homem parada por dia** que hoje você não enxerga, já se pagou. A
> mensalidade é uma fração disso." (Números fechados com base no piloto — ver doc comercial.)

**"E se travar no meio do serviço?"**
> "O totem é feito pra não perder ação se a internet cair — ele avisa 'não salvou, tenta de
> novo'. E o tempo é ancorado no relógio do servidor, não no tablet. Se o aparelho der
> problema, a operação não para: a equipe trabalha, e a gente acerta o registro depois."

---

# 2) SOP de Onboarding — configurar uma oficina nova

Checklist pra seguir **toda vez** que entrar uma oficina. Onde precisar de SQL, está escrito
**o que fazer** — peça o SQL pronto ao Claude Code.

## Etapa 0 — Pré-checagem de segurança (NÃO pular)
- [ ] **Confirmar o ambiente de destino** (ref do projeto) antes de qualquer escrita: `____________`
- [ ] Confirmar que o **isolamento de leitura entre oficinas** está travado **antes de cadastrar
      a 2ª oficina real** (senão uma oficina enxerga dado da outra). Pergunta pro Code: "o
      lockdown de leitura já está aplicado neste ambiente?" → resposta: `____`

## Etapa 1 — Coletar os dados da oficina (ficha de entrada)
- [ ] Nome da oficina: `____________________`
- [ ] Apelido curto (aparece no painel): `____________`
- [ ] Endereço (comercial): `____________________`
- [ ] Horário de expediente — entrada: `____` saída: `____` | dias: `____________`
- [ ] **Dono** — nome: `____________` e-mail: `____________` telefone: `____________`
- [ ] **Conta do totem (login da oficina no aparelho)** — e-mail: `____________` senha: `____________`
- [ ] Lista de **funcionários** (nomes): `________________________________________`
- [ ] **Ordem das colunas** confirmada com a oficina (Montagem × Polimento): `____________`
- [ ] Placas **ativas** hoje (pra cadastrar as 1ªs OS), se houver: `________________________`

## Etapa 2 — Criar a oficina no banco
- [ ] Pedir ao Code o SQL pra **criar a oficina** com os dados da Etapa 1. Anotar o **ID da
      oficina** gerado: `____________`

## Etapa 3 — Criar as contas de acesso (Supabase Auth)
- [ ] Criar a **conta do totem** (e-mail + senha da oficina) no Supabase Auth.
- [ ] Criar a **conta do dono** (e-mail do dono) no Supabase Auth + enviar/definir senha.
- [ ] (Se você for operar como admin no início) confirmar que **sua conta** existe.

## Etapa 4 — Vincular as contas à oficina (papéis)
- [ ] Pedir ao Code o SQL pra **vincular** cada conta à oficina com o papel certo:
  - [ ] Conta do **totem** → vinculada à oficina (é ela que carimba o `oficina_id` no aparelho).
  - [ ] Conta do **dono** → papel **dono**.
  - [ ] Sua conta (se for o caso) → papel **gerente**.

## Etapa 5 — Cadastrar funcionários e OS iniciais
- [ ] Cadastrar os **funcionários** (pelo `/admin` quando o CRUD estiver pronto; senão, pedir o
      SQL ao Code).
- [ ] Cadastrar as **OS ativas** do dia (placa + modelo + tipo de cliente + data prometida).

## Etapa 6 — Teste de fumaça (provar que funciona e está isolado)
- [ ] **Login do totem** (conta da oficina) no aparelho → aparece a tela do totem.
- [ ] **Bater ponto** com um funcionário → registra sem erro.
- [ ] Dar **play** numa OS pela placa → cronômetro corre.
- [ ] **Login no `/admin`** (conta do dono) → entra no painel.
- [ ] Conferir no painel que o **`oficina_id` é o desta oficina** (isolamento — não aparece dado
      de outra oficina). `____ ok`

## Etapa 7 — Físico + Dia 1
- [ ] Pendurar o totem na parede (tablet + suporte), ligado e logado.
- [ ] Rodar o **treino Dia 1** com a equipe (roteiro no `Pacotes-Produto-Comercial.md`, Pacote 3).
- [ ] Combinar a **semana de teste** e marcar a volta pra ouvir fricção.

## Etapa 8 — Acompanhamento (semana 1)
- [ ] Checar se o **dono abre o painel sozinho** (é o critério de sucesso).
- [ ] Anotar toda fricção da equipe pra ajustar.
- [ ] No fim do piloto: coletar os números reais (horas recuperadas, retrabalho visível, queda
      de prazo) pra fechar a **tabela comercial** (ver Pacote 4).
