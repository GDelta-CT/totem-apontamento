# PRD - MVP: Sistema Operacional G Delta (v2.0)

## 1. Visão Geral e Objetivo

Transformar a operação da oficina em uma linha de produção industrial fragmentada. O sistema deve permitir que profissionais em diferentes estágios de aprendizado (Auxiliares/Trainees) executem tarefas de apoio, enquanto especialistas focam em intervenções técnicas críticas.

**Foco Estratégico:** - Reduzir dependência de especialistas indisciplinados.

- Criar base de dados para treinamento e efetivação de alunos.
- Monitoramento de tempo real para gestão de gargalos.

## 2. Metodologia de Produção (Níveis A, B e C)

A produção é dividida em três níveis de competência:

- **Nível C (Auxiliar / Aluno):** Volume e preparação (Desmontagem, lixamento inicial, limpeza).
- **Nível B (Júnior / Assistente):** Processos intermediários (Massa, primer, rebatimento leve).
- **Nível A (Especialista):** Alta técnica (Solda estrutural, colorimetria, verniz, polimento de brilho).

## 3. Requisitos Funcionais (RF)

- **RF01 - Apontamento por Nível:** O sistema filtra tarefas baseadas no nível do funcionário (A, B ou C).
- **RF02 - Fluxo de Handoff (Pedágio de Qualidade):** Tarefas de Nível C/B exigem "Aceite Técnico" do Nível A para seguir no fluxo.
- **RF03 - Interrupção por Suprimento:** Botão para pausar tarefa por falta de peça, transferindo o tempo para o "Gargalo Administrativo".
- **RF04 - Monitoramento Comportamental:** Relatórios de assiduidade, eficiência (Tempo Real vs Estimado) e índice de retrabalho.
- **RF05 - Matriz de Competências:** Filtro de microtarefas por nível de acesso.
- **RF06 - Modo Quiosque/Totem:** Interface mobile-first com botões gigantes para uso industrial.

## 4. Matriz de Processos Fragmentada

| Setor          | Fase 1 (Nível C/B)               | Fase 2 (Nível A)                   |
| :------------- | :------------------------------- | :--------------------------------- |
| **Funilaria**  | Desmontagem e limpeza            | Solda, alinhamento e repuxo        |
| **Preparação** | Lixamento de massa e primer      | Acerto de porosidade e isolamento  |
| **Pintura**    | Limpeza de cabine e materiais    | Colorimetria e aplicação de verniz |
| **Polimento**  | Lixamento (1500-3000) e lavagem  | Corte, lustre e espelhamento       |
| **Montagem**   | Acabamentos e acessórios simples | Alinhamentos críticos e eletrônica |

## 5. Requisitos Não Funcionais

- **RNF01:** Interface mobile-first otimizada para tablets.
- **RNF02:** Atualização em tempo real (Real-time updates) via Supabase/Websockets.
