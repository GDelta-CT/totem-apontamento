# 🎯 Próximos Passos — GDelta

> Lista viva. Atualize conforme for concluindo.
> Marque `[x]` quando feito.
> Cada item tem complexidade, agente recomendado e tempo estimado.

---

## ⚡ ESTA SEMANA (sem você precisar abrir o Antigravity)

### 1. Aplicar Migration 001 — Fechar vazamento de RLS

- **Status:** ✅ Concluído (aplicada em produção; replicada no projeto de teste)
- **Complexidade:** 🟢 BAIXA
- **Onde:** Supabase Studio (https://supabase.com/dashboard) → SQL Editor
- **Tempo:** 5 minutos
- **Como:**
  1. Abrir Supabase Studio
  2. SQL Editor
  3. Copiar conteúdo de `supabase/migrations/001_enable_rls.sql`
  4. Colar e clicar "Run"
  5. Verificar que aparece 4 linhas com `rls_ativo=true`
- **Resultado esperado:** Banco blindado. App vai parar de funcionar — isso é POSITIVO.
- **Se der ruim:** Rodar `001_rollback.sql`

### 2. Configurar segredos do GitHub para backup automático

- **Status:** 🟡 Pendente
- **Complexidade:** 🟢 BAIXA
- **Onde:** GitHub → seu repo → Settings → Secrets and variables → Actions
- **Tempo:** 10 minutos
- **Segredos necessários:**
  - `SUPABASE_DB_HOST` → ex: `aws-0-sa-east-1.pooler.supabase.com` (achar em Supabase → Project Settings → Database)
  - `SUPABASE_DB_PASSWORD` → senha do banco (mesma do Supabase Studio)
- **Resultado:** Todo dia às 3h o backup vai rodar sozinho

---

## 🔨 PRÓXIMAS 2 SEMANAS (uma entrega por vez)

### 3. Migration 002 — Estrutura multi-tenant

- **Status:** ✅ Concluído (aplicada em produção; replicada no projeto de teste)
- **Complexidade:** 🟡 MÉDIA
- **Agente recomendado:** Gemini Pro ou Claude (qualquer um)
- **Tempo:** 15 minutos seu, 30 minutos o agente
- **O que faz:** Cria tabela `oficinas` + adiciona `oficina_id` em todas as tabelas

### 4. Migration 003 — Audit log e timestamps

- **Status:** 🔵 Aguardando 002
- **Complexidade:** 🟢 BAIXA
- **Agente recomendado:** Qualquer um
- **Tempo:** 10 minutos
- **O que faz:** `created_at`, `updated_at` em todas as tabelas + tabela `audit_log`

### 5. Refactor API Routes — Tirar Supabase do frontend

- **Status:** 🔵 Aguardando 003
- **Complexidade:** 🔴 ALTA
- **Agente recomendado:** Claude (precisa raciocinar bem)
- **Tempo:** 1-2 horas
- **O que faz:** Move todas as queries do frontend para `/api/*` no Next.js

---

## 🚀 SEMANAS 3-4 — Auth real

### ✅ Fase 1 — Auth da oficina (device) + `oficina_id` no JWT — CONCLUÍDA (validada no teste)

- **Status:** ✅ Concluído no projeto de **teste** (`pvrnimckfgdmgjrjueap`, São Paulo)
- **O que ficou pronto:**
  - **Arquitetura:** a OFICINA autentica o **device** (totem) com Supabase Auth; login manual 1× no kiosk; sessão persiste/renova.
  - **Banco (teste):** role `'totem'` adicionado a `user_oficinas`; _Custom Access Token Hook_ injeta `oficina_id` (e `oficina_role`) como claim de topo no JWT; trigger `BEFORE INSERT` (`set_oficina_id_from_jwt`) preenche `oficina_id` nas 4 tabelas; device `totem-demo@gdelta-totem.com` vinculado à Oficina Demo.
  - **App:** `client.ts` com `persistSession`/`autoRefreshToken` ligados; componente `DeviceAuthGate` (tela "Login da Oficina"); `/totem` envolto pelo gate.
  - **Validado:** JWT do device traz `oficina_id`; bater ponto grava com `oficina_id` preenchido pelo trigger (erro de NOT NULL resolvido).
- **Observação:** ainda **falta** o PIN do operário (item 8) e mover as queries para API Routes (item 5). A migration que remove as policies abertas do `anon` (isolamento real) fica **por último**, depois das API Routes.

### 6. Implementar Supabase Auth (admin)

- **Status:** 🔵 Aguardando 5
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 2-3 horas

### 7. Tela `/admin/login`

- **Status:** 🔵 Aguardando 6
- **Complexidade:** 🟢 BAIXA
- **Tempo:** 30 minutos

### 8. PIN 6 dígitos do operário (bcrypt)

- **Status:** 🔵 Aguardando 7
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 1-2 horas

### 9. Middleware de proteção de rotas

- **Status:** 🔵 Aguardando 8
- **Complexidade:** 🟢 BAIXA
- **Tempo:** 30 minutos

---

## 🎨 SEMANAS 5-7 — Dashboard

### 10. Quebrar `/totem/page.tsx` (75KB) em componentes

- **Status:** 🔵 Aguardando 9
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 2-4 horas

### 11. Layout do `/admin` (sidebar + topbar)

- **Status:** 🟡 Parcial — topbar + navegação por cards já existem nas telas do admin
- **Complexidade:** 🟢 BAIXA
- **Tempo:** 1 hora

### 12. Página `/admin` home (KPIs do mês)

- **Status:** 🔵 Aguardando 11
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 2-3 horas

### 13. Página `/admin/producao` (Pátio)

- **Status:** ✅ Construída (01/06/2026) — kanban por etapa (8 colunas) + 4 estados do operário + KPIs + auto-refresh 20s. Lógica validada com cenário real no teste. Falta revisão humana.
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 2-3 horas

### 14. Página `/admin/pessoas` (Operários + Folha)

- **Status:** 🔵 Aguardando 13
- **Complexidade:** 🟡 MÉDIA
- **Tempo:** 2-3 horas

---

## 💰 SEMANAS 8-10 — Cobrança e GO-LIVE

### 15. Integração Asaas

- **Status:** 🔵 Aguardando 14
- **Complexidade:** 🔴 ALTA
- **Tempo:** 4-6 horas

### 16. Trial de 30 dias

- **Status:** 🔵 Aguardando 15
- **Complexidade:** 🟢 BAIXA
- **Tempo:** 1 hora

### 17. LGPD — Política de Privacidade e Termos

- **Status:** 🟡 Pode rodar paralelo
- **Complexidade:** 🟢 BAIXA (comprar template)
- **Tempo:** 30 min + R$ 200-500 de investimento

### 18. Abrir CNPJ (MEI)

- **Status:** 🟡 Pode rodar paralelo
- **Complexidade:** 🟢 BAIXA
- **Tempo:** 15 minutos no Portal do Empreendedor

### 19. Primeiro cliente piloto

- **Status:** 🔵 Aguardando 18
- **Complexidade:** 🔴 ALTA (relacionamento humano)
- **Tempo:** 1-2 dias presencial

---

## Legenda

| Símbolo | Significado                 |
| ------- | --------------------------- |
| 🟡      | Pendente — pronto pra fazer |
| 🔵      | Aguardando dependência      |
| ✅      | Concluído                   |
| 🚫      | Bloqueado / problema        |
| 🟢      | Complexidade baixa          |
| 🟡      | Complexidade média          |
| 🔴      | Complexidade alta           |
