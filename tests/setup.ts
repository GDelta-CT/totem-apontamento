/**
 * Setup global dos testes (carregado pelo Vitest antes de cada arquivo).
 *
 * Por que existe: `src/lib/supabase/client.ts` faz `throw` no topo do módulo
 * se NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY estiverem ausentes.
 * As funções PURAS que testamos (normalizarPlaca, parseISOComUTC, formatarHora…)
 * moram em queries.ts, que importa tipos de client.ts — então o módulo client.ts
 * é avaliado mesmo sem usarmos o cliente. Definimos valores DUMMY só para o
 * módulo carregar. NÃO conectam em lugar nenhum (nenhum teste faz I/O).
 *
 * Estes valores NÃO são credenciais reais — são placeholders fake de teste.
 *
 * TZ fixo em UTC: formatarHora() usa getHours()/getMinutes() (hora LOCAL do
 * processo) sobre um instante UTC. Sem fixar o fuso, o teste seria flaky
 * (passaria/falharia conforme a máquina). Fixar TZ=UTC torna a asserção
 * determinística. Não altera a lógica do app — só o ambiente do runner.
 */
process.env.TZ = 'UTC';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key-not-a-real-secret';
