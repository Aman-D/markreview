// @markreview/store-fs — SURFACE. Reads/writes the .review.json sidecar.
//
// This is the boundary made concrete: a surface MAY do filesystem I/O, whereas
// the pure-core packages may not — import-lint enforces that asymmetry. Writes
// are atomic (temp file + rename) so a crash mid-write can never corrupt the
// sidecar that holds someone's review.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parse, join } from 'node:path'
import { validate, migrate } from '@markreview/schema'
import type { Review } from '@markreview/model'

/** `plan.md` -> `plan.review.json` (alongside the doc). */
export function sidecarPathFor(docPath: string): string {
  const { dir, name } = parse(docPath)
  return join(dir, `${name}.review.json`)
}

export function sidecarExists(docPath: string): boolean {
  return existsSync(sidecarPathFor(docPath))
}

/** Load and validate a .review.json sidecar from disk. */
export function loadReview(path: string): Review {
  const data = migrate(JSON.parse(readFileSync(path, 'utf8')) as { specVersion?: string })
  const result = validate(data)
  if (!result.valid) {
    throw new Error(
      `invalid .review.json at ${path}:\n  ${result.errors.join('\n  ')}`,
    )
  }
  return data as unknown as Review
}

/** Atomically write a review to disk (temp file + rename). */
export function saveReview(path: string, review: Review): void {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(review, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

/** Best-effort reviewer display name from git config; falls back to "anonymous". */
export function gitAuthor(cwd?: string): string {
  try {
    const name = execFileSync('git', ['config', 'user.name'], {
      cwd,
      encoding: 'utf8',
    }).trim()
    return name || 'anonymous'
  } catch {
    return 'anonymous'
  }
}
