# 🎛️ CONTROLE — GDelta

> **Único arquivo que você precisa abrir pra saber o estado do projeto.**
> Atualize sempre que algo grande mudar. Se outra IA mudar algo importante, peça pra ela atualizar este arquivo.

---

## 📍 Estado atual (atualizado: **01/06/2026**)

- **Fase do projeto:** Pré-MVP → multi-tenant + auth em andamento
- **Maturidade técnica:** 2/10 (segundo diagnóstico 360°)
- **Fase 1 (auth da oficina + `oficina_id` no JWT):** ✅ **Concluída e validada no projeto de TESTE** (São Paulo). Detalhes em "O que JÁ está pronto".
- **Passo 1 (CRUD do Admin):** ✅ **Concluído no TESTE** — telas `/admin/os` e `/admin/funcionarios`, migrations 003/004/005 aplicadas, login admin (`admin@gdelta.com`) com papel `dono`. Testado contra o banco (criar/editar/placa-única-parcial/soft-delete).
- **Passo 3 (visão operacional ao vivo):** ✅ **Construído** — `/admin/producao` (kanban por etapa + 4 estados do operário, auto-refresh 20s). Lógica validada com cenário real.
- **Passo 4 (correção de anomalias):** 🟡 **UI pronta** — `/admin/anomalias` detecta apontamentos-fantasma (>10,5h). A GRAVAÇÃO da correção depende da **Migration 006** (grants em apontamentos), que está **escrita mas NÃO aplicada** — aguarda OK explícito do fundador. Bug de fuso (timestamp sem 'Z') encontrado e corrigido via `parseISOComUTC`.
- **Próxima entrega:** revisão humana + aprovar Migration 006 + commit; depois Passo 5 (ROI/resumo). (Por último: migration que remove as policies abertas do `anon` → isolamento real.)
- **Bloqueado por:** Nada. ⚠️ Pendente: revisão do fundador + aprovar Migration 006 + `git push` (não autorizado ainda).
- **Ambientes:** trabalho no projeto de **teste** `pvrnimckfgdmgjrjueap` (SP). **Produção** `ccpxwnbxvmadcafxnbjs` (Oregon) intocada. ⚠️ Em produção o totem está quebrado para o `anon` (faltam GRANTs nas tabelas-base) — correção só sob ordem explícita.

---

## 🎯 Onde queremos chegar

**Objetivo único de curto prazo:** Primeira venda paga para uma oficina real.

**Como vamos chegar lá:**

1. Consertar fundação de segurança (4 semanas)
2. Adicionar multi-tenant + auth (2 semanas)
3. Dashboard mínimo do dono (2 semanas)
4. Cobrança Asaas (1 semana)
5. Onboarding do 1º cliente (1 semana)

**Total realista:** 10 semanas a partir de hoje.

---

## ✅ O que JÁ está pronto

- [x] Stack moderna (Next.js 16 + React 19 + TypeScript estrito)
- [x] CI básico no GitHub Actions
- [x] ESLint configurado
- [x] `.gitignore` correto (protege `.env`)
- [x] Tela `/totem` funcional (operário bate ponto, inicia/pausa/finaliza)
- [x] Tela `/diagnostico` para debug
- [x] Conexão com Supabase funcionando
- [x] Conhecimento de domínio do CEO (Eliel) consolidado na planilha gerencial
- [x] Migrations **001 (RLS)** + **002 (multi-tenant)** aplicadas — produção e replicadas no teste
- [x] **Fase 1 — Auth da oficina (device) + `oficina_id` no JWT** — validada no **teste**: o device autentica via Supabase Auth (login manual no kiosk), um _Custom Access Token Hook_ injeta `oficina_id` como claim, e um trigger `BEFORE INSERT` preenche `oficina_id` nas escritas (bater ponto grava sem erro)

---

## 🚧 O que está EM CONSTRUÇÃO

