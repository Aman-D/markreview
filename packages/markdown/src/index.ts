// @markreview/markdown — source-position rendering. Pure; no DOM, no I/O.
//
// render() turns markdown into HTML while annotating every element with the
// character offsets it came from in the source (data-src-start/-end), via remark
// node positions. That annotation is what lets a rendered text selection map back
// to the source — risk #2 in ARCHITECTURE.md.
//
// Quote→source-offset location lives in @markreview/anchor (locateQuote), not
// here: anchoring is the anchor package's job; this package only renders.

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
