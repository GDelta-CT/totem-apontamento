SELECT '--- 1) Colunas de apontamentos ---' as bloco;
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'apontamentos';

SELECT '--- 2) Triggers ---' as bloco;
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';

SELECT '--- 3) Funcoes ---' as bloco;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name NOT LIKE 'pg\_%';

SELECT '--- 4) Views ---' as bloco;
SELECT table_name FROM information_schema.views WHERE table_schema = 'public';

SELECT '--- 5) Enums ---' as bloco;
SELECT t.typname AS enum_name, string_agg(e.enumlabel, ', ') AS valores
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname;

SELECT '--- 6) Tabelas ---' as bloco;
SELECT table_name, COUNT(*) AS qtd_colunas
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
