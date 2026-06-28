// Selection resolver — the browser half of the round-trip (risk #2).
//
// Given a DOM range over the rendered doc (whose elements carry data-src-start
// from @markreview/markdown), produce the data the server needs to anchor a
// comment: the exact quote, surrounding context, and a source-offset hint for
// the containing block. The server resolves the authoritative range via
// anchor.locateQuote — the quote is authoritative, this just feeds it.
//
// Pure DOM logic, no I/O — unit-tested under jsdom.

export interface SelectionResult {
  quote: string
  prefix: string
  suffix: string
  hintStart?: number
}

const CONTEXT = 32

/** Nearest ancestor element carrying a source offset. */
function enclosingBlock(node: Node | null): Element | null {
  let el: Element | null =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null)
  while (el && !el.hasAttribute('data-src-start')) {
    el = el.parentElement
  }
  return el
}

/** Resolve a DOM Range to a quote + context + block hint, or null if unusable. */
export function resolveRange(range: Range): SelectionResult | null {
  const quote = range.toString()
  if (quote.trim() === '') return null

  const block = enclosingBlock(range.startContainer)
  const blockText = block?.textContent ?? ''
  const at = blockText.indexOf(quote)

  const prefix = at >= 0 ? blockText.slice(Math.max(0, at - CONTEXT), at) : ''
  const suffix =
    at >= 0 ? blockText.slice(at + quote.length, at + quote.length + CONTEXT) : ''

  const raw = block?.getAttribute('data-src-start')
  const hintStart = raw === null || raw === undefined ? undefined : Number(raw)

  return {
    quote,
    prefix,
    suffix,
    ...(hintStart !== undefined && Number.isFinite(hintStart) ? { hintStart } : {}),
  }
}

/** Resolve the current window selection, or null if nothing usable is selected. */
export function resolveSelection(sel: Selection | null): SelectionResult | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  return resolveRange(sel.getRangeAt(0))
}
