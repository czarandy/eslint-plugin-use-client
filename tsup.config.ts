import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Declarations are emitted by a separate `tsc -p tsconfig.build.json` pass
  // (same split silver-ui uses), so tsup only emits JS.
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  external: ['eslint'],
});
