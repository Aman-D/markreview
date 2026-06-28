// The local hono app. Web-standard Request/Response handlers (via app.fetch), so
// the same routes port to the M5 hosted edge runtime untouched. Drives the one
// ReviewService — no review logic lives here.

import { Hono } from 'hono'
import type { ReviewService } from '@markreview/service'
import { pageHtml } from '@markreview/web/page'

interface CommentBody {
  type?: unknown
  body?: unknown
  quote?: unknown
  prefix?: unknown
  suffix?: unknown
  hintStart?: unknown
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export function createApp(service: ReviewService, clientJs: string): Hono {
  const app = new Hono()

  app.get('/', (c) =>
    c.html(
      pageHtml({
        docHtml: service.render().html,
        review: service.getReview(),
        clientJs,
      }),
    ),
  )

  app.get('/api/review', (c) =>
    c.json({ review: service.getReview(), html: service.render().html }),
  )

  app.post('/api/comments', async (c) => {
    let body: CommentBody
    try {
      body = (await c.req.json()) as CommentBody
    } catch {
      return c.json({ error: 'body must be JSON' }, 400)
    }

    const text = str(body.body)?.trim()
    if (!text) return c.json({ error: 'comment body is required' }, 400)

    if (body.type === 'inline') {
      const quote = str(body.quote)
      if (!quote) return c.json({ error: 'inline comment requires a quote' }, 400)
      const review = await service.addInlineComment({
        quote,
        body: text,
        ...(str(body.prefix) !== undefined ? { prefix: str(body.prefix) } : {}),
        ...(str(body.suffix) !== undefined ? { suffix: str(body.suffix) } : {}),
        ...(typeof body.hintStart === 'number' ? { hintStart: body.hintStart } : {}),
      })
      return c.json({ review })
    }

    if (body.type === 'overall') {
      const review = await service.addOverallComment({ body: text })
      return c.json({ review })
    }

    return c.json({ error: 'type must be "inline" or "overall"' }, 400)
  })

  return app
}
