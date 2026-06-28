// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { resolveRange } from './resolver.js'

function selectQuoteIn(html: string, quote: string): Range {
  document.body.innerHTML = html
  const block = document.querySelector('[data-src-start]')!
  const textNode = block.firstChild as Text
  const at = (block.textContent ?? '').indexOf(quote)
  const range = document.createRange()
  range.setStart(textNode, at)
  range.setEnd(textNode, at + quote.length)
  return range
}

describe('resolveRange', () => {
  const html =
    '<p data-src-start="26" data-src-end="85">We hit the DB on every request, which is fine.</p>'

  it('recovers the quote, block hint, and surrounding context', () => {
    const res = resolveRange(selectQuoteIn(html, 'We hit the DB on every request'))
    expect(res?.quote).toBe('We hit the DB on every request')
    expect(res?.hintStart).toBe(26)
    expect(res?.suffix.startsWith(', which is fine')).toBe(true)
    expect(res?.prefix).toBe('') // quote is at the block start
  })

  it('captures a prefix when the selection is mid-block', () => {
    const res = resolveRange(selectQuoteIn(html, 'every request'))
    expect(res?.quote).toBe('every request')
    expect(res?.prefix.endsWith('We hit the DB on ')).toBe(true)
  })

  it('returns null for a collapsed/empty selection', () => {
    document.body.innerHTML = html
    const range = document.createRange()
    const textNode = document.querySelector('p')!.firstChild as Text
    range.setStart(textNode, 3)
    range.setEnd(textNode, 3)
    expect(resolveRange(range)).toBeNull()
  })
})
