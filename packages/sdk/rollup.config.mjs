import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

const input = 'src/index.ts'

export default [
  // CJS (Node / bundlers that prefer require())
  {
    input,
    external: ['tslib'],
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        declaration: true,
        declarationDir: './dist',
      }),
    ],
  },
  // ESM (modern bundlers)
  {
    input,
    external: ['tslib'],
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ declaration: false }),
    ],
  },
  // IIFE browser bundle (script-tag / CDN / Cloudflare KV)
  // tslib is bundled inline for self-contained browser use
  {
    input,
    output: {
      file: 'dist/metrone.js',
      format: 'iife',
      name: 'Metrone',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ declaration: false }),
      terser(),
    ],
  },
]
