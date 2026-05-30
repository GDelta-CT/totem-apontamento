# 📋 Log de Decisões — GDelta

> Toda decisão técnica/estratégica importante fica registrada aqui.
> Inclui quem decidiu, quando, e por quê.
> Se você (Eliel) discordar de alguma, basta marcar `[REVISAR]` e me avisar.

---

## Convenções

- **🤖** = decisão tomada por IA (Claude dashboard ou Claude app)
- **👤** = decisão tomada pelo Eliel
- **🤝** = decisão conjunta
- **[REVISAR]** = decisão a ser revisada

---

## Decisões registradas

### 2026-05-23 — Caminho de execução: consertar fundação primeiro

- **Quem:** 🤖 Claude (dashboard)
- **Justificativa:** Diagnóstico 360° revelou vazamento crítico de segurança (banco exposto via ANON_KEY no frontend). Adicionar features sobre fundação quebrada é construir produto que será cancelado pelo primeiro cliente que descobrir.
- **Alternativa rejeitada:** Continuar adicionando features (Stripe, dashboard) — rejeitada por risco LGPD.

### 2026-05-23 — Stack de automação

- **Quem:** 🤖 Claude (dashboard) + Claude (app)
- **Decisões:**
  - GitHub Actions para CI/CD → grátis, já funcionando
  - Supabase Migrations versionadas em `/supabase/migrations/` → padrão da indústria
  - Sentry para monitoramento de erros → free tier serve até 5k erros/mês
  - Crisp Free para suporte ao cliente → upgrade futuro para Crisp Pro com IA
  - Resend para emails transacionais → free tier de 100 emails/dia
  - Backup automático diário via GitHub Actions Schedule → grátis

### 2026-05-23 — Modelo de cobrança

- **Quem:** 🤝 Claude dashboard + Claude app
- **Decisão:** Híbrido — R$ 97/mês base + R$ 12 por operário ativo no Pro
- **Pendente confirmação do Eliel:** Sim, mas sem urgência (só importa quando vender)

### 2026-05-23 — Gateway de pagamento

- **Quem:** 🤖 Claude (dashboard)
- **Decisão:** Asaas (não Stripe)
- **Justificativa:** SaaS B2B brasileiro: Asaas emite NF-e automática, aceita PIX recorrente, recebimento em 2 dias. Stripe seria overkill e exige sistema separado pra NF.

### 2026-05-23 — Cliente piloto

- **Quem:** 👤 Eliel
- **Decisão:** Eliel atua como especialista do domínio durante construção. Cliente real só na semana 8+.
- **Justificativa:** Eliel tem experiência operacional E administrativa do mercado — velocidade > validação externa nesta fase.

### 2026-05-23 — Modelo de suporte

- **Quem:** 🤝 Claude app + Eliel
- **Decisão:** IA + ticket + Eliel quando complexo. SLA 48h úteis.
- **Justificativa:** Reduz interrupção do Eliel, mantém qualidade aceitável pra fase inicial.

### 2026-05-23 — Offline-first no totem

- **Quem:** 👤 Eliel
- **Decisão:** Adiar para Onda 3 (depois do MVP). Internet raramente cai nas oficinas.
- **Justificativa:** Economiza 3-4 semanas de desenvolvimento agora.

### 2026-05-23 — PIN do operário: 6 dígitos

- **Quem:** 🤖 Claude (dashboard) — Claude (app) concordou
- **Justificativa:** 4 dígitos é shoulder-surfable num totem público. 6 dígitos elimina 99% do risco com custo de UX desprezível (~1 segundo extra).

### 2026-05-23 — Estrutura multi-tenant: shared schema + RLS

- **Quem:** 🤖 Claude (dashboard) — Claude (app) concordou
- **Justificativa:** Padrão da indústria para SaaS B2B pequeno. Schema-per-tenant fica pra clientes enterprise quando surgirem.

### 2026-05-23 — TypeScript estrito

- **Quem:** 🤖 Claude (app) — decisão original do projeto
- **Validação:** Claude (dashboard) confirma decisão correta.

---

## Decisões pendentes (esperando Eliel)

> Atualizadas conforme aparecem. Não precisam ser respondidas todas de uma vez.

| Decisão                                                 | Urgência | Quando precisa             |
| ------------------------------------------------------- | -------- | -------------------------- |
| CNPJ — MEI ou ME                                        | 🟢 Baixa | Antes do 1º cliente fechar |
| Política de Privacidade — comprar template ou advogado? | 🟡 Média | Antes do 1º cliente fechar |
| Cliente piloto real — quem é a oficina?                 | 🟢 Baixa | Semana 8+                  |
| Domínio gdelta.com.br — registrar?                      | 🟢 Baixa | Quando confortável         |
