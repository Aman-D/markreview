#!/usr/bin/env node
// validate-fixtures — compiles spec/review.schema.json and validates every
// spec/fixtures/*.json against it. Runs on every push (CI) so the published
// format and its examples can never silently drift apart.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(
  readFileSync(join(root, 'spec/review.schema.json'), 'utf8'),
)

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)

const dir = join(root, 'spec/fixtures')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

if (files.length === 0) {
  console.error('no fixtures found in spec/fixtures/')
  process.exit(1)
}

let failed = 0
for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  if (validate(data)) {
    console.log(`✓ ${f}`)
  } else {
    failed++
    console.error(`✗ ${f}`)
    for (const e of validate.errors ?? []) {
      console.error(`   ${e.instancePath || '/'} ${e.message}`)
    }
  }
}

if (failed) {
  console.error(`\n${failed} fixture(s) failed validation`)
  process.exit(1)
}
console.log(`\n${files.length} fixture(s) valid against schema`)
