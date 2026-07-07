import { defineConfig } from 'tsup'

export default defineConfig([
  // stdio binary — shebang required so `npx metrone-mcp` works
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  // shared tool registry — consumed by the worker's /mcp HTTP transport via
  // the "./tools" exports entry. No shebang (it's a library module).
  {
    entry: ['src/tools.ts'],
    format: ['esm'],
    dts: true,
    // no `clean` here — would wipe the index build from the first config
  },
])
