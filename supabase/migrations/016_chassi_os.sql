-- 016_chassi_os.sql
-- Número do chassi do veículo na OS. Hoje serve de referência; no futuro,
-- o operário poderá solicitar peças e matéria-prima pelo Totem usando o chassi.
-- Opcional, sem validação cega (flexível). Idempotente.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS chassi TEXT;
