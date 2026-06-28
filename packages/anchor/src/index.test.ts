import { describe, it, expect } from 'vitest'
import { resolveAnchor } from './index.js'

describe('@markreview/anchor', () => {
  it('is wired into the workspace (M2 fills in resolution)', () => {
    expect(() => resolveAnchor('source', { quote: 'q' })).toThrow(/M2/)
  })
})
