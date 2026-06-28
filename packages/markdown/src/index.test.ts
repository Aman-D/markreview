import { describe, it, expect } from 'vitest'
import { render, locateQuote } from './index.js'

const src =
  '# Auth plan\n\n## Sync path\nWe hit the DB on every request, which is fine at low scale.\n'

describe('render', () => {
  it('renders markdown to HTML', () => {
    const { html } = render(src)
    expect(html).toContain('Auth plan')
    expect(html).toMatch(/<h1[\s>]/)
    expect(html).toMatch(/<p[\s>]/)
  })

  it('annotates elements with their source offsets', () => {
    const pStart = src.indexOf('We hit')
    const { html, sourceMap } = render(src)

    expect(html).toContain(`data-src-start="${pStart}"`)

    const para = sourceMap.find((s) => s.tag === 'p')
    expect(para).toBeDefined()
    expect(para?.start).toBe(pStart)
    expect(src.slice(para!.start, para!.end)).toContain(
      'We hit the DB on every request',
    )
  })
})

describe('locateQuote', () => {
  it('finds a unique quote and recovers its offsets (round-trip)', () => {
    const quote = 'We hit the DB on every request'
    const start = src.indexOf(quote)
    expect(locateQuote(src, { quote })).toEqual({
      start,
      end: start + quote.length,
    })
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
})
