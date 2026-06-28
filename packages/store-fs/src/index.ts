// @markreview/store-fs — SURFACE. Reads/writes the .review.json sidecar.
//
// This is the boundary made concrete: a surface MAY do filesystem I/O (it imports
// node:fs below), whereas the pure-core packages may not — import-lint enforces
// exactly that asymmetry. Atomic writes, git identity, and sibling-revision
// layout land in M1.

import { readFileSync } from 'node:fs'
import { validate, migrate } from '@markreview/schema'

/** Load and validate a .review.json sidecar from disk. */
export function loadReview(path: string): unknown {
  const data = migrate(JSON.parse(readFileSync(path, 'utf8')))
  const result = validate(data)
  if (!result.valid) {
    throw new Error(`invalid .review.json at ${path}:\n  ${result.errors.join('\n  ')}`)
  }
  return data
}
