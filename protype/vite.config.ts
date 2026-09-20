import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Same `@/...` convention as vitest/tsconfig so domain, commands, analytics,
// seed and data modules are shared verbatim between the browser and tests.
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  resolve: {
    alias: { '@': root },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});