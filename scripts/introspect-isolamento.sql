-- Introspeccao (SO-LEITURA) do isolamento multi-tenant no banco de TESTE.
-- Objetivo: capturar o DDL do hook de JWT + dos triggers que carimbam oficina_id,
-- para versionar numa migration (009). Nao altera nada.

-- A) Funcoes candidatas ao Custom Access Token Hook (token/jwt/claim/oficina/hook):
select n.nspname as schema, p.proname as func, pg_get_functiondef(p.oid) as ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('auth', 'public')
  and (p.proname ilike '%token%' or p.proname ilike '%jwt%'
       or p.proname ilike '%claim%' or p.proname ilike '%oficina%' or p.proname ilike '%hook%');

-- B) Triggers nas tabelas public (procura o BEFORE INSERT que carimba oficina_id):
select event_object_table as tabela, trigger_name, action_timing as quando,
       event_manipulation as evento, action_statement as faz
from information_schema.triggers
where trigger_schema = 'public'
order by 1, 2;

-- C) DDL de TODAS as funcoes-gatilho em public (a que carimba oficina_id esta aqui):
select p.proname as func, pg_get_functiondef(p.oid) as ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
order by 1;
