import { describe, it, expect } from 'vitest'
import { validate } from '@markreview/schema'
import { createReview, appendComment, reanchor, reanchorAll, merge, type Comment } from './index.js'

const base = createReview({
  path: 'plan.md',
  title: 'Plan',
  content: '# Plan\n\nWe hit the DB on every request.\n',
})

const inline: Comment = {
  id: 'c_01',
  type: 'inline',
  rev: 1,
  status: 'open',
  anchor: { quote: 'We hit the DB on every request', anchoredRev: 1 },
  thread: [
    { id: 'r_01', author: 'Aman', role: 'human', body: 'Scale?', action: 'comment' },
  ],
}

describe('createReview', () => {
  it('produces a schema-valid rev-1 review', () => {
    expect(base.doc.rev).toBe(1)
    expect(base.revisions[0]?.content).toContain('# Plan')
    expect(validate(base).errors).toEqual([])
  })
})

describe('appendComment', () => {
  it('appends immutably and stays schema-valid', () => {
    const next = appendComment(base, inline)
    expect(next).not.toBe(base)
    expect(base.comments).toHaveLength(0) // original untouched
    expect(next.comments).toHaveLength(1)
    expect(validate(next).errors).toEqual([])
  })

  it('appends an overall (anchorless) comment', () => {
    const overall: Comment = {
      id: 'c_02',
      type: 'overall',
      rev: 1,
      status: 'open',
      thread: [
        { id: 'r_02', author: 'Aman', role: 'human', body: 'LGTM', action: 'comment' },
      ],
    }
    expect(validate(appendComment(base, overall)).errors).toEqual([])
  })

  it('rejects an inline comment without an anchor', () => {
    const bad: Comment = { ...inline, anchor: undefined }
    expect(() => appendComment(base, bad)).toThrow(/anchor/)
  })

  it('rejects a duplicate comment id', () => {
    const once = appendComment(base, inline)
    expect(() => appendComment(once, inline)).toThrow(/duplicate/)
  })
})

describe('reanchor', () => {
  const SRC = '# Plan\n\nWe hit the DB on every request.\n'
  const start = SRC.indexOf('We hit the DB on every request')
  const comment: Comment = {
    id: 'c_01',
    type: 'inline',
    rev: 1,
    status: 'open',
    anchor: {
      quote: 'We hit the DB on every request',
      prefix: '\n',
      suffix: '.',
      range: { start, end: start + 30 },
      anchoredRev: 1,
    },
    thread: [{ id: 'r_01', author: 'Aman', role: 'human', body: 'scale?' }],
  }

  it('refreshes the range (keeps status) after an edit above the quote', () => {
    const edited = SRC.replace('# Plan', '# Plan (revised, much longer heading)')
    const out = reanchor(comment, edited, 2)
    expect(out.status).toBe('open')
    expect(out.anchor?.anchoredRev).toBe(2)
    expect(edited.slice(out.anchor!.range!.start, out.anchor!.range!.end)).toBe(
      comment.anchor!.quote,
    )
  })

  it('orphans the comment when the quote is gone (keeps the old anchor)', () => {
    const edited = SRC.replace('We hit the DB on every request.', 'Cache handles reads.')
    const out = reanchor(comment, edited, 2)
    expect(out.status).toBe('orphaned')
    expect(out.anchor?.quote).toBe(comment.anchor?.quote) // anchor preserved
  })

  it('leaves non-open and overall comments untouched', () => {
    const resolved: Comment = { ...comment, status: 'resolved' }
    expect(reanchor(resolved, 'totally different', 2)).toBe(resolved)
    const overall: Comment = { ...comment, type: 'overall', anchor: undefined }
    expect(reanchor(overall, 'whatever', 2)).toBe(overall)
  })

  it('reanchorAll maps over comments immutably', () => {
    const list = [comment]
    const out = reanchorAll(list, SRC, 1)
    expect(out).toHaveLength(1)
    expect(list[0]?.anchor?.anchoredRev).toBe(1) // input untouched
  })
})

describe('merge', () => {
  it('is reserved for M4', () => {
    expect(() => merge(base, base)).toThrow(/M4/)
  })
})
