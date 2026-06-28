import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validate } from '@markreview/schema'
import { loadReview } from '@markreview/store-fs'
import { ReviewService } from './index.js'

const DOC = '# Auth plan\n\n## Sync path\nWe hit the DB on every request, which is fine.\n'
const opts = { author: 'Aman', now: () => '2026-06-29T10:00:00Z' }

let dir: string
let docPath: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'markreview-svc-'))
  docPath = join(dir, 'plan.md')
  writeFileSync(docPath, DOC, 'utf8')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('ReviewService.open', () => {
  it('creates a schema-valid rev-1 review and persists the sidecar', () => {
    const svc = ReviewService.open(docPath, opts)
    const review = svc.getReview()
    expect(review.doc.rev).toBe(1)
    expect(validate(review).errors).toEqual([])
    // sidecar written to disk
    expect(loadReview(join(dir, 'plan.review.json')).doc.rev).toBe(1)
  })

  it('reloads an existing sidecar instead of recreating it', () => {
    ReviewService.open(docPath, opts).addOverallComment({ body: 'first pass' })
    const reopened = ReviewService.open(docPath, opts)
    expect(reopened.getReview().comments).toHaveLength(1)
  })
})

describe('commenting', () => {
  it('adds an inline comment, anchored and persisted', () => {
    const svc = ReviewService.open(docPath, opts)
    const review = svc.addInlineComment({
      quote: 'We hit the DB on every request',
      suffix: ', which is fine.',
      range: { start: DOC.indexOf('We hit'), end: DOC.indexOf('We hit') + 30 },
      body: 'Scale past 10k?',
    })
    expect(review.comments).toHaveLength(1)
    expect(review.comments[0]?.anchor?.quote).toBe('We hit the DB on every request')
    expect(validate(review).errors).toEqual([])
    expect(loadReview(join(dir, 'plan.review.json')).comments).toHaveLength(1)
  })

  it('adds an overall (anchorless) comment', () => {
    const svc = ReviewService.open(docPath, opts)
    const review = svc.addOverallComment({ body: 'Add rate limiting.' })
    expect(review.comments[0]?.type).toBe('overall')
    expect(review.comments[0]?.anchor).toBeUndefined()
    expect(validate(review).errors).toEqual([])
  })

  it('assigns sequential comment ids', () => {
    const svc = ReviewService.open(docPath, opts)
    svc.addOverallComment({ body: 'one' })
    const review = svc.addOverallComment({ body: 'two' })
    expect(review.comments.map((c) => c.id)).toEqual(['c_01', 'c_02'])
  })
})

describe('render', () => {
  it('renders the current revision with source offsets', () => {
    const svc = ReviewService.open(docPath, opts)
    const { html, sourceMap } = svc.render()
    expect(html).toContain('Auth plan')
    expect(html).toContain('data-src-start')
    expect(sourceMap.some((s) => s.tag === 'p')).toBe(true)
  })
})
