// app.ts — the browser client. Boots from the injected bootstrap, wires
// select->comment and the overall-comment composer, and re-renders the sidebar +
// highlights from the .review.json after each change. Integration-tested by the
// Phase 7 Playwright E2E (not unit-tested).

import { resolveSelection, type SelectionResult } from './resolver.js'
import type { Bootstrap } from './index.js'
import type { Review, Comment } from '@markreview/model'

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}

function escapeHtml(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

const boot: Bootstrap = JSON.parse($('bootstrap').textContent ?? '{}')
let review: Review = boot.review

const doc = $('doc')
const list = $('comment-list')
const popover = $<HTMLDivElement>('popover')
const popInput = $<HTMLTextAreaElement>('popover-input')
let pending: SelectionResult | null = null

async function api(path: string, body?: unknown): Promise<Review> {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  const data = (await res.json()) as { review: Review }
  return data.review
}

function inlineComments(): Comment[] {
  return review.comments.filter((c) => c.type === 'inline')
}

/** Wrap the first occurrence of each inline comment's quote in a highlight. */
function renderHighlights(): void {
  doc.querySelectorAll('mark.mr-hl').forEach((m) => {
    const parent = m.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m)
      parent.normalize()
    }
  })
  for (const c of inlineComments()) {
    if (c.status === 'orphaned') continue // its text is gone/rewritten
    const quote = c.anchor?.quote
    if (quote) wrapFirst(doc, quote, c.id)
  }
}

function wrapFirst(root: HTMLElement, quote: string, id: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  while (node) {
    const idx = node.data.indexOf(quote)
    if (idx !== -1) {
      const after = node.splitText(idx)
      after.splitText(quote.length)
      const mark = document.createElement('mark')
      mark.className = 'mr-hl'
      mark.dataset.commentId = id
      mark.textContent = after.data
      after.parentNode?.replaceChild(mark, after)
      mark.addEventListener('click', () => focusComment(id))
      return
    }
    node = walker.nextNode() as Text | null
  }
}

function focusComment(id: string): void {
  document.querySelectorAll('mark.mr-hl').forEach((m) =>
    m.classList.toggle('active', (m as HTMLElement).dataset.commentId === id),
  )
  $(`comment-${id}`).scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function renderSidebar(): void {
  if (review.comments.length === 0) {
    list.innerHTML = '<div class="empty">No comments yet. Select text to add one.</div>'
    return
  }
  list.innerHTML = review.comments
    .map((c) => {
      const first = c.thread[0]
      const quote =
        c.type === 'inline' && c.anchor?.quote
          ? `<div class="quote">“${escapeHtml(c.anchor.quote)}”</div>`
          : ''
      const badge =
        c.status === 'orphaned'
          ? '<span class="badge" title="the commented text was removed or rewritten">orphaned</span>'
          : ''
      return `<div class="comment ${c.type} ${c.status}" id="comment-${c.id}">
        <div class="meta"><span class="who">${escapeHtml(first?.author ?? '')}</span>
          <span>·</span><span>${c.type}</span>${badge}</div>
        ${quote}
        <div class="body">${escapeHtml(first?.body ?? '')}</div>
      </div>`
    })
    .join('')
}

function refresh(next: Review): void {
  review = next
  renderHighlights()
  renderSidebar()
}

function hidePopover(): void {
  popover.classList.remove('open')
  popInput.value = ''
  pending = null
}

doc.addEventListener('mouseup', () => {
  const result = resolveSelection(window.getSelection())
  if (!result) return
  pending = result
  const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
  if (rect) {
    popover.style.top = `${window.scrollY + rect.bottom + 8}px`
    popover.style.left = `${window.scrollX + rect.left}px`
  }
  popover.classList.add('open')
  popInput.focus()
})

$('popover-cancel').addEventListener('click', hidePopover)

$('popover-submit').addEventListener('click', async () => {
  const body = popInput.value.trim()
  if (!body || !pending) return
  const next = await api('/api/comments', {
    type: 'inline',
    quote: pending.quote,
    prefix: pending.prefix,
    suffix: pending.suffix,
    hintStart: pending.hintStart,
    body,
  })
  hidePopover()
  refresh(next)
})

$('overall-submit').addEventListener('click', async () => {
  const input = $<HTMLTextAreaElement>('overall-input')
  const body = input.value.trim()
  if (!body) return
  const next = await api('/api/comments', { type: 'overall', body })
  input.value = ''
  refresh(next)
})

refresh(review)
