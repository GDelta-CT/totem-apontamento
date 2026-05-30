# 📋 Prompts prontos para o Antigravity

> Cada arquivo nesta pasta é um prompt completo pra colar no Antigravity (qualquer agente).
> Você não precisa pensar — só copiar e colar.

---

## 📚 Como usar

1. Abra o Antigravity no projeto GDelta
2. Abra um agente (Gemini Flash, Gemini Pro ou Claude — tanto faz a maioria das vezes)
3. Abra o arquivo `.txt` deste diretório correspondente à tarefa que quer fazer
4. Copia tudo e cola no agente
5. Espera concluir
6. Confere e dá Accept

---

## 📋 Lista de prompts disponíveis

| Arquivo                         | Pra quê serve                                        | Complexidade |
| ------------------------------- | ---------------------------------------------------- | ------------ |
| `001-aplicar-migration-rls.txt` | Aplicar migration 001 que fecha o vazamento de RLS   | 🟢 Baixa     |
| `002-criar-multi-tenant.txt`    | Criar estrutura multi-tenant (oficinas + oficina_id) | 🟡 Média     |
| `003-audit-log.txt`             | Adicionar audit log e timestamps                     | 🟢 Baixa     |
| `99-template-vazio.txt`         | Template para criar novos prompts                    | —            |

---

## 🤖 Qual agente usar?

| Complexidade | Agente sugerido        | Por quê                         |
| ------------ | ---------------------- | ------------------------------- |
| 🟢 Baixa     | Gemini Flash           | Tarefa mecânica, economiza cota |
| 🟡 Média     | Gemini Pro             | Precisa entender contexto       |
| 🔴 Alta      | Claude Opus (se tiver) | Decisões arquiteturais          |

**Regra de ouro:** sempre comece pelo agente mais barato. Se ele falhar, escala pro próximo.
