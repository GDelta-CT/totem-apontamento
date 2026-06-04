-- 013_etapa_concluida.sql
-- Sinal EXPLICITO de "etapa concluida" no apontamento (escopo TRAVADO: ao
-- finalizar a tarefa, o operario diz se concluiu a etapa). Com isso o painel
-- pode mostrar "aguardando proxima etapa" de forma explicita, em vez de
-- adivinhar (hoje deriva "aguardando" so da ausencia de apontamento ativo).
--
-- ADITIVO + idempotente: coluna com DEFAULT seguro; linhas existentes recebem
-- false; nao toca dados, permissoes (GRANTS) nem RLS. O totem segue funcionando.

ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS etapa_concluida BOOLEAN NOT NULL DEFAULT false;
