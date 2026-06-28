// @markreview/model — the Review aggregate. Pure, immutable, append-only.
//
// M0 boundary stub. Owns the invariants: append comment/reply, add revision,
// apply the agent anchor-map, the comment state machine, and merge() (set-union
// by stable id, last-writer-never-wins). Importing sibling core packages
// (@markreview/anchor, @markreview/schema) is allowed; importing a surface or
// any I/O builtin is not — see scripts/import-lint.mjs.

import type { Anchor } from '@markreview/anchor'
import { SPEC_VERSION } from '@markreview/schema'

export type CommentStatus = 'open' | 'resolved' | 'wontfix' | 'orphaned'

/** Minimal shape of the aggregate; the full model is built across M1–M4. */
export interface Review {
  specVersion: string
  comments: ReadonlyArray<{ id: string; status: CommentStatus; anchor?: Anchor }>
}

/** Create an empty review at the current spec version. */
export function emptyReview(): Review {
  return { specVersion: SPEC_VERSION, comments: [] }
}

/** Merge two reviews by stable id (append-only). Implemented in M4. */
export function merge(_a: Review, _b: Review): Review {
  throw new Error('@markreview/model.merge: implemented in M4')
}
