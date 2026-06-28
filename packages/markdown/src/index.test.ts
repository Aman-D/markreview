import { describe, it, expect } from 'vitest'
import { render } from './index.js'

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
