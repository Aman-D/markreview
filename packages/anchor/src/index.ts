// @markreview/anchor — text-quote anchoring. Pure; no I/O.
//
// M0 boundary stub: the contract (the three-tier resolve outcome and the
// precedence ladder) is locked in ARCHITECTURE.md; the heuristics and fuzzy
// matcher land in M2 — the technical heart we de-risk before the agent loop.

/** A quote + surrounding context, the anchor that survives doc rewrites. */
export interface Anchor {
  quote: string
  prefix?: string
  suffix?: string
  /** Character-offset hint into anchoredRev's source. A cache; quote wins on conflict. */
  range?: { start: number; end: number }
  anchoredRev?: number
  checksum?: string
}

/** resolveAnchor's three-tier outcome (agent-map > fuzzy > orphan). */
export type ResolveOutcome =
  | { kind: 'resolved'; start: number; end: number }
  | { kind: 'orphan'; reason: string }

/** Resolve an anchor against a (possibly edited) source. Implemented in M2. */
export function resolveAnchor(_source: string, _anchor: Anchor): ResolveOutcome {
  throw new Error('@markreview/anchor.resolveAnchor: implemented in M2')
}
