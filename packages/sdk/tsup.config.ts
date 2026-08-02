import { defineConfig } from 'tsup';
import { createRequire } from 'node:module';

// Injected into src/flows/version.ts so the SDK reports its own version to the
// server. Read from package.json rather than hand-maintained, which drifts.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

export default defineConfig({
  define: { __USESENSE_SDK_VERSION__: JSON.stringify(version) },
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
