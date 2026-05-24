import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import esbuild from 'esbuild'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/assets', { recursive: true })

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: 'dist/assets',
  entryNames: 'app',
  assetNames: '[name]',
  format: 'esm',
  jsx: 'automatic',
  splitting: false,
  minify: true,
  sourcemap: false,
  target: ['es2022'],
  loader: {
    '.png': 'file',
    '.svg': 'file',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

if (existsSync('public')) {
  await cp('public', 'dist', { recursive: true })
}

await writeFile(
  'dist/index.html',
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ice Cream Booth Reporting</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`,
)

console.log('Built dist/')
