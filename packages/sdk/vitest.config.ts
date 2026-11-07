import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __USESENSE_DEBUG__: 'false' },
  test: {
    environment: 'node',
    globals: true,
  },
});
