// @markreview/markdown — source-position rendering. Pure; no DOM, no I/O.
//
// M0 boundary stub. Renders markdown to HTML while preserving a source map so a
// rendered selection maps back to exact character offsets in the source (remark
// offsets — non-negotiable per ARCHITECTURE.md). Built in M1.

export interface RenderResult {
  html: string
  /** Maps rendered offsets back to source character offsets. */
  sourceMap: ReadonlyArray<{ renderedStart: number; sourceStart: number }>
}

/** Render markdown with a source map. Implemented in M1. */
export function render(_source: string): RenderResult {
  throw new Error('@markreview/markdown.render: implemented in M1')
}
