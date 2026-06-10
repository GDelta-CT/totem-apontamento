-- 015_cliente_contato.sql
-- Campos de contato do cliente na OS, captados no momento do orçamento.
-- Objetivo: a OS passa a guardar quem é o dono do carro (nome + WhatsApp).
-- Esses dados alimentam a Delta (bot de WhatsApp) via a ponte de dados:
-- WhatsApp do cliente -> identidade (a Delta o reconhece pelo telefone).
-- Ambos opcionais e sem validação cega (flexível). Idempotente.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;

-- Busca por nome do cliente no admin (futuro), sem custo relevante de escrita.
CREATE INDEX IF NOT EXISTS idx_os_cliente_nome
  ON public.ordens_servico (cliente_nome);
