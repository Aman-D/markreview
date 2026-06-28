// Boot a local MarkReview server for a doc: open the review, bundle the client,
// serve. Returned programmatically so the E2E (and the CLI bin) both use it.

import { serve } from '@hono/node-server'
import { ReviewService } from '@markreview/service'
import { fsReviewStore, gitAuthor } from '@markreview/store-fs'
import { createApp } from './server.js'
import { bundleClient } from './bundle.js'

export interface StartOptions {
  docPath: string
  /** 0 (default) lets the OS pick a free port. */
  port?: number
  author?: string
  now?: () => string
}

export interface RunningServer {
  url: string
  port: number
  close: () => Promise<void>
}

export async function startServer(o: StartOptions): Promise<RunningServer> {
  const service = await ReviewService.open(o.docPath, fsReviewStore, {
    author: o.author ?? gitAuthor(),
    ...(o.now ? { now: o.now } : {}),
  })
  const clientJs = await bundleClient()
  const app = createApp(service, clientJs)

  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: o.port ?? 0 }, (info) => {
      resolve({
        url: `http://localhost:${info.port}`,
        port: info.port,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}
