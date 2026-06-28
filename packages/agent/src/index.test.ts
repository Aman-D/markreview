import { describe, it, expect } from 'vitest'
import { buildPrompt, parsePatch } from './index.js'

describe('@markreview/agent', () => {
  it('is wired into the workspace (M3 fills in the agent loop)', () => {
    expect(() => buildPrompt({ doc: '', openComments: [] })).toThrow(/M3/)
    expect(() => parsePatch('{}')).toThrow(/M3/)
  })
})
