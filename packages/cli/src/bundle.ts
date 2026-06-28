// Bundles the browser client (@markreview/web/app) into a single ESM string with
// esbuild, at server start. Keeps the "no persistent build step" stance while
// still shipping real browser JS — esbuild runs in ~tens of ms.

import { build } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export async function bundleClient(): Promise<string> {
  const entry = require.resolve('@markreview/web/app')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
  })
  return result.outputFiles[0]?.text ?? ''
}
