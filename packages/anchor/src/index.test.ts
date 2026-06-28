import { describe, it, expect } from 'vitest'
import { resolveAnchor, locateQuote } from './index.js'

describe('resolveAnchor', () => {
  it('reserves the fuzzy tier for M2', () => {
    expect(() => resolveAnchor('source', { quote: 'q' })).toThrow(/M2/)
  })
})

describe('locateQuote', () => {
  const src =
    '# Auth plan\n\n## Sync path\nWe hit the DB on every request, which is fine at low scale.\n'

  it('finds a unique quote and recovers its offsets', () => {
    const quote = 'We hit the DB on every request'
    const start = src.indexOf(quote)
    expect(locateQuote(src, { quote })).toEqual({ start, end: start + quote.length })
  })

  it('disambiguates a repeated quote by prefix', () => {
    const s = 'a: cache miss\nb: cache miss\n'
    const second = s.indexOf('cache miss', s.indexOf('cache miss') + 1)
    expect(locateQuote(s, { quote: 'cache miss', prefix: 'b: ' })).toEqual({
      start: second,
      end: second + 'cache miss'.length,
    })
  })

  it('disambiguates a repeated quote by suffix', () => {
    const s = 'cache miss here\ncache miss there\n'
    const second = s.indexOf('cache miss', 1)
    expect(locateQuote(s, { quote: 'cache miss', suffix: ' there' })).toEqual({
      start: second,
      end: second + 'cache miss'.length,
    })
  })

  it('disambiguates a repeated quote by hintStart', () => {
    const s = 'x\nx\nx\n' // "x" at offsets 0, 2, 4
    expect(locateQuote(s, { quote: 'x', hintStart: 4 })?.start).toBe(4)
  })

  it('returns null when the quote is absent', () => {
    expect(locateQuote(src, { quote: 'not in the doc' })).toBeNull()
  })

  it('returns null when the match is ambiguous (never guesses)', () => {
    const s = 'cache miss\ncache miss\n' // two identical, no disambiguator
    expect(locateQuote(s, { quote: 'cache miss' })).toBeNull()
  })

  it('returns null when prefix matches multiple occurrences equally', () => {
    const s = 'x: dup\nx: dup\n'
    expect(locateQuote(s, { quote: 'dup', prefix: 'x: ' })).toBeNull()
  })
})
