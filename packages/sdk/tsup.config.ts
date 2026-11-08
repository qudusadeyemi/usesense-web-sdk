import { defineConfig } from 'tsup';

// USESENSE_DEBUG=1 builds the screenshot-rig variant into dist-debug/ with the
// capture engine's test hooks compiled in. The published build (dist/) has
// __USESENSE_DEBUG__ = false, so esbuild removes every hook.
const debug = process.env.USESENSE_DEBUG === '1';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: !debug,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: debug ? 'dist-debug' : 'dist',
  external: ['react', 'react-dom'],
  define: { __USESENSE_DEBUG__: debug ? 'true' : 'false' },
});
