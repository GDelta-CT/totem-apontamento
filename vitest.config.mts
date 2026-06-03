import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Config MÍNIMA de testes (GDelta-Totem).
 *
 * Escopo: testes UNITÁRIOS de funções de LÓGICA PURA (sem Supabase/rede).
 * - environment 'node': não precisamos de DOM para funções puras.
 * - alias '@/' -> './src': espelha o paths do tsconfig.json.
 * - include restrito aos nossos *.test.ts e exclude agressivo para o runner
 *   NÃO varrer os milhares de *.test.js de node_modules / .aiox-core / .claude.
 *
 * Não toca em app, lógica de negócio nem build do Next. Desfazer = apagar este
 * arquivo + a devDependency/script no package.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.aiox-core/**',
      '**/.claude/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/build-output/**',
      '**/design-systems/**',
    ],
  },
});
