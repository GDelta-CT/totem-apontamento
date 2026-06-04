-- 012_retrabalho_complexidade.sql
-- Adiciona ao apontamento os campos de RETRABALHO (flag) e COMPLEXIDADE (3 niveis),
-- do escopo TRAVADO do MVP ("Retrabalho e complexidade"). Puramente ADITIVO: colunas
-- com DEFAULT seguro, sem tocar em dados, permissoes (GRANTS) ou RLS. As linhas
-- existentes recebem os defaults automaticamente; o totem continua funcionando.
--
-- Retrabalho:   flag booleana por apontamento (checkbox no inicio). Auto-reportado.
-- Complexidade: escala unica de 3 niveis, 'simples' pre-selecionado (zero toque extra).
--               Guarda em ASCII ('medio' sem acento), igual ao padrao das etapas
--               (chk_etapa_valida usa 'Preparacao','Orcamento'); a UI exibe "Médio".
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + guarda da CHECK, seguro para reaplicar.

ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS retrabalho BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS complexidade TEXT NOT NULL DEFAULT 'simples';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_complexidade_valida'
  ) THEN
    ALTER TABLE public.apontamentos
      ADD CONSTRAINT chk_complexidade_valida
      CHECK (complexidade IN ('simples', 'medio', 'complexo'));
  END IF;
END $$;
