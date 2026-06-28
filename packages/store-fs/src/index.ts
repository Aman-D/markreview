// @markreview/store-fs — SURFACE. Local-filesystem adapter for the ReviewStore
// port (model.ReviewStore). Reads/writes the .review.json sidecar next to the
// doc, atomically (temp file + rename) so a crash mid-write can't corrupt it.
//
// This is the boundary made concrete: a surface MAY do filesystem I/O, whereas
// the pure-core packages may not — import-lint enforces that asymmetry.

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parse, join } from 'node:path'
import { validate, migrate } from '@markreview/schema'
import type { Review, ReviewStore } from '@markreview/model'

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
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error(`invalid .review.json at ${path}: not valid JSON`)
  }
  const data = migrate(raw as { specVersion?: string })
  const result = validate(data)
  if (!result.valid) {
    throw new Error(
      `invalid .review.json at ${path}:\n  ${result.errors.join('\n  ')}`,
    )
  }
  return data as unknown as Review
}

/** Atomically write a review to disk (unique temp file + rename, with cleanup). */
export function saveReview(path: string, review: Review): void {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  writeFileSync(tmp, `${JSON.stringify(review, null, 2)}\n`, 'utf8')
  try {
    renameSync(tmp, path)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      /* best-effort cleanup */
    }
    throw err
  }
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

/** The ReviewStore port implemented over the local filesystem. */
export const fsReviewStore: ReviewStore = {
  exists: (docPath) => sidecarExists(docPath),
  loadReview: (docPath) => loadReview(sidecarPathFor(docPath)),
  saveReview: (docPath, review) => saveReview(sidecarPathFor(docPath), review),
  readDoc: (docPath) => {
    if (!existsSync(docPath)) {
      throw new Error(`document not found: ${docPath}`)
    }
    return readFileSync(docPath, 'utf8')
  },
}
