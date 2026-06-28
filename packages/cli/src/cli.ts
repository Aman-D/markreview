#!/usr/bin/env node
// mdreview — the CLI entry. M1 ships one command: `mdreview open <file.md>`.
// Run via tsx in M1 (a published bin is an M7 packaging concern):
//   pnpm tsx packages/cli/src/cli.ts open plan.md

import { startServer } from './start.js'

async function main(argv: string[]): Promise<void> {
  const [cmd, file, ...rest] = argv
  if (cmd !== 'open' || !file) {
    console.error('usage: mdreview open <file.md> [--port N] [--no-open]')
    process.exitCode = 1
    return
  }

  const portIdx = rest.indexOf('--port')
  const port = portIdx !== -1 ? Number(rest[portIdx + 1]) : undefined
  const noOpen = rest.includes('--no-open')

  const server = await startServer({ docPath: file, ...(port ? { port } : {}) })
  console.log(`MarkReview → ${server.url}  (Ctrl-C to stop)`)

  if (!noOpen) {
    try {
      const open = (await import('open')).default
      await open(server.url)
    } catch {
      console.log('Open the URL above in your browser.')
    }
  }
}

void main(process.argv.slice(2))
