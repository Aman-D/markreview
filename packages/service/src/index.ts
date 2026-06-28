// @markreview/service — SURFACE. ReviewService orchestrates the pure core
// (model, markdown) and a storage port (model.ReviewStore) behind one API. The
// CLI, the web server, and the M5 hosted server all drive this same class with
// their own store adapter, so the review logic is written exactly once and the
// service itself touches no filesystem or network (avoids the two-UI trap).

import { render, type RenderResult } from '@markreview/markdown'
import { locateQuote } from '@markreview/anchor'
import {
  createReview,
  appendComment,
  type Review,
  type Comment,
  type ReviewStore,
} from '@markreview/model'

export interface ServiceOptions {
  /** Default reviewer display name. */
  author?: string
  /** Injectable clock (ISO string) for deterministic timestamps in tests. */
  now?: () => string
}

export interface InlineCommentInput {
  quote: string
  prefix?: string
  suffix?: string
  /** Offset hint (the selected block's source start) to disambiguate the quote. */
  hintStart?: number
  body: string
  author?: string
}

export interface OverallCommentInput {
  body: string
  author?: string
}

/** Highest numeric suffix among existing `c_NN` ids, or 0. */
function maxCommentCounter(comments: ReadonlyArray<Comment>): number {
  let max = 0
  for (const c of comments) {
    const m = /^c_(\d+)$/.exec(c.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

export class ReviewService {
  private review: Review
  private readonly docPath: string
  private readonly store: ReviewStore
  private readonly author: string
  private readonly now: () => string
  private counter: number

  private constructor(
    review: Review,
    docPath: string,
    store: ReviewStore,
    opts: ServiceOptions,
  ) {
    this.review = review
    this.docPath = docPath
    this.store = store
    this.author = opts.author ?? 'anonymous'
    this.now = opts.now ?? (() => new Date().toISOString())
    this.counter = maxCommentCounter(review.comments)
  }

  /** Open a doc: load its review if present, else create rev 1 and persist it. */
  static async open(
    docPath: string,
    store: ReviewStore,
    opts: ServiceOptions = {},
  ): Promise<ReviewService> {
    if (!docPath) throw new Error('ReviewService.open: docPath must not be empty')
    let review: Review
    if (await store.exists(docPath)) {
      review = await store.loadReview(docPath)
    } else {
      review = createReview({ path: docPath, content: await store.readDoc(docPath) })
      await store.saveReview(docPath, review)
    }
    return new ReviewService(review, docPath, store, opts)
  }

  getReview(): Review {
    return this.review
  }

  /** Render the current revision with source offsets for the UI. */
  render(): RenderResult {
    return render(this.currentContent())
  }

  async addInlineComment(input: InlineCommentInput): Promise<Review> {
    // Resolve the authoritative source range from the quote + context. The quote
    // is authoritative; the range is a cache. Ambiguous/absent => no range (the
    // comment is still anchored by quote). This is the live use of locateQuote.
    const located = locateQuote(this.currentContent(), {
      quote: input.quote,
      ...(input.prefix ? { prefix: input.prefix } : {}),
      ...(input.suffix ? { suffix: input.suffix } : {}),
      ...(input.hintStart !== undefined ? { hintStart: input.hintStart } : {}),
    })
    const comment: Comment = {
      id: this.nextId(),
      type: 'inline',
      rev: this.review.doc.rev,
      status: 'open',
      anchor: {
        quote: input.quote,
        anchoredRev: this.review.doc.rev,
        ...(input.prefix ? { prefix: input.prefix } : {}),
        ...(input.suffix ? { suffix: input.suffix } : {}),
        ...(located ? { range: located } : {}),
      },
      createdAt: this.now(),
      thread: [this.firstEntry(input.body, input.author)],
    }
    return this.commit(comment)
  }

  async addOverallComment(input: OverallCommentInput): Promise<Review> {
    const comment: Comment = {
      id: this.nextId(),
      type: 'overall',
      rev: this.review.doc.rev,
      status: 'open',
      createdAt: this.now(),
      thread: [this.firstEntry(input.body, input.author)],
    }
    return this.commit(comment)
  }

  private async commit(comment: Comment): Promise<Review> {
    this.review = appendComment(this.review, comment)
    await this.store.saveReview(this.docPath, this.review)
    return this.review
  }

  private firstEntry(body: string, author?: string) {
    return {
      id: `r_${String(this.counter).padStart(2, '0')}_01`,
      author: author ?? this.author,
      role: 'human' as const,
      body,
      action: 'comment' as const,
      createdAt: this.now(),
    }
  }

  private nextId(): string {
    this.counter += 1
    return `c_${String(this.counter).padStart(2, '0')}`
  }

  private currentContent(): string {
    return this.review.revisions.find((r) => r.rev === this.review.doc.rev)?.content ?? ''
  }
}
