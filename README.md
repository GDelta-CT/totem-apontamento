# 🎛️ GDelta — Kit de Automação v1.0

> **Único pacote** com tudo que você precisa pra parar de pensar em decisões pequenas e seguir construindo.

---

## 🚀 O QUE VOCÊ FAZ PRIMEIRO

**Apenas 3 ações suas. Eu (e a outra Claude) cuidamos do resto.**

### 1️⃣ Descompacta este zip dentro do seu projeto GDelta

Os arquivos vão se misturar com os existentes — **não sobrescreve nada importante**, apenas adiciona:

- Pastas: `.github/workflows/`, `supabase/migrations/`, `docs/`, `prompts/`
- Arquivo: `CONTROLE.md` na raiz

### 2️⃣ Faz um commit e push

```bash
git add .
git commit -m "feat: adiciona kit de automação completo"
git push
```

### 3️⃣ Aplica a Migration 001 no Supabase

Esta é a única ação manual realmente importante esta semana. Fecha o vazamento de segurança.

- Abre Supabase Studio → SQL Editor
- Cola o conteúdo de `supabase/migrations/001_enable_rls.sql`
- Clica "Run"
- ✅ Pronto. Banco blindado.

**Depois disso, você não precisa mais fazer nada manualmente esta semana.**

---

## 📂 O que cada coisa faz

### `CONTROLE.md` (raiz)

**O único arquivo que você precisa abrir pra saber o estado do projeto.** Tudo de relevante está lá. Atualizado por todas as IAs sempre que algo muda.

### `docs/DECISOES.md`

Log de TODAS as decisões técnicas tomadas. Quem decidiu, quando, por quê. Se você discordar de alguma, marque `[REVISAR]` e nos avise.

### `docs/PROXIMOS-PASSOS.md`

Checklist viva. 19 tarefas mapeadas até a primeira venda. Cada uma com complexidade, agente recomendado, tempo estimado.

### `prompts/`

Prompts prontos pra colar no Antigravity. Você nem precisa pensar — só copiar e colar.

### `.github/workflows/ci.yml`

GitHub Actions que roda automaticamente:

- Type-check do TypeScript
- Build do Next.js
- Audit de dependências
- Scan de secrets vazadas

### `.github/workflows/backup.yml`

Backup automático do banco Supabase TODA NOITE às 3h. Retém 30 dias. Grátis.

### `supabase/migrations/`

Migrations versionadas. Cada arquivo numerado em ordem. Roda em qualquer ambiente (dev/staging/prod) e sempre traz o banco pro mesmo estado.

---

## 🤖 Como funciona o fluxo automatizado

```
┌──────────────────────────────────────────────────────────────┐
│  VOCÊ (10-20h/semana)                                         │
│  • Lê CONTROLE.md no início da semana (1 min)                 │
│  • Faz a próxima tarefa de PROXIMOS-PASSOS.md                 │
│  • Cola o prompt correspondente no Antigravity                │
│  • Aceita as mudanças e dá push                               │
│                                                                │
│  Total: 30 min - 2h por dia                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  AUTOMAÇÕES (não exigem você)                                 │
│  • GitHub Actions verifica build/lint/security a cada push    │
│  • Backup do banco roda toda noite às 3h                      │
│  • Vercel deploya o app automaticamente                       │
│  • (futuro) Sentry te avisa por email se quebrar              │
│  • (futuro) Crisp atende clientes com IA                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  IAs (decidem por você)                                       │
│  • Claude (dashboard) — modelo financeiro, KPIs, UX           │
│  • Claude (app) — arquitetura, código, decisões técnicas      │
│  • Antigravity — aplica código no projeto                     │
└──────────────────────────────────────────────────────────────┘
```

---

## ⏰ Cronograma realista (10-16 semanas)

| Semana | Foco                                | Você gasta |
| ------ | ----------------------------------- | ---------- |
| 1      | Fundação de segurança (RLS, backup) | 1-2h       |
| 2      | Multi-tenant + audit log            | 2-3h       |
| 3      | API Routes (blindar frontend)       | 3-4h       |
| 4      | Auth do admin + login               | 3-4h       |
| 5      | PIN do operário + middleware        | 2-3h       |
| 6      | Refactor totem/page.tsx             | 3-4h       |
| 7      | Dashboard `/admin` home + layout    | 3-4h       |
| 8      | Páginas de produção + pessoas       | 4-5h       |
| 9      | Integração Asaas (cobrança)         | 4-6h       |
| 10     | LGPD + Política + CNPJ              | 2-3h       |
| 11-12  | Polimento + primeiro cliente        | 8-10h      |

**Total estimado:** 35-50h ao longo de 12 semanas. Cabe em 10-20h/semana com folga.

---

## 🆘 Se algo der errado

1. **Não entre em pânico.** Tudo é reversível.
2. Cada migration tem arquivo `_rollback.sql` correspondente
3. GitHub guarda todo histórico — `git revert` resolve qualquer commit ruim
4. Backup do banco roda toda noite — perda máxima é de 24h
5. Em última instância: me chama aqui ou na outra Claude

---

## 📞 Quando precisar de mim ou da outra Claude

| Situação                             | Quem chamar                        |
| ------------------------------------ | ---------------------------------- |
| Dúvida sobre decisão técnica         | Claude (app — outra conversa)      |
| Dúvida sobre modelo financeiro / KPI | Claude (dashboard — esta conversa) |
| Dúvida sobre LGPD/legal              | Advogado externo (futuro)          |
| Bug que ninguém entende              | Cola erro pra mim aqui             |
| Quer adicionar feature nova          | Discutir com Claude (app) primeiro |

---

## ✅ Filosofia do kit

1. **Decisões pequenas são automatizadas ou delegadas às IAs.**
2. **Você só decide o que envolve dinheiro, contrato, ou relacionamento humano.**
3. **Tudo é versionado e reversível.**
4. **CONTROLE.md é a fonte única da verdade.**
5. **Velocidade > perfeição. Mas sem comprometer segurança.**

---

> Versão deste kit: **1.0**
> Criado em: 23 de maio de 2026
> Por: Claude (dashboard gerencial)
> Para: Eliel — CEO/PO do GDelta