- [x] Migration 001 — Ativar RLS no Supabase _(aplicada: prod + teste)_
- [x] Migration 002 — Multi-tenant (tabela `oficinas` + `oficina_id`) _(aplicada: prod + teste)_
- [x] Auth da oficina (device) + `oficina_id` no JWT — **Fase 1** _(validada no teste)_
- [ ] Migration "fechamento" — remover as policies abertas do `anon` (isolamento real) **← por último, depois das API Routes**
- [ ] API Routes — Mover queries de Supabase do frontend para o backend **← próxima**
- [ ] Auth real — Login do admin (dono) via Supabase Auth (email/senha) + tela `/admin`
- [ ] Auth do operário — PIN 6 dígitos validado no servidor (bcrypt)
- [ ] Refactor — Quebrar `/totem/page.tsx` (75KB) em componentes
- [ ] Dashboard `/admin` — Home + 4 sub-páginas
- [ ] Backup automático — workflow GitHub Actions agendado
- [ ] Sentry — monitoramento de erros
- [ ] Cobrança Asaas — assinatura recorrente
- [ ] Política de Privacidade e Termos de Uso (LGPD)

---

## 🤖 Quem decide o quê

| Decisão                               | Quem decide                       | Por quê                                      |
| ------------------------------------- | --------------------------------- | -------------------------------------------- |
| Arquitetura técnica                   | Claude (dashboard) + Claude (app) | Decisão técnica                              |
| UX/UI dos componentes                 | Claude (app)                      | Decisão técnica                              |
| Modelo de dados                       | Claude (dashboard)                | Especialidade em domínio + modelo financeiro |
| Cores, logo, identidade visual        | Eliel                             | Decisão de marca                             |
| Preço final                           | Eliel confirma proposta nossa     | Decisão financeira                           |
| CNPJ — quando abrir                   | Eliel                             | Decisão financeira/legal                     |
| Política de Privacidade — texto final | Eliel + advogado                  | Responsabilidade legal                       |
| Cliente piloto                        | Eliel                             | Relacionamento humano                        |
| Quando vender pro primeiro cliente    | Eliel                             | Decisão comercial                            |

**Regra de ouro:** se decisão é técnica, decidimos e te informamos. Se envolve dinheiro/contrato/legal, você decide.

---

## 📚 Onde encontrar cada coisa

| Procurando...                               | Vá em...                          |
| ------------------------------------------- | --------------------------------- |
| Histórico de decisões                       | `docs/DECISÕES.md`                |
| Lista de tarefas pendentes                  | `docs/PROXIMOS-PASSOS.md`         |
| Migrations do banco                         | `supabase/migrations/`            |
| Workflows do GitHub                         | `.github/workflows/`              |
| Prompts prontos pro Antigravity             | `prompts/`                        |
| Análise técnica completa                    | `ANALISE-360-GDELTA.md` (na raiz) |
| Resposta do diagnóstico de Claude dashboard | (em arquivo `.docx`)              |

**ESTRUTURA DE MIGRATIONS**

- `/supabase/migrations/` → SQLs que avançam o estado do banco
- `/supabase/rollbacks/` → SQLs de reversão (não aplicar via CLI)

---

## 🆘 Quando algo der errado

| Problema                | O que fazer                                             |
| ----------------------- | ------------------------------------------------------- |
| Site offline            | Ver `https://vercel.com/dashboard` + Sentry             |
| Banco fora do ar        | Ver `https://supabase.com/dashboard/project/_/settings` |
| Não consigo fazer login | Conferir credenciais no Supabase Auth                   |
| Site lento              | Vercel Analytics + Lighthouse                           |
| Bug do código           | Sentry te avisa por email                               |
| Erro de migration       | Rodar `_rollback.sql` correspondente                    |
| Cliente reclamando      | Chat Crisp → email → você (SLA 48h)                     |

---

## 📞 Contatos importantes

| Quem             | Quando contatar       | Como                                  |
| ---------------- | --------------------- | ------------------------------------- |
| Suporte Vercel   | Site fora do ar       | https://vercel.com/help               |
| Suporte Supabase | Banco fora do ar      | https://supabase.com/support          |
| Suporte Asaas    | Problema com cobrança | (a definir quando contratar)          |
| Advogado LGPD    | Vazamento de dados    | (a contratar quando primeiro cliente) |

---

> **Última atualização:** 30 de maio de 2026 — Fase 1 (auth da oficina + `oficina_id` no JWT) concluída e validada no teste
> **Próxima revisão:** sempre que algo grande mudar
