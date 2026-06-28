import { test, expect } from '@playwright/test'
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

let server: RunningServer
let dir: string

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'markreview-e2e-'))
  const docPath = join(dir, 'plan.md')
  writeFileSync(docPath, DOC, 'utf8')
  server = await startServer({ docPath, author: 'Aman' })
})

test.afterAll(async () => {
  await server.close()
  rmSync(dir, { recursive: true, force: true })
})

/** Select an exact text span inside #doc and fire the mouseup the app listens for. */
async function selectText(page: import('@playwright/test').Page, quote: string) {
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
    throw new Error(`quote not found in #doc: ${q}`)
  }, quote)
}

test('highlight → inline comment → overall comment → reload persists', async ({ page }) => {
  await page.goto(server.url)
  await expect(page.locator('#comment-list .empty')).toBeVisible()

  // Inline comment via text selection.
  await selectText(page, 'We hit the DB on every request')
  await expect(page.locator('#popover')).toHaveClass(/open/)
  await page.fill('#popover-input', 'Will this hold past 10k users?')
  await page.click('#popover-submit')

  await expect(page.locator('#comment-list .comment.inline')).toHaveCount(1)
  await expect(page.locator('#doc mark.mr-hl')).toHaveCount(1)
  await expect(page.locator('#doc mark.mr-hl')).toHaveText('We hit the DB on every request')

  // Overall comment via the sidebar composer.
  await page.fill('#overall-input', 'Add a rate-limiting section before we ship.')
  await page.click('#overall-submit')
  await expect(page.locator('#comment-list .comment.overall')).toHaveCount(1)

  // The acceptance test: reload and assert both comments + the highlight persist.
  await page.reload()
  await expect(page.locator('#comment-list .comment')).toHaveCount(2)
  await expect(page.locator('#doc mark.mr-hl')).toHaveCount(1)
  await expect(page.locator('#comment-list .comment.inline .quote')).toContainText(
    'We hit the DB on every request',
  )
})
