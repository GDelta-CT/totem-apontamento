# Prioridades — GDelta-Totem

> **Lente:** o critério de sucesso travado é _o dono abrir o painel sozinho
> ≥1x/dia por 2 semanas e dizer que pagaria._ Tudo abaixo é ordenado por "o que
> faz o produto seguro e valioso pra UM dono real usar" — não por ordem de chegada.

## P0 — A real prioridade (sua ação, não código)

- **Achar a oficina piloto.** Nenhuma trava técnica impede um teste com dados
  reais hoje. Sem um usuário real, mais features não movem o placar.

## P1 — Deixa o produto seguro/valioso pra um dono real (agora)

- **#2 OS-Container (integridade)** — impede tempo contado em dobro; sem isso o
  dono não confia nos números. Plano pronto (`docs/PLANO-OS-CONTAINER.md`).
  **GATED** (RPC + migration → seu OK). Esforço médio. Afinado pelo review
  contraditório (rodando).
- **#4 — cards de prazo na home (`/admin/home`)** — é o gancho do "dono abre
  1x/dia" (o Daily Huddle). O painel de prazo JÁ existe em `/admin/prazos`; falta
  trazer um resumo pra home. Esforço baixo, autônomo, sem trava. _ROI fica de fora
  (você travou como pós-MVP; número fake engana o dono)._

## P2 — Importante, logo após o piloto começar

- **#5 Lockdown (multi-tenant)** — isola oficina A da oficina B. Com UMA piloto
  ainda não há vazamento (um tenant só) → NÃO trava o 1º piloto, mas é
  **pré-requisito da 2ª oficina**. **GATED**. Esforço médio.
- **#1 Correção (extensão)** — o admin já corrige timer-fantasma
  (`/admin/anomalias`). Só estender pra editar qualquer apontamento SE o piloto
  pedir. Esforço baixo.

## P3 — Depois do 1º usuário real

- **#3 Ingestão PDF via IA** — escopo novo + serviço pago. Pesquisa de custo
  rodando (background) → sua decisão depois.
- **Limpezas** — código morto (`resultado-os` no totem), warnings de eslint,
  decisão do `workflow-execution.md` (commitar/deixar/reverter).

## Rodando agora (background)

- Review contraditório (`wg96er80z`) — afina o #2.
- Pesquisa de custo do #3.

## Recomendação

Começar pelo **P1**: aprovar o **#2** (implemento via workflow, costurando o
review) + liberar o **#4-home** (rápido, sem risco). O **#5** fica engatilhado.
