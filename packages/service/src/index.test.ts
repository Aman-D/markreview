import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validate } from '@markreview/schema'
import { loadReview, fsReviewStore } from '@markreview/store-fs'
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

const open = () => ReviewService.open(docPath, fsReviewStore, opts)

describe('ReviewService.open', () => {
  it('creates a schema-valid rev-1 review and persists the sidecar', async () => {
    const review = (await open()).getReview()
    expect(review.doc.rev).toBe(1)
    expect(validate(review).errors).toEqual([])
    expect(loadReview(join(dir, 'plan.review.json')).doc.rev).toBe(1)
  })

  it('reloads an existing sidecar instead of recreating it', async () => {
    await (await open()).addOverallComment({ body: 'first pass' })
    const reopened = await open()
    expect(reopened.getReview().comments).toHaveLength(1)
  })

  it('rejects an empty docPath', async () => {
    await expect(ReviewService.open('', fsReviewStore, opts)).rejects.toThrow(/docPath/)
  })

  it('rejects a missing document', async () => {
    await expect(
      ReviewService.open(join(dir, 'nope.md'), fsReviewStore, opts),
    ).rejects.toThrow(/not found/)
  })
})

describe('commenting', () => {
  it('adds an inline comment, resolving the range from the quote, and persists', async () => {
    const svc = await open()
    const review = await svc.addInlineComment({
      quote: 'We hit the DB on every request',
      suffix: ', which is fine.',
      hintStart: DOC.indexOf('## Sync path'),
      body: 'Scale past 10k?',
    })
    expect(review.comments).toHaveLength(1)
    const anchor = review.comments[0]?.anchor
    expect(anchor?.quote).toBe('We hit the DB on every request')
    // range resolved via anchor.locateQuote, not supplied by the caller
    expect(anchor?.range).toEqual({
      start: DOC.indexOf('We hit'),
      end: DOC.indexOf('We hit') + 'We hit the DB on every request'.length,
    })
    expect(validate(review).errors).toEqual([])
    expect(loadReview(join(dir, 'plan.review.json')).comments).toHaveLength(1)
  })

  it('adds an overall (anchorless) comment', async () => {
    const review = await (await open()).addOverallComment({ body: 'Add rate limiting.' })
    expect(review.comments[0]?.type).toBe('overall')
    expect(review.comments[0]?.anchor).toBeUndefined()
    expect(validate(review).errors).toEqual([])
  })

  it('assigns sequential, collision-safe comment ids derived from existing max', async () => {
    const svc = await open()
    await svc.addOverallComment({ body: 'one' })
    const review = await svc.addOverallComment({ body: 'two' })
    expect(review.comments.map((c) => c.id)).toEqual(['c_01', 'c_02'])
    // reopening continues from the persisted max, not from length
    const reopened = await open()
    const next = await reopened.addOverallComment({ body: 'three' })
    expect(next.comments.map((c) => c.id)).toEqual(['c_01', 'c_02', 'c_03'])
  })
})

describe('render', () => {
  it('renders the current revision with source offsets', async () => {
    const { html, sourceMap } = (await open()).render()
    expect(html).toContain('Auth plan')
    expect(html).toContain('data-src-start')
    expect(sourceMap.some((s) => s.tag === 'p')).toBe(true)
  })
})
