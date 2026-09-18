import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Resolve `@/...` imports to the prototype root so domain code and tests
// share one import convention (mirrors tsconfig `paths`).
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
