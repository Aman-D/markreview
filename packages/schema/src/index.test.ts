import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validate, migrate, SPEC_VERSION, reviewSchema } from './index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(here, '../../../spec/fixtures/minimal.review.json')
const minimal = JSON.parse(readFileSync(fixturePath, 'utf8'))

describe('@markreview/schema', () => {
  it('exposes the locked spec version', () => {
    expect(SPEC_VERSION).toBe('0.2')
    expect((reviewSchema as { title: string }).title).toMatch(/review\.json/)
  })

  it('accepts the hand-written minimal fixture', () => {
    const result = validate(minimal)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('rejects a document missing a required field', () => {
    const { doc: _omitted, ...broken } = minimal
    const result = validate(broken)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/doc/)
  })

  it('rejects an inline comment without an anchor (conditional rule)', () => {
    const broken = structuredClone(minimal)
    delete broken.comments[0].anchor
    const result = validate(broken)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/anchor/)
  })

  it('migrate() passes a current-version document through unchanged', () => {
    expect(migrate(minimal)).toEqual(minimal)
  })
})
