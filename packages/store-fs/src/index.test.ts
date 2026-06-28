import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createReview, appendComment, type Comment } from '@markreview/model'
import { sidecarPathFor, sidecarExists, loadReview, saveReview } from './index.js'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'markreview-store-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('sidecarPathFor', () => {
  it('maps a doc path to its sibling .review.json', () => {
    expect(sidecarPathFor('plan.md')).toBe('plan.review.json')
    expect(sidecarPathFor(join('docs', 'auth.md'))).toBe(
      join('docs', 'auth.review.json'),
    )
  })
})

describe('save/load round-trip', () => {
  const review = appendComment(
    createReview({ path: 'plan.md', content: '# Plan\n\nbody text\n' }),
    {
      id: 'c_01',
      type: 'inline',
      rev: 1,
      status: 'open',
      anchor: { quote: 'body text', anchoredRev: 1 },
      thread: [{ id: 'r_01', author: 'Aman', role: 'human', body: 'why?' }],
    } satisfies Comment,
  )

  it('writes then reads back identical data', () => {
    const path = join(dir, 'plan.review.json')
    expect(sidecarExists(join(dir, 'plan.md'))).toBe(false)
    saveReview(path, review)
    expect(loadReview(path)).toEqual(review)
  })

  it('leaves no temp file behind (atomic write)', () => {
    const path = join(dir, 'plan.review.json')
    saveReview(path, review)
    expect(readdirSync(dir)).toEqual(['plan.review.json'])
  })

  it('throws a clear error on an invalid sidecar', () => {
    const path = join(dir, 'bad.review.json')
    writeFileSync(path, JSON.stringify({ specVersion: '0.2' }), 'utf8')
    expect(() => loadReview(path)).toThrow(/invalid \.review\.json/)
  })
})
