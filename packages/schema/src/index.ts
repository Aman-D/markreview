// @markreview/schema — the single source of truth for the .review.json format.
// Pure: compiles the JSON Schema and exposes validate()/migrate(). No I/O.
//
// The canonical schema lives in spec/review.schema.json (the public protocol).
// This package imports it so runtime validation and the published spec can
// never diverge.

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import reviewSchema from '../../../spec/review.schema.json'

export { reviewSchema }

/** The format version this build of the schema targets. */
export const SPEC_VERSION = '0.2'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const compiled = ajv.compile(reviewSchema)

export interface ValidationResult {
  valid: boolean
  /** Human-readable `<path> <message>` lines; empty when valid. */
  errors: string[]
}

/** Validate an unknown value against the .review.json schema. */
export function validate(data: unknown): ValidationResult {
  const valid = compiled(data) === true
  const errors = (compiled.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`,
  )
  return { valid, errors }
}

/**
 * Forward-compatibility hook. v0.2 is current, so same-major documents pass
 * through unchanged. Real upgrade steps land as the format evolves; callers
 * should always route documents through migrate() before validate().
 */
export function migrate<T extends { specVersion?: string }>(data: T): T {
  return data
}
