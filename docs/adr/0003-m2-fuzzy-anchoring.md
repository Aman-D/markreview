# 0003. M2 — the fuzzy anchoring engine
- Status: Accepted
- Phase: M2
- Date: 2026-06-29

## Context
M2 is the technical heart: a comment must survive the document being rewritten.
An architecture review run before any code surfaced one fatal constraint and two
correctness traps that shape the whole design.

## Decision
1. **diff-match-patch, locate-by-key + verify-full-quote.** `match_main` (bitap)
   caps patterns at 32 chars and *throws* above that — real quotes are longer. So
   the fuzzy tier locates by the quote's first 32-char key near the hint (falling
   back to a 32-char tail key), then verifies the FULL quote by edit distance
   (`diff_main` + `diff_levenshtein`) over a few candidate window lengths. We do
   NOT match the whole quote with bitap. dmp stays the only matcher (no second
   token/Levenshtein scanner).
2. **Precedence ladder** in `resolveAnchor(source, anchor)`: exact-unique /
   exact-disambiguated-by-context → `exact`; **exact-ambiguous → `orphan`
   immediately** (never fall through to fuzzy — honors "ambiguity → orphan, never
   guess"); absent → fuzzy-near-hint; fuzzy miss / below floor / fuzzy-ambiguous →
   `orphan`. A `locateExact` returns three ways (unique | ambiguous | absent) so
   absent and ambiguous don't collapse to one `null`.
3. **Thresholds:** `Match_Threshold = 0.4` (gates the 32-char locator key only),
   `CONFIDENCE_FLOOR = 0.7` (gates full-quote similarity; demotes fuzzy→orphan),
   `Match_Distance = 1000`, `context = 32`. Floor biased high — a confidently
   wrong anchor is worse than an honest orphan.
4. **Confidence is ephemeral.** The schema has no `confidence` field and no
   `fuzzy` status. `resolveAnchor` returns confidence for the UI to consume at
   render time; it is never persisted. The only persisted transition is
   `status → orphaned`.
5. **`createAnchor(source, range, opts)`** centralizes anchor capture (quote +
   prefix/suffix context + `sha256:` checksum via `node:crypto`, on the core
   allowlist). The service now uses it instead of hand-building anchors (fixes the
   M1 gap where prefix/suffix/checksum were never set).
6. **`reanchor` / `reanchorAll` live in `@markreview/model`** (pure, immutable),
   not in `anchor` or `service`. They own the `status → orphaned` invariant; only
   open inline comments are re-anchored; orphaned comments keep their old anchor
   (still shown against `comment.rev`).
7. **checksum / contentHash are integrity-only**, never part of the matcher.
   `resolveAnchor` is purely quote-based and stays pure + synchronous.

## Alternatives considered
- *`match_main(source, quote, loc)` directly* — rejected: throws on >32-char quotes.
- *Whole-doc token/Levenshtein scan* — rejected: ignores the hint, O(n·m), and dmp
  is the locked tool.
- *Exact-ambiguous → try fuzzy* — rejected: silently guesses, violating contract #2.
- *Persist a `fuzzy` status / confidence* — rejected: not in the schema; confidence
  is a live value.

## Consequences
- Trust comes from fast-check property invariants: **exact-soundness** (an `exact`
  result's slice always equals the quote, for any edit), edits-above stay exact,
  edits-inside degrade to fuzzy/orphan (never wrong-place), deletion orphans.
- Re-anchoring runs in `ReviewService.open` when the doc on disk differs from the
  stored revision (M2 stopgap: updates the current revision's content in place;
  **M4** will append a real diff-based revision and re-anchor across it).
- The web client still string-searches the quote to place highlights, and now
  hides/orphan-badges removed comments. **Follow-up (just after M2):** switch the
  client from string-search to consuming `resolveAnchor` offsets mapped through the
  renderer's `sourceMap`, so there is ONE anchoring brain (removes the divergence
  the review flagged). Tracked, not yet done.
- **Deferred:** agent `anchorMap` consumption (the PRIMARY rung) — M3; revision
  diff storage + `contentHash` fast-path — M4; context-weighted fuzzy scoring.
