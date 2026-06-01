# Pronto pra Demo — HOJE (ambiente de TESTE)

**Meta de hoje:** fluxo completo demonstrável no **TESTE**, ponta a ponta:
login da oficina → operário aponta → admin cria OS e funcionário. Sem produção, sem hardware.

> Ambiente: **só TESTE** (`pvrnimckfgdmgjrjueap`). Não tocar em produção hoje.
> Dev server: `http://localhost:3000`. Seed do teste tem oficina Demo, 4 funcionários e a
> placa **ABC1D23** pra usar nos testes.

---

## Parte A — Definição de Pronto (o que o Code precisa entregar)

**Totem (operário)** — já existe, só confirmar que segue funcionando:
- [ ] Login da oficina (device) entra no totem.
- [ ] Bater ponto (toca no nome).
- [ ] Achar carro pela **placa** → escolher **etapa** → **play** (cronômetro corre).
- [ ] **Pausar com motivo** e **encerrar**.

**Admin (gestor) — foco do dia:**
- [ ] Login do dono entra no `/admin`.
- [ ] **Criar OS** com os campos finais: placa · modelo · ref Cília (opcional) · data de entrada
      · **data prometida** · **tipo de cliente** (seguradora/cooperativa/particular) · **valor do
      orçamento** · etapa_atual · status_geral.
- [ ] Placa: **normaliza em maiúsculas** + **busca-antes-de-criar** (não duplica OS ativa da
      mesma placa).
- [ ] **Editar** uma OS.
- [ ] **Criar funcionário** (nome; PIN sem uso no piloto) e **listar**.
- [ ] Isolamento: o `oficina_id` no crachá da sessão é o da oficina logada.

**Visual (se der tempo hoje; senão, é o próximo passo):**
- [ ] Telas internas do admin no padrão do `GUIA-DESIGN.md` (tabela, formulário, botão
      primário teal, pílulas de status). Confirmar que os tokens `--gd-*` seguem no `globals.css`.

> **Fora do escopo de hoje:** Kanban ao vivo, painel de prazos do dono, correção de anomalia,
> instalação física, produção. Entram nos próximos passos.

---

## Parte B — Roteiro de teste de fumaça (você mesmo verifica, click a click)

Faça nesta ordem, no `http://localhost:3000`:

1. **Totem:** abrir `/totem` → logar como a oficina → **deve aparecer a tela do totem**.
2. Tocar num funcionário → **bater ponto** → sem erro.
3. Buscar a placa **ABC1D23** → escolher uma etapa → **play** → o cronômetro começa a correr.
4. **Pausar** (escolher um motivo) → **encerrar**. → tudo sem erro.
5. **Admin:** abrir `/admin` → logar como o dono → **entra no painel** (não dá "sem acesso").
6. **Criar uma OS nova** (placa de teste, ex.: `TST0A11`, modelo, tipo de cliente, data
   prometida, valor) → **salva e aparece na lista**.
7. Tentar criar **a mesma placa de novo** → o sistema **avisa que já existe** (busca-antes-de-criar).
8. **Criar um funcionário** de teste → **aparece na lista**.
9. Conferir no crachá da sessão que o **oficina_id** é o da oficina logada.

✅ Se os 9 passos rodam limpos, o **build está demonstrável** — meta de hoje batida.

---

## Parte C — Mensagem pronta pra alinhar o Code (copiar e colar)

```
Foco de HOJE: deixar demonstrável no ambiente de TESTE o fluxo ponta a ponta —
login da oficina → operário aponta → admin cria OS e funcionário.

Finalize o CRUD do Admin: criar/editar OS com os campos finais (placa, modelo, ref Cília
opcional, data de entrada, data prometida, tipo de cliente seguradora/cooperativa/particular,
valor do orçamento, etapa_atual, status_geral); placa normalizada em maiúsculas +
busca-antes-de-criar; criar/listar funcionário.

Se sobrar tempo, aplique o visual do GUIA-DESIGN.md nas telas internas (tabela, formulário,
botão primário teal, pílulas de status) — e confirme que os tokens --gd-* seguem no globals.css.

NÃO precisa hoje: Kanban ao vivo, prazos, anomalia, produção, hardware.
Critérios de aceite e roteiro de teste em docs/PRONTO-PARA-DEMO-HOJE.md.
```

> Lembrete de coordenação: fale com o Code por **nome de funcionalidade** (CRUD de OS,
> funcionário), não por número de passo — as duas numerações são diferentes.
