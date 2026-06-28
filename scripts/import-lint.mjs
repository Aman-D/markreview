#!/usr/bin/env node
// import-lint — enforces the core/surface boundary from ARCHITECTURE.md.
//
//   Core packages are PURE: no filesystem, network, process, or other I/O — via
//   imports OR globals — and they must not depend on a surface package. Surfaces
//   (store-fs, service, cli, web, server, mcp) are free to do I/O. This keeps the
//   load-bearing logic embeddable and fully testable.
//
// Fails CLOSED on three axes:
//   1. Layer is read from each package.json `markreview.layer`; a package with no
//      layer field is treated as CORE (so a forgotten tag is over-checked, never
//      skipped).
//   2. Node built-ins in core are an ALLOWLIST (pure compute only); any builtin
//      not explicitly permitted is a violation.
//   3. Global I/O (fetch, process, XMLHttpRequest, eval, ...) is scanned too, so a
//      core package can't reach the network without an import.
//
// Pure static check, zero dependencies, so CI never flakes on tooling.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = join(root, 'packages')

// Pure-compute built-ins a core package may use. Everything else is banned.
const ALLOWED_CORE_BUILTINS = new Set(['crypto', 'util', 'path'])

// Global identifiers that imply I/O / environment access. Banned in core source.
const FORBIDDEN_GLOBALS = [
  { re: /\bfetch\s*\(/, name: 'fetch()' },
  { re: /\bprocess\b/, name: 'process' },
  { re: /\bglobalThis\b/, name: 'globalThis' },
  { re: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
  { re: /\beval\s*\(/, name: 'eval()' },
  { re: /\brequire\s*\(/, name: 'require()' },
  // DOM globals: the root tsconfig pulls in the DOM lib for browser surfaces;
  // core must not reach for it.
  { re: /\bdocument\b/, name: 'document' },
  { re: /\bwindow\b/, name: 'window' },
  { re: /\blocalStorage\b/, name: 'localStorage' },
]

const SPEC_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g

// Blank out comments and string/template literals so the global-identifier scan
// doesn't trip over prose (e.g. the word "document" in a JSDoc comment).
function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    // Shipped source only — tests may read fixtures / use globals.
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p)
  }
  return out
}

function layerOf(pkgDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    return pkg.markreview?.layer ?? 'core' // fail closed: untagged => core
  } catch {
    return 'core'
  }
}

const pkgNames = readdirSync(packagesDir).filter((n) =>
  statSync(join(packagesDir, n)).isDirectory(),
)
const CORE = new Set(pkgNames.filter((n) => layerOf(join(packagesDir, n)) === 'core'))

let violations = 0
const flag = (msg) => {
  console.error(`✗ ${msg}`)
  violations++
}

for (const pkg of CORE) {
  const srcDir = join(packagesDir, pkg, 'src')
  let files
  try {
    files = walk(srcDir)
  } catch {
    continue
  }
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
    const stripped = stripCommentsAndStrings(code)
    const rel = relative(root, file)

    for (const match of code.matchAll(SPEC_RE)) {
      const spec = match[1]
      const bare = spec.replace(/^node:/, '')
      const isBuiltin = spec.startsWith('node:') || builtinModules.includes(bare)
      if (isBuiltin) {
        if (!ALLOWED_CORE_BUILTINS.has(bare)) {
          flag(`core/${pkg}: ${rel} imports non-allowlisted builtin "${spec}"`)
        }
      } else if (spec.startsWith('@markreview/')) {
        const dep = spec.slice('@markreview/'.length).split('/')[0]
        if (!CORE.has(dep)) {
          flag(`core/${pkg}: ${rel} imports surface package "${spec}"`)
        }
      }
    }

    for (const { re, name } of FORBIDDEN_GLOBALS) {
      if (re.test(stripped)) {
        flag(`core/${pkg}: ${rel} uses I/O global "${name}"`)
      }
    }
  }
}

if (violations) {
  console.error(`\nimport-lint: ${violations} boundary violation(s)`)
  process.exit(1)
}
console.log(
  `import-lint: ${CORE.size} core packages are I/O-free (imports + globals) ✓`,
)
