# 🤝 Handoff — Passo 1 (CRUD Admin) + Passo 3 (Produção ao vivo)

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

## 👉 Próximos passos sugeridos
1. Você revisa as telas no navegador e aprova.
2. Eu preparo o commit (você dá o `git push`).
3. Depois: correção de anomalias do admin (Passo 4) — vai pedir a migration de
   grants em apontamentos/pontos.
