-- =====================================================================
-- Rollback da Migration 011 (TESTE) — remove as RPCs de relógio do servidor.
-- ALVO: TESTE (pvrnimckfgdmgjrjueap). NUNCA em produção.
--
-- Seguro: as funções são ADITIVAS e não tocam dados nem schema. Dropá-las só
-- volta o carimbo de tempo para o caminho antigo (relógio do tablet, via .update
-- no .ts). NÃO reverte dados já gravados — apontamentos cujo tempo foi carimbado
-- pelo servidor continuam corretos.
--
-- ATENÇÃO: só rode este rollback DEPOIS de reverter o código .ts que chama as
-- RPCs (docs/PLANO-RELOGIO-SERVIDOR.md). Dropar a função com o .ts ainda
-- chamando supabase.rpc(...) faria pausa/fim falharem no totem.
-- =====================================================================

begin;

drop function if exists public.fn_pausar_apontamento(uuid, text);
drop function if exists public.fn_retomar_apontamento(uuid);
drop function if exists public.fn_finalizar_apontamento(uuid);

commit;
