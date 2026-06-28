import { describe, it, expect } from 'vitest'
import { emptyReview, merge } from './index.js'

describe('@markreview/model', () => {
  it('creates an empty review at the locked spec version', () => {
    const r = emptyReview()
    expect(r.specVersion).toBe('0.2')
    expect(r.comments).toEqual([])
  })

  it('merge is reserved for M4', () => {
    expect(() => merge(emptyReview(), emptyReview())).toThrow(/M4/)
  })
})
