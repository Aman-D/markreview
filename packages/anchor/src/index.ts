// @markreview/anchor — text-quote anchoring. Pure; no I/O.
//
// Owns quote→source-offset location (locateQuote) and, in M2, the full
// createAnchor/resolveAnchor with fuzzy fallback. The locked contract
// (ARCHITECTURE.md #2, SPEC §4): ambiguity → orphan, NEVER guess. locateQuote
// honors that today by returning null when the best match isn't unique.

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

/**
 * resolveAnchor's three-tier outcome (locked contract #2):
 *   exact  — quote located unambiguously
 *   fuzzy  — located via approximate match, with a confidence score
 *   orphan — gone or ambiguous; never guessed
 */
export type ResolveOutcome =
  | { kind: 'exact'; start: number; end: number }
  | { kind: 'fuzzy'; start: number; end: number; confidence: number }
  | { kind: 'orphan'; reason: string }

/** Resolve an anchor against a (possibly edited) source. Fuzzy tier is M2. */
export function resolveAnchor(_source: string, _anchor: Anchor): ResolveOutcome {
  throw new Error('@markreview/anchor.resolveAnchor: fuzzy resolution is M2')
}

export interface QuoteQuery {
  quote: string
  prefix?: string
  suffix?: string
  /** Offset hint (e.g. the containing block's start) to disambiguate. */
  hintStart?: number
}

/**
 * Locate a quote in the source by exact text match, disambiguated by
 * prefix/suffix/hint. Returns null when the quote is absent OR when the best
 * match is not unique (ambiguous → orphan, never guess). Exact tier only; the
 * fuzzy fallback is M2.
 */
export function locateQuote(
  source: string,
  q: QuoteQuery,
): { start: number; end: number } | null {
  if (q.quote === '') return null

  const occurrences: number[] = []
  for (let i = source.indexOf(q.quote); i !== -1; i = source.indexOf(q.quote, i + 1)) {
    occurrences.push(i)
  }
  if (occurrences.length === 0) return null

  const score = (idx: number): number => {
    let s = 0
    if (q.prefix) {
      const before = source.slice(Math.max(0, idx - q.prefix.length), idx)
      if (before.endsWith(q.prefix)) s += 2
    }
    if (q.suffix) {
      const afterStart = idx + q.quote.length
      if (source.slice(afterStart, afterStart + q.suffix.length).startsWith(q.suffix)) {
        s += 2
      }
    }
    if (typeof q.hintStart === 'number') {
      s += 1 / (1 + Math.abs(idx - q.hintStart))
    }
    return s
  }

  const scored = occurrences.map((idx) => ({ idx, s: score(idx) }))
  const top = Math.max(...scored.map((x) => x.s))
  const winners = scored.filter((x) => x.s === top)
  if (winners.length > 1) return null // ambiguous → orphan, never guess

  const best = winners[0]!.idx
  return { start: best, end: best + q.quote.length }
}
