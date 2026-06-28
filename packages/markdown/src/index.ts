// @markreview/markdown — source-position rendering. Pure; no DOM, no I/O.
//
// render() turns markdown into HTML while annotating every element with the
// character offsets it came from in the source (data-src-start/-end), via remark
// node positions. That annotation is what lets a rendered text selection map back
// to the source — risk #2 in ARCHITECTURE.md.
//
// locateQuote() is the inverse: given a quote (+ optional context), find where it
// lives in the source. It's exact in M1; the fuzzy/edit-surviving version is the
// M2 anchoring engine. The format treats the quote as authoritative, so locating
// by text (disambiguated by prefix/suffix/hint) is the robust primary path.

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/** A rendered element and the source span it came from. */
export interface SourceSpan {
  start: number
  end: number
  tag: string
}

export interface RenderResult {
  html: string
  sourceMap: SourceSpan[]
}

// Minimal hast shape we touch — AST node typing is intentionally narrow here.
interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  position?: { start?: { offset?: number }; end?: { offset?: number } }
  children?: HastNode[]
}

function walk(node: HastNode, visit: (el: HastNode) => void): void {
  if (node.type === 'element') visit(node)
  if (node.children) {
    for (const child of node.children) walk(child, visit)
  }
}

/** Render markdown to HTML plus a source map of element → source offsets. */
export function render(source: string): RenderResult {
  const sourceMap: SourceSpan[] = []

  const annotate = () => (tree: unknown): void => {
    walk(tree as HastNode, (el) => {
      const start = el.position?.start?.offset
      const end = el.position?.end?.offset
      if (typeof start === 'number' && typeof end === 'number') {
        el.properties = { ...el.properties, dataSrcStart: start, dataSrcEnd: end }
        sourceMap.push({ start, end, tag: el.tagName ?? el.type })
      }
    })
  }

  const file = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(annotate)
    .use(rehypeStringify)
    .processSync(source)

  return { html: String(file), sourceMap }
}

export interface QuoteQuery {
  quote: string
  prefix?: string
  suffix?: string
  /** Offset hint (e.g. the containing block's start) to disambiguate. */
  hintStart?: number
}

/** Locate a quote in the source. Exact match in M1; fuzzy fallback is M2. */
export function locateQuote(
  source: string,
  q: QuoteQuery,
): { start: number; end: number } | null {
  if (q.quote === '') return null

  const occurrences: number[] = []
  for (let i = source.indexOf(q.quote); i !== -1; i = source.indexOf(q.quote, i + 1)) {
    occurrences.push(i)
  }
  if (occurrences.length === 0) return null

  const score = (idx: number): number => {
    let s = 0
    if (q.prefix) {
      const before = source.slice(Math.max(0, idx - q.prefix.length), idx)
      if (before.endsWith(q.prefix)) s += 2
    }
    if (q.suffix) {
      const afterStart = idx + q.quote.length
      const after = source.slice(afterStart, afterStart + q.suffix.length)
      if (after.startsWith(q.suffix)) s += 2
    }
    if (typeof q.hintStart === 'number') {
      s += 1 / (1 + Math.abs(idx - q.hintStart))
    }
    return s
  }

  let best = occurrences[0]!
  let bestScore = score(best)
  for (const idx of occurrences.slice(1)) {
    const sc = score(idx)
    if (sc > bestScore) {
      best = idx
      bestScore = sc
    }
  }

  return { start: best, end: best + q.quote.length }
}
