#!/usr/bin/env node
// import-lint — enforces the core/surface boundary from ARCHITECTURE.md.
//
//   Core packages are PURE: no filesystem, network, process, or other I/O, and
//   they must not depend on a surface package. Surfaces (store-fs, service, cli,
//   web, server, mcp) are free to do I/O. This keeps the load-bearing logic
//   embeddable and fully testable, and stops surface concerns from leaking into
//   the format/anchoring/model layer.
//
// Pure static check, zero dependencies, so CI never flakes on tooling.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Pure-core packages. Everything else under packages/* is a surface.
const CORE = ['schema', 'anchor', 'model', 'markdown', 'revision', 'agent']

// Node built-ins that perform I/O or touch the environment. Banned in core.
const FORBIDDEN = new Set([
  'fs', 'fs/promises', 'http', 'http2', 'https', 'net', 'tls', 'dns',
  'dgram', 'child_process', 'cluster', 'worker_threads', 'os', 'process',
  'readline', 'repl', 'inspector', 'v8', 'vm', 'perf_hooks',
])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    // Shipped source only — tests may read fixtures from disk.
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p)
  }
  return out
}

// Captures the module specifier from `... from '<spec>'`, `import('<spec>')`,
// and `require('<spec>')`.
const SPEC_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g

let violations = 0
for (const pkg of CORE) {
  const srcDir = join(root, 'packages', pkg, 'src')
  let files
  try {
    files = walk(srcDir)
  } catch {
    continue // package not scaffolded yet
  }
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    for (const match of code.matchAll(SPEC_RE)) {
      const spec = match[1]
      const builtin = spec.replace(/^node:/, '')
      if (FORBIDDEN.has(builtin)) {
        console.error(`✗ core/${pkg}: ${rel} imports I/O builtin "${spec}"`)
        violations++
      } else if (spec.startsWith('@markreview/')) {
        const dep = spec.slice('@markreview/'.length).split('/')[0]
        if (!CORE.includes(dep)) {
          console.error(`✗ core/${pkg}: ${rel} imports surface package "${spec}"`)
          violations++
        }
      }
    }
  }
}

if (violations) {
  console.error(`\nimport-lint: ${violations} boundary violation(s)`)
  process.exit(1)
}
console.log('import-lint: core packages are I/O-free and surface-free ✓')
