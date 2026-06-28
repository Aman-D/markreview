import { describe, it, expect } from 'vitest'
import { render } from './index.js'

describe('@markreview/markdown', () => {
  it('is wired into the workspace (M1 fills in rendering)', () => {
    expect(() => render('# hi')).toThrow(/M1/)
  })
})
