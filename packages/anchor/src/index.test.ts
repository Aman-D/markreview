import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { resolveAnchor, locateQuote, createAnchor, type Anchor } from './index.js'

const SRC =
  '# Auth plan\n\n## Sync path\nWe hit the DB on every request, which is fine at low scale.\n'

describe('createAnchor', () => {
  it('captures quote, context, range, and checksum', () => {
    const start = SRC.indexOf('We hit the DB on every request')
    const a = createAnchor(SRC, { start, end: start + 30 }, { anchoredRev: 1 })
    expect(a.quote).toBe('We hit the DB on every request')
    expect(a.suffix?.startsWith(', which is fine')).toBe(true)
    expect(a.prefix?.endsWith('## Sync path\n')).toBe(true)
    expect(a.range).toEqual({ start, end: start + 30 })
    expect(a.checksum).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(a.anchoredRev).toBe(1)
  })
})

describe('locateQuote (exact tier)', () => {
  it('finds a unique quote', () => {
    const start = SRC.indexOf('We hit the DB on every request')
    expect(locateQuote(SRC, { quote: 'We hit the DB on every request' })).toEqual({
      start,
      end: start + 30,
    })
  })
  it('orphans (null) on ambiguity', () => {
    expect(locateQuote('dup\ndup\n', { quote: 'dup' })).toBeNull()
  })
})

describe('resolveAnchor — tiers', () => {
  const anchor = createAnchor(
    SRC,
    {
      start: SRC.indexOf('We hit the DB on every request'),
      end: SRC.indexOf('We hit the DB on every request') + 30,
    },
    { anchoredRev: 1 },
  )

  it('exact on an unchanged doc', () => {
    const out = resolveAnchor(SRC, anchor)
    expect(out.kind).toBe('exact')
    if (out.kind === 'exact') expect(SRC.slice(out.start, out.end)).toBe(anchor.quote)
  })

  it('exact after an edit ABOVE the quote (offsets shift, quote preserved)', () => {
    const edited = SRC.replace('# Auth plan', '# Authentication plan (revised)')
    const out = resolveAnchor(edited, anchor)
    expect(out.kind).toBe('exact')
    if (out.kind === 'exact') expect(edited.slice(out.start, out.end)).toBe(anchor.quote)
  })

  it('fuzzy when a few chars INSIDE the quote change', () => {
    const edited = SRC.replace('every request', 'each request')
    const out = resolveAnchor(edited, anchor)
    expect(out.kind === 'fuzzy' || out.kind === 'orphan').toBe(true)
    if (out.kind === 'fuzzy') {
      expect(out.confidence).toBeGreaterThanOrEqual(0.7)
      expect(out.confidence).toBeLessThan(1)
    }
  })

  it('orphan when the quote is deleted', () => {
    const edited = SRC.replace(
      'We hit the DB on every request, which is fine at low scale.',
      'Caching handles all reads.',
    )
    expect(resolveAnchor(edited, anchor).kind).toBe('orphan')
  })

  it('orphan on an ambiguous match with no disambiguator (never guesses)', () => {
    // Quote appears twice; no prefix/suffix/hint to break the tie → orphan.
    const src = 'we hit the db here\nand we hit the db here too\n'
    const bare: Anchor = { quote: 'we hit the db here' }
    expect(resolveAnchor(src, bare).kind).toBe('orphan')
  })
})

// ---- Property invariants (the trust set) -------------------------------------

const arbText = fc
  .array(
    fc.constantFrom('the', 'cache', 'request', 'queue', 'db', 'sync', 'async', '\n', ' ', 'write'),
    { minLength: 20, maxLength: 80 },
  )
  .map((parts) => parts.join(' '))

describe('resolveAnchor — property invariants', () => {
  it('round-trips: an anchor created from a doc resolves exact to the same range', () => {
    fc.assert(
      fc.property(arbText, fc.nat(), fc.nat(), (text, a, b) => {
        if (text.length < 4) return true
        const start = a % (text.length - 1)
        const end = start + 1 + (b % (text.length - start))
        const anchor = createAnchor(text, { start, end })
        if (anchor.quote.trim() === '') return true
        const out = resolveAnchor(text, anchor)
        // SOUNDNESS: if exact, the slice is genuinely the quote
        if (out.kind === 'exact') {
          return text.slice(out.start, out.end) === anchor.quote
        }
        return true // ambiguous quotes may orphan — allowed
      }),
      { numRuns: 300 },
    )
  })

  it('exact-soundness holds for ANY edit: exact result is always a real occurrence', () => {
    fc.assert(
      fc.property(arbText, fc.nat(), fc.nat(), fc.string(), (text, a, b, ins) => {
        if (text.length < 6) return true
        const start = a % (text.length - 2)
        const end = start + 2 + (b % (text.length - start))
        const anchor = createAnchor(text, { start, end })
        if (anchor.quote.trim() === '') return true
        // arbitrary edit somewhere
        const at = ins.length % (text.length + 1)
        const edited = text.slice(0, at) + ins + text.slice(at)
        const out = resolveAnchor(edited, anchor)
        if (out.kind === 'exact') {
          expect(edited.slice(out.start, out.end)).toBe(anchor.quote)
        }
        if (out.kind === 'fuzzy') {
          expect(out.confidence).toBeGreaterThanOrEqual(0.7)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('is pure: does not mutate inputs and is deterministic', () => {
    const a = createAnchor(SRC, { start: 26, end: 56 }, { anchoredRev: 1 })
    const frozen = JSON.stringify(a)
    const r1 = resolveAnchor(SRC, a)
    const r2 = resolveAnchor(SRC, a)
    expect(r1).toEqual(r2)
    expect(JSON.stringify(a)).toBe(frozen)
  })
})
