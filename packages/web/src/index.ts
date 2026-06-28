// @markreview/web — SURFACE. The comment UI: render, select->comment, sidebar.
// The selection resolver is the testable core (resolver.ts); page.ts builds the
// HTML shell; app.ts is the browser entry. Built once, reused by the M5 host.

import type { Review } from '@markreview/model'

export * from './resolver.js'

/** Data the server injects into the page and the client boots from. */
export interface Bootstrap {
  review: Review
  html: string
}
