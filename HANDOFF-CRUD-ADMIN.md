# 🤝 Handoff — Passos 1, 3 e 4 (CRUD Admin · Produção ao vivo · Anomalias)

> Sessão autônoma de 31/05→01/06/2026. **Nada commitado** — tudo salvo nos
> arquivos, esperando sua revisão. **Sem `git push`** (não autorizado).
> Trabalho 100% no TESTE `pvrnimckfgdmgjrjueap`. Produção intocada.

## 🔑 Para entrar e ver funcionando
- Rode o app (`npm run dev`) e abra **`/admin`**
- Login: **`admin@gdelta.com`** / **`gdelta2026`** (papel `dono`)
- Navegue pelos 3 cards: **Ordens de Serviço**, **Equipe**, **Produção ao vivo**

## ✅ O que foi feito

### Banco (TESTE) — migrations 001–005 aplicadas
- **003** — campos da OS: `tipo_cliente`, `data_prometida`, `valor_orcamento`,
  `ref_externa`, `etapa_atual`, `bloqueado`, `motivo_bloqueio`.
- **004** — grants de escrita p/ `authenticated` em `ordens_servico` e
  `funcionarios` (aprovada por você SÓ para o teste).
- **005** — `status_geral` vira lista fixa (CHECK: Aguardando Produção / Em
  Produção / Pronto para Entrega / Entregue) + placa **única-PARCIAL**
  (índice `uq_os_placa_ativa`: uma OS ativa por placa; carro entregue que volta
  pode abrir nova). **Verificado:** a UNIQUE total antiga foi removida.

### Telas (padrão `.gd-*` + styled-jsx, sem Tailwind no JSX)
- **`/admin/os`** — listar + criar + editar OS. Placa em maiúsculas, tipo de
  cliente sugere data prometida (+30 seguradora/cooperativa, +15 particular),
  status dropdown, buscar-antes-de-criar (aviso amigável).
- **`/admin/funcionarios`** — listar + criar + editar nome + ativar/desativar
  (soft delete). Sem PIN (MVP). Cargo padrão "Operário".
- **`/admin/producao`** — NOVA. Kanban por etapa (8 colunas) + faixa dos 4
  estados do operário (produzindo / em pausa / presente sem tarefa / ausente) +
  KPIs + marca de bloqueio/atraso. Auto-refresh 20s. Só leitura.
- **`/admin`** — 3 cards de navegação + crachá da sessão.

### Camada de dados
- `admin-queries.ts` — `StatusOS`, `somarDias`, `buscarOSAtivaPorPlaca`;
  `criarOS`/`atualizarOS` aceitam `data_entrada` e `etapa_atual`.
- `live-queries.ts` — NOVA. `carregarVisaoLive()` agrega apontamentos + pontos +
  OS e deriva os 4 estados e o kanban.

## 🧪 Testado de verdade (contra o banco, depois limpo)
- Criar OS → 201, `oficina_id` carimbado pelo trigger ✅
- CHECK de status barra valor inválido ✅
- 2 OS abertas com mesma placa → **bloqueado (409)** ✅
- Marcar Entregue → libera a placa p/ nova OS ✅
- Criar + desativar funcionário (soft delete) ✅
- 4 estados do operário + kanban (cenário real) → todos corretos ✅
- **Banco devolvido ao seed** (3 OS, sem apontamentos/pontos de teste).

## ⚠️ Pendências e descobertas (para revisar com você)
1. **`git push` não autorizado** — preparo o commit quando você mandar.
2. **Senha `gdelta2026`** passou pelo chat — troque quando puder.
3. **Descoberta:** a Migration 004 deu grants só em `ordens_servico` e
   `funcionarios`. **`apontamentos` e `pontos_eletronicos` NÃO têm grant de
   escrita p/ `authenticated`** — ok por enquanto (quem escreve neles é o totem
   via `anon`), mas quando o admin precisar **corrigir anomalias** (editar tempo
   de apontamento, fechar fantasma) vai precisar de uma migration de grants
   nessas tabelas — que exige seu OK explícito.
4. **Realtime não usado** — a produção ao vivo usa polling (20s), coerente com o
   MVP (Realtime é Fase 2).

## 🆕 Passo 4 — Correção de anomalias (adiantado nesta sessão)
- **`/admin/anomalias`** — NOVA tela. Detecta apontamentos-fantasma (ativos além
  do teto de 10,5h do CLAUDE.md) e oferece "Fechar agora". DETECÇÃO funciona já
  (leitura); CORREÇÃO mostra erro amigável até a Migration 006 ser aplicada.
- **`anomalias-queries.ts`** — NOVA. `listarAnomalias()` + `fecharApontamento()`.
- **Migration 006 ESCRITA mas NÃO aplicada** (`006_correcao_anomalias_admin.sql`)
  — adiciona coluna `editado_admin` + `grant update on apontamentos to
  authenticated`. **Mexe em GRANTS → precisa do seu OK explícito para aplicar.**
- **🐛 BUG DE FUSO encontrado e corrigido:** o banco grava `timestamp` sem 'Z'
  (UTC), e `new Date()` no JS interpretava como hora local → erro de 3h no
  cálculo de tempo. Corrigido reusando `parseISOComUTC` (a mesma função que o
  totem já usava). Exportei-a do `queries.ts`. Detecção validada: fantasma de
  12,2h foi corretamente sinalizado.
- Detecção testada contra o banco (criado fantasma de 12h → detectado → limpo).

## 🧹 Dívida técnica conhecida (NÃO mexi — proposital)
- `src/lib/supabase/queries.ts` tem **5 avisos do ESLint** (regras novas do
  React 19: `Date.now()` em render nos cronômetros + `setState` em effect nos
  hooks de fetch). **São pré-existentes** (código do totem que já funciona) — eu
  só exportei `parseISOComUTC` desse arquivo, não introduzi os avisos. Não são
  bugs; o código roda certo. **Não corrigi de propósito:** mexer no coração do
  totem por um lint estrito arrisca quebrar o que funciona, e merece refatoração
  consciente (ex.: `useSyncExternalStore` no cronômetro) com sua revisão — não
  uma decisão autônoma. **Todos os arquivos que criei nesta sessão: lint 100%
  limpo (0/0).**

## 👉 Próximos passos sugeridos
1. Você revisa as telas no navegador e aprova.
2. **Aprovar a Migration 006** (grants) para a correção de anomalias gravar de
   verdade no teste — eu aplico assim que você autorizar.
3. Eu preparo o commit (você dá o `git push`).
4. Depois: ROI / resumo (Passo 5).
