# Notas Técnicas — Riscos em aberto (construção do painel ao vivo)

> Só **questões técnicas não resolvidas** a fechar **antes/durante** a construção da Visão
> Operacional ao Vivo (Kanban) e da correção de anomalia. A lógica de **produto** mora em
> `Pacotes-Produto-Comercial.md` — não misturar. Pode migrar pro `CLAUDE.md` se preferir.

1. **Leitura do painel no servidor (endpoint agregado).** O painel lê muito dado de várias
   tabelas; construir como **um endpoint agregado no servidor** (usando `oficina_id` do JWT),
   não leitura direta do browser. Com as policies já aplicadas, ler pelo servidor é o caminho
   seguro e isolado por oficina. Evita também N+1 (ver item 5).

2. **Ancoragem no relógio do servidor.** Todo tempo decorrido (trabalhado, calendário, teto
   anti-fantasma, saúde de prazo) usa o **`now()` do banco**, nunca o do tablet. O read model
   devolve tempos **já calculados**; a tela só renderiza.

3. **Predicados canônicos de "ativo" e "presente".** Definição **única** de "apontamento ativo"
   (rodando vs. pausado) e "presença aberta", usada igual na escrita (totem) e na leitura
   (painel). Divergência aqui gera estado de operário errado. Fechar antes de codar.

4. **Mecanismo do "fim de expediente" (decisão pendente).** Quem dispara a auto-pausa/auto-saída
   no fim do turno: (a) **tarefa agendada** no horário, ou (b) **reconciliação na leitura** (o
   servidor fecha pendências ao montar o read model). Afeta se "ausente" aparece certo fora do
   expediente. Decidir o trade-off antes da construção.

5. **Consulta agregada — evitar N+1.** Card ↔ apontamentos ativos ↔ funcionários ↔ presença é
   join caro repetido por polling. Confirmar índices em `apontamentos(oficina_id, ativo/fim)`,
   `ordens_servico(oficina_id, status_geral, etapa_atual)` e `pontos_eletronicos(funcionario_id,
   saída nula)`. Preferir **uma** agregação por ciclo.

6. **Contrato do read model.** Fechar os campos que o endpoint devolve por OS e por operário,
   incluindo já os insumos da saúde de prazos (buckets dentro/perto/estourado + par dias×R$),
   pra a camada do dono ser só visualização depois.

7. **Responsividade do painel.** `/admin` é desktop/escritório, mas o dono vai abrir no celular
   no huddle matinal. Layout legível em tela pequena, sem herdar as restrições de toque do totem.

---

**Fora deste arquivo (decisão de domínio, não técnica):** a **ordem das colunas Montagem ×
Polimento** continua em aberto — a pesquisa põe Montagem antes; o código tem Polimento antes.
Confirmar com a Auto Risco. Lugar sugerido: `CLAUDE.md` ou o doc de produto, não aqui.
