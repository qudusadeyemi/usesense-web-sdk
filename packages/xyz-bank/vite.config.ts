/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Served from try.usesense.ai/xyz: the build lands in the Next demo's public
// folder, and next.config.js rewrites /xyz/* routes to /xyz/index.html.
export default defineConfig({
  base: '/xyz/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../demo/public/xyz', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5180 },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
