# Diagnóstico — GDelta Totem (01/06/2026)

Estado real do produto, consolidando o progresso do build + a auditoria de 5 agentes
(design, regras de negócio, isolamento). Linguagem direta. Detalhes em
`PUNCH-LIST-DESIGN.md` e `AUDITORIA-FUNCIONAL.md`.

---

## Veredito

O build está **mais avançado do que o esperado** — todas as telas do dono/admin já foram
esboçadas e o banco chegou na migration 006. **Uma demo no ambiente de teste, com a Auto Risco
(1 oficina), é viável hoje.** Porém, antes de rodar "de verdade" na parede com dado confiável,
há **3 correções estruturais** e **1 decisão de produto** pendentes. Nenhuma delas trava a demo
de hoje; todas travam o "rodar pra valer".

Resumo da saúde: **Build = adiantado · Design = bom, com ajustes · Lógica/Dados = 3 furos ·
Segurança = ok pra 1 oficina, bloqueada pra 2+.**

---

## 1. O que já está de pé (e bom)

- **Telas esboçadas no `/admin`:** OS, funcionários, produção (Kanban), prazos do dono,
  anomalias. Ou seja, os Passos 1, 3, 3.5 e 4 já têm esqueleto.
- **Banco:** migrations 001 → 006 (campos de OS, grants, status/placa única, anomalia).
- **Marca:** logo impecável; login da oficina, do admin e tela "sem acesso" na identidade G
  Delta; o "chrome" das telas (fundo, topo, bordas) usa os tokens da marca.
- **Regras de negócio corretas (não mexer):** placa em maiúsculas + uma OS ativa por placa +
  buscar-antes-de-criar; predicado de "apontamento ativo" consistente; escrita já isolada por
  oficina (via JWT).

## 2. Riscos reais (corrigir antes de "rodar pra valer")

- **[CRÍTICO] Correção de fantasma sobrescreve o tempo.** Hoje o admin "corrige" apagando o
  valor original, sem exigir motivo e sem deixar rastro — o oposto da regra à prova de
  auditoria. É o "laço fatal" da adoção. **Mitigação:** ainda está **desligada**, então dá
  tempo de refazer certo (log append-only + motivo obrigatório) antes de ativar.
- **[CRÍTICO p/ 2+ oficinas] Isolamento de leitura aberto.** No teste, as leituras pegam dado
  de todas as oficinas (policies abertas + leitura no browser). **Com 1 oficina (piloto) é ok.
  NÃO cadastrar a 2ª** até mover a leitura pro servidor e aplicar o lockdown.
- **[ATENÇÃO] Tempo no relógio do tablet, não do servidor.** Teto de fantasma (10,5h) e saúde
  de prazo calculam com o relógio do dispositivo — relógio torto = fantasma falso e prazo
  errado. Servidor deve entregar o tempo já calculado.
- **[ATENÇÃO/Design] Cores de estado fora da paleta + precedência do Kanban incompleta.**
  Funciona, mas tira credibilidade; falta o cinza "parado sem bloqueio" e separar
  bloqueio-problema (vermelho) de bloqueio-fluxo (âmbar).

## 3. Decisão de produto pendente (sua)

- **Estado do operário.** O ponto foi removido (como você quis), e com isso o painel não
  distingue mais "parado na oficina" de "foi embora" — todo mundo vira "ausente". Opções:
  (a) derivar "presente" sem ponto (quem teve apontamento hoje), (b) aceitar 3 estados, ou
  (c) reintroduzir presença leve sem cara de RH.

## 4. Aderência ao escopo travado

Dentro do escopo. A remoção do ponto está **alinhada** ao posicionamento "produtividade, não
RH/folha". Nenhuma terminologia de RH/"ponto eletrônico" vaza pra tela (só uma copy a revisar:
"QUEM ESTÁ NO PONTO?" → "QUEM ESTÁ NO TURNO?"). Migrations sensíveis (anomalia/lockdown)
respeitam a regra de "não aplicar sem aprovação".

## 5. Prontidão por cenário

- **Demo hoje (1 oficina, teste):** VIÁVEL. Só rodar os 9 passos do teste de fumaça e **não**
  cadastrar 2ª oficina.
- **Rodar na parede com dado confiável:** falta corrigir o relógio (servidor) e o fluxo de
  anomalia (append-only + motivo).
- **Escalar pra 2+ oficinas:** falta mover leitura pro servidor + aplicar o lockdown de RLS.

## 6. Próximos passos priorizados

1. **Você:** decidir o estado do operário (item 3).
2. **Code:** servidor calcula o tempo decorrido (corrige relógio + acurácia de anomalia/prazo).
3. **Code + seu aval:** redesenhar a correção de anomalia como log append-only com motivo
   obrigatório (plano de schema antes de ligar a Migration 006).
4. **Quando for passar de 1 oficina:** mover leitura pro servidor e aplicar o lockdown de RLS
   (plano + aprovação — toca segurança).
5. **Design:** aplicar o `PUNCH-LIST-DESIGN.md` (tokens de cor semântica + precedência do
   Kanban) — eleva a credibilidade sem refazer nada estrutural.
