import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReviewService } from '@markreview/service'
import { fsReviewStore } from '@markreview/store-fs'
import { createApp } from './server.js'

const DOC = '# Auth plan\n\n## Sync path\nWe hit the DB on every request, which is fine.\n'
const opts = { author: 'Aman', now: () => '2026-06-29T10:00:00Z' }

let dir: string
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'markreview-cli-'))
  const docPath = join(dir, 'plan.md')
  writeFileSync(docPath, DOC, 'utf8')
  const service = await ReviewService.open(docPath, fsReviewStore, opts)
  app = createApp(service, '/* client */')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('GET /api/review', () => {
  it('returns the review and rendered html', async () => {
    const res = await app.request('/api/review')
    expect(res.status).toBe(200)
    const data = (await res.json()) as { review: { doc: { rev: number } }; html: string }
    expect(data.review.doc.rev).toBe(1)
    expect(data.html).toContain('data-src-start')
  })
})

describe('GET /', () => {
  it('serves the page shell with the bundled client', async () => {
    const res = await app.request('/')
    const html = await res.text()
    expect(html).toContain('Mark<span>Review</span>')
    expect(html).toContain('/* client */')
  })
})

describe('POST /api/comments', () => {
  it('adds an inline comment and the next GET reflects it', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'inline',
        quote: 'We hit the DB on every request',
        suffix: ', which is fine.',
        body: 'Scale past 10k?',
      }),
    })
    expect(res.status).toBe(200)
    const { review } = (await res.json()) as { review: { comments: unknown[] } }
    expect(review.comments).toHaveLength(1)

    const after = await (await app.request('/api/review')).json()
    expect((after as { review: { comments: unknown[] } }).review.comments).toHaveLength(1)
  })

  it('adds an overall comment', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'overall', body: 'Add rate limiting.' }),
    })
    const { review } = (await res.json()) as { review: { comments: { type: string }[] } }
    expect(review.comments[0]?.type).toBe('overall')
  })

  it('rejects a missing body with 400', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'overall' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown type with 400', async () => {
    const res = await app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'sticky', body: 'hi' }),
    })
    expect(res.status).toBe(400)
  })
})
