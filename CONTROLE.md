# 🎛️ CONTROLE — GDelta

> **Único arquivo que você precisa abrir pra saber o estado do projeto.**
> Atualize sempre que algo grande mudar. Se outra IA mudar algo importante, peça pra ela atualizar este arquivo.

---

## 📍 Estado atual (atualizado: ___/___/___)

- **Fase do projeto:** Pré-MVP (consertando fundação)
- **Maturidade técnica:** 2/10 (segundo diagnóstico 360°)
- **Próxima entrega:** Migration 001 — fechar vazamento de RLS
- **Bloqueado por:** Nada. Pronto pra executar.

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

---

## 🚧 O que está EM CONSTRUÇÃO

- [ ] Migration 001 — Ativar RLS no Supabase **← PRÓXIMA ENTREGA**
- [ ] Migration 002 — Multi-tenant (tabela `oficinas` + `oficina_id`)
- [ ] Migration 003 — Audit log + `created_at`/`updated_at` em todas as tabelas
- [ ] API Routes — Mover queries de Supabase do frontend para o backend
- [ ] Auth real — Login do admin via Supabase Auth (email/senha)
- [ ] Auth do operário — PIN 6 dígitos com bcrypt
- [ ] Refactor — Quebrar `/totem/page.tsx` (75KB) em componentes
- [ ] Dashboard `/admin` — Home + 4 sub-páginas
- [ ] Backup automático — workflow GitHub Actions agendado
- [ ] Sentry — monitoramento de erros
- [ ] Cobrança Asaas — assinatura recorrente
- [ ] Política de Privacidade e Termos de Uso (LGPD)

---

## 🤖 Quem decide o quê

| Decisão | Quem decide | Por quê |
|---|---|---|
| Arquitetura técnica | Claude (dashboard) + Claude (app) | Decisão técnica |
| UX/UI dos componentes | Claude (app) | Decisão técnica |
| Modelo de dados | Claude (dashboard) | Especialidade em domínio + modelo financeiro |
| Cores, logo, identidade visual | Eliel | Decisão de marca |
| Preço final | Eliel confirma proposta nossa | Decisão financeira |
| CNPJ — quando abrir | Eliel | Decisão financeira/legal |
| Política de Privacidade — texto final | Eliel + advogado | Responsabilidade legal |
| Cliente piloto | Eliel | Relacionamento humano |
| Quando vender pro primeiro cliente | Eliel | Decisão comercial |

**Regra de ouro:** se decisão é técnica, decidimos e te informamos. Se envolve dinheiro/contrato/legal, você decide.

---

## 📚 Onde encontrar cada coisa

| Procurando... | Vá em... |
|---|---|
| Histórico de decisões | `docs/DECISÕES.md` |
| Lista de tarefas pendentes | `docs/PROXIMOS-PASSOS.md` |
| Migrations do banco | `supabase/migrations/` |
| Workflows do GitHub | `.github/workflows/` |
| Prompts prontos pro Antigravity | `prompts/` |
| Análise técnica completa | `ANALISE-360-GDELTA.md` (na raiz) |
| Resposta do diagnóstico de Claude dashboard | (em arquivo `.docx`) |

---

## 🆘 Quando algo der errado

| Problema | O que fazer |
|---|---|
| Site offline | Ver `https://vercel.com/dashboard` + Sentry |
| Banco fora do ar | Ver `https://supabase.com/dashboard/project/_/settings` |
| Não consigo fazer login | Conferir credenciais no Supabase Auth |
| Site lento | Vercel Analytics + Lighthouse |
| Bug do código | Sentry te avisa por email |
| Erro de migration | Rodar `_rollback.sql` correspondente |
| Cliente reclamando | Chat Crisp → email → você (SLA 48h) |

---

## 📞 Contatos importantes

| Quem | Quando contatar | Como |
|---|---|---|
| Suporte Vercel | Site fora do ar | https://vercel.com/help |
| Suporte Supabase | Banco fora do ar | https://supabase.com/support |
| Suporte Asaas | Problema com cobrança | (a definir quando contratar) |
| Advogado LGPD | Vazamento de dados | (a contratar quando primeiro cliente) |

---

> **Última atualização:** 23 de maio de 2026
> **Próxima revisão:** sempre que algo grande mudar
