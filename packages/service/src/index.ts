// @markreview/service — SURFACE. ReviewService orchestrates the pure core
// (model, markdown) and the store (store-fs) behind one API. The CLI, the web
// server, and the M5 hosted server all drive this same class, so the review
// logic is written exactly once (avoids the two-divergent-UIs trap).

import { readFileSync, existsSync } from 'node:fs'
import { render, type RenderResult } from '@markreview/markdown'
import { createReview, appendComment, type Review, type Comment } from '@markreview/model'
import { sidecarPathFor, loadReview, saveReview } from '@markreview/store-fs'

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
  range?: { start: number; end: number }
  body: string
  author?: string
}

export interface OverallCommentInput {
  body: string
  author?: string
}

export class ReviewService {
  private review: Review
  private readonly sidecar: string
  private readonly author: string
  private readonly now: () => string

  private constructor(review: Review, sidecar: string, opts: ServiceOptions) {
    this.review = review
    this.sidecar = sidecar
    this.author = opts.author ?? 'anonymous'
    this.now = opts.now ?? (() => new Date().toISOString())
  }

  /** Open a doc: load its sidecar if present, else create rev 1 and persist it. */
  static open(docPath: string, opts: ServiceOptions = {}): ReviewService {
    const sidecar = sidecarPathFor(docPath)
    let review: Review
    if (existsSync(sidecar)) {
      review = loadReview(sidecar)
    } else {
      review = createReview({ path: docPath, content: readFileSync(docPath, 'utf8') })
      saveReview(sidecar, review)
    }
    return new ReviewService(review, sidecar, opts)
  }

  getReview(): Review {
    return this.review
  }

  /** Render the current revision with source offsets for the UI. */
  render(): RenderResult {
    return render(this.currentContent())
  }

  addInlineComment(input: InlineCommentInput): Review {
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
        ...(input.range ? { range: input.range } : {}),
      },
      createdAt: this.now(),
      thread: [this.firstEntry(input.body, input.author)],
    }
    return this.commit(comment)
  }

  addOverallComment(input: OverallCommentInput): Review {
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

  private commit(comment: Comment): Review {
    this.review = appendComment(this.review, comment)
    saveReview(this.sidecar, this.review)
    return this.review
  }

  private firstEntry(body: string, author?: string) {
    return {
      id: 'r_01',
      author: author ?? this.author,
      role: 'human' as const,
      body,
      action: 'comment' as const,
      createdAt: this.now(),
    }
  }

  private nextId(): string {
    return `c_${String(this.review.comments.length + 1).padStart(2, '0')}`
  }

  private currentContent(): string {
    return this.review.revisions.find((r) => r.rev === this.review.doc.rev)?.content ?? ''
  }
}
