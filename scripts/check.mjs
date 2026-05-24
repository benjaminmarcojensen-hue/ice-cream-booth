import esbuild from 'esbuild'
import { rm } from 'node:fs/promises'

await rm('node_modules/.tmp/check', { recursive: true, force: true })
await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: 'node_modules/.tmp/check',
  format: 'esm',
  jsx: 'automatic',
  target: ['es2022'],
  loader: {
    '.png': 'dataurl',
    '.svg': 'dataurl',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

console.log('Source bundle check passed')
