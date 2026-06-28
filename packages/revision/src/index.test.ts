import { describe, it, expect } from 'vitest'
import { materialize } from './index.js'

describe('@markreview/revision', () => {
  it('is wired into the workspace (M4 fills in materialize)', () => {
    expect(() => materialize([{ rev: 1, content: 'x' }], 1)).toThrow(/M4/)
  })
})
