import { test, expect, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer, type RunningServer } from '@markreview/cli'

const DOC = `# Auth plan

## Sync path
We hit the DB on every request, which is fine at low scale.

## Async path
We queue writes and flush them in batches.
`

async function selectText(page: Page, quote: string) {
  await page.evaluate((q) => {
    const doc = document.getElementById('doc')!
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node) {
      const idx = node.data.indexOf(q)
      if (idx !== -1) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + q.length)
        const sel = window.getSelection()!
        sel.removeAllRanges()
        sel.addRange(range)
        doc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return
      }
      node = walker.nextNode() as Text | null
    }
    throw new Error(`quote not found: ${q}`)
  }, quote)
}

test('comment survives an edit above it, then orphans when its line is deleted', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'markreview-m2-'))
  const docPath = join(dir, 'plan.md')
  writeFileSync(docPath, DOC, 'utf8')
  let server: RunningServer = await startServer({ docPath, author: 'Aman' })

  try {
    // 1. Comment on a line.
    await page.goto(server.url)
    await selectText(page, 'We hit the DB on every request')
    await page.fill('#popover-input', 'Will this hold past 10k users?')
    await page.click('#popover-submit')
    await expect(page.locator('#doc mark.mr-hl')).toHaveCount(1)
    await server.close()

    // 2. Rewrite the doc ABOVE the quote → reopen → comment re-anchors, still highlighted.
    writeFileSync(
      docPath,
      DOC.replace('# Auth plan', '# Authentication plan (v2 — rewritten, much longer intro)'),
      'utf8',
    )
    server = await startServer({ docPath, author: 'Aman' })
    await page.goto(server.url)
    await expect(page.locator('#doc mark.mr-hl')).toHaveCount(1)
    await expect(page.locator('#doc mark.mr-hl')).toHaveText('We hit the DB on every request')
    await expect(page.locator('.comment.orphaned')).toHaveCount(0)
    await server.close()

    // 3. Delete the commented line → reopen → comment orphans gracefully.
    writeFileSync(
      docPath,
      DOC.replace(
        'We hit the DB on every request, which is fine at low scale.',
        'Caching handles all reads now.',
      ),
      'utf8',
    )
    server = await startServer({ docPath, author: 'Aman' })
    await page.goto(server.url)
    await expect(page.locator('.comment.orphaned')).toHaveCount(1)
    await expect(page.locator('#doc mark.mr-hl')).toHaveCount(0)
  } finally {
    await server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
