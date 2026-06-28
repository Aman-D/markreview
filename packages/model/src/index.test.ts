import { describe, it, expect } from 'vitest'
import { validate } from '@markreview/schema'
import { createReview, appendComment, merge, type Comment } from './index.js'

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

describe('merge', () => {
  it('is reserved for M4', () => {
    expect(() => merge(base, base)).toThrow(/M4/)
  })
})
