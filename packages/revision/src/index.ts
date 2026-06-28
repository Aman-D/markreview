// @markreview/revision — revision storage policy. Pure; no I/O.
//
// M0 boundary stub. rev1 is stored full, later revisions as unified diffs;
// materialize() reconstructs any revision's content, diff() computes the patch.
// Built in M4.

export interface Revision {
  rev: number
  content?: string
  diffFrom?: number
  diff?: string
}

/** Reconstruct full content for a revision. Implemented in M4. */
export function materialize(_revisions: ReadonlyArray<Revision>, _rev: number): string {
  throw new Error('@markreview/revision.materialize: implemented in M4')
}
