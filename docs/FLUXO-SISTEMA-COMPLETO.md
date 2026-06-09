# GDelta — Fluxo do Sistema Completo (mapa do produto pra vender pra várias oficinas)

> **Objetivo comercial (fundador, 2026-06-08):** vender o pacote completo
> **Totem + Painel(/Planilha) + Automação (WhatsApp)** para **várias oficinas**.
> Este doc organiza como as 3 peças se encaixam. Ele **não reabre** o escopo MVP travado
> do `CLAUDE.md` — apenas mostra o todo e a sequência segura. Mudança de escopo/arquitetura
> continua sendo **decisão do fundador**.

## Princípio nº 1 — UM cérebro: o banco multi-oficina (Supabase)

Pra vender pra **muitas** oficinas, o cérebro precisa ser um **banco multi-inquilino** (cada
oficina isolada). O Totem já é construído assim (RLS + lockdown de leitura aplicado na
migration 007). **A planilha não pode ser o cérebro central** — uma planilha por oficina não
isola dados com segurança, não escala e é frágil de manter. Isso é o que te deixa **cobrar e
crescer sem vazar dado entre clientes**.

→ **A planilha vira um ESPELHO/relatório opcional por oficina** (pro dono que gosta de
planilha), alimentado a partir do banco — nunca a fonte da verdade.

## Os 3 pilares e o fluxo

```
 ENTRADA                                  CÉREBRO                         SAÍDA
 ───────                                   ───────                        ─────
 Cília (PDF) ─[agente admin / Gemini]─┐
                                      ├─► SUPABASE ─► /admin (painel do dono)
 Operário ───────[Totem]─────────────┤   (multi-     └─► Planilha-espelho (opcional)
                                      │    oficina)
 Cliente (WhatsApp) ◄─[agente cliente]┘   (lê status do MESMO cérebro)
```

1. **Totem** (chão de fábrica) — operário toca → acha OS pela placa → aponta etapa. **Fonte
   da verdade do pátio.** ✅ Construído (este projeto).
2. **Painel / "Planilha"** (gestão) — o dono vê produtividade + saúde de prazos em `/admin`.
   ✅ Construído. A planilha Google é só um espelho opcional.
3. **Automação (WhatsApp)** — por oficina:
   - **Agente admin**: lê o PDF de orçamento — de **várias fontes** (Cília, plataforma WM,
     etc., **layouts diferentes**) — extrai os campos certos e **pré-preenche a OS** em
     `/admin/os` (que reflete na planilha). Pesquisa: `docs/PESQUISA-INGESTAO-PDF-IA.md`.
     O fato de serem **múltiplas fontes/layouts reforça o LLM multimodal** (Gemini Flash-Lite
     via Vertex SP), que entende o **sentido** do campo e se adapta ao layout — e **descarta de
     vez** o parser por template (quebraria a cada fonte nova). Admin sempre confere antes de
     salvar. PoC deve usar **1 exemplo de cada fonte** (1 Cília + 1 WM). ⏳ Não construído.
   - **Agente cliente**: informa status do veículo + verifica identidade (zero vazamento).
     ⏳ **Existe** no projeto `gdelta-local`, mas num **banco separado + Google Sheet** —
     precisa ser reapontado pro **Supabase** pra entrar no pacote.

## Divergência a resolver (estado em 2026-06-08)

- **Totem** → Supabase multi-oficina (este repo). Maduro.
- **Automação WhatsApp** → projeto `gdelta-local` (Evolution API + n8n + **Postgres próprio** +
  espelho Google Sheets). Protótipo single-tenant, **desacoplado** do cérebro do Totem.

**Unificar** = a automação ler/gravar no Supabase (o agente cliente reporta o pátio real que
o operário apontou; o agente admin grava OS no banco real). É **trabalho de roadmap** e
**adição de escopo** — entra só com decisão explícita do fundador (não silenciosamente).

## Sequência segura recomendada (um passo reversível por vez)

> Respeita o MVP travado do `CLAUDE.md`: terminar Totem+Painel antes de abrir a automação.

1. **Fechar o núcleo vendável (Totem + Painel)** na ordem travada (build order 1–5 do
   `CLAUDE.md`): CRUD admin, visão ao vivo, correção de anomalias, resumo do dono. _← foco atual_
2. **Onboarding de oficina** — criar nova oficina + conta do dono de forma repetível
   (habilita o "várias oficinas" de verdade). _(checar o que já existe antes de construir)_
3. **Agente admin (PDF→OS)** — rodar a PoC grátis com 1 PDF real da Cília (custo R$ 0); se
   acertar, implementar como Server Action que pré-preenche `/admin/os`. _(precisa: PDF real +
   ok do fundador pra gastar centavos no Vertex)_
4. **Unificar o agente cliente** — reapontar o atendimento WhatsApp (hoje `gdelta-local`) pro
   Supabase, lendo o pátio real. _(adição de escopo → decisão do fundador)_
5. **Planilha-espelho** (opcional) — exportar a visão do dono por oficina, pra quem quiser.

## Precisa do fundador (decisão / insumo)

- **Prioridade do próximo pilar:** fechar núcleo (passo 1) **ou** já provar o agente admin
  (passo 3, PoC grátis)? — recomendação: seguir o passo 1, e em paralelo você me manda **1 PDF
  real da Cília** pra eu rodar a PoC sem custo.
- **Gasto:** o Vertex/Gemini custa centavos/mês, mas é gasto — autorização explícita antes de
  ligar em produção.
- **Unificação da automação (passo 4):** é adição de escopo — confirmar quando for a hora.

## Regras que continuam valendo (do CLAUDE.md)

Trabalhar só no Supabase de **teste** (`pvrnimckfgdmgjrjueap`), nunca produção; parar e pedir
aprovação pra migrations de permissões/RLS, auth e isolamento; sem `git push`/deploy/gasto sem
ok; mostrar o que vai mudar antes; manter o Totem funcionando.
