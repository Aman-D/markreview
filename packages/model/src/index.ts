// @markreview/model — the Review aggregate. Pure, immutable, append-only.
//
// Owns the format's invariants so no surface can construct an invalid review:
// inline comments must be anchored, comment ids are unique, every comment has a
// thread. Importing sibling core packages (@markreview/anchor, @markreview/schema)
// is allowed; importing a surface or any I/O builtin is not (see import-lint).
//
// M1 builds createReview + appendComment. add-revision, the agent anchor-map, and
// merge() arrive in M3/M4.

import { resolveAnchor, type Anchor } from '@markreview/anchor'
import { SPEC_VERSION } from '@markreview/schema'

export type Role = 'human' | 'agent'
export type CommentType = 'inline' | 'overall'
export type CommentStatus = 'open' | 'resolved' | 'wontfix' | 'orphaned'
export type ThreadAction = 'comment' | 'revised' | 'rejected' | 'asked'

export interface ThreadEntry {
  id: string
  author: string
  authorId?: string
  role: Role
  body: string
  action?: ThreadAction
  appliedInRev?: number
  createdAt?: string
}

export interface Comment {
  id: string
  type: CommentType
  rev: number
  status: CommentStatus
  anchor?: Anchor
  createdAt?: string
  thread: ThreadEntry[]
}

export interface Revision {
  rev: number
  content?: string
  createdAt?: string
}

export interface Doc {
  path: string
  title?: string
  rev: number
}

export interface Review {
  specVersion: string
  doc: Doc
  revisions: Revision[]
  comments: Comment[]
}

/**
 * Persistence port (hexagonal). A pure interface — no I/O here. Implementations
 * are surfaces: @markreview/store-fs (local sidecar) today, the M5 hosted store
 * later. Keyed by docPath so an adapter can map it to a sidecar path or a record
 * id. Methods may be sync or async so the same ReviewService drives both a local
 * filesystem (sync) and a remote datastore (async).
 */
export interface ReviewStore {
  exists(docPath: string): boolean | Promise<boolean>
  loadReview(docPath: string): Review | Promise<Review>
  saveReview(docPath: string, review: Review): void | Promise<void>
  readDoc(docPath: string): string | Promise<string>
}

export interface CreateReviewParams {
  path: string
  content: string
  title?: string
  createdAt?: string
}

/** Build a fresh, schema-valid review with the document as revision 1. */
export function createReview(p: CreateReviewParams): Review {
  return {
    specVersion: SPEC_VERSION,
    doc: { path: p.path, rev: 1, ...(p.title ? { title: p.title } : {}) },
    revisions: [
      { rev: 1, content: p.content, ...(p.createdAt ? { createdAt: p.createdAt } : {}) },
    ],
    comments: [],
  }
}

/**
 * Append a comment, returning a NEW review (the input is never mutated).
 * Enforces the invariants: inline-requires-anchor, non-empty thread, unique id.
 */
export function appendComment(review: Review, comment: Comment): Review {
  if (comment.type === 'inline' && !comment.anchor) {
    throw new Error(`inline comment "${comment.id}" requires an anchor`)
  }
  if (comment.thread.length === 0) {
    throw new Error(`comment "${comment.id}" requires at least one thread entry`)
  }
  if (review.comments.some((c) => c.id === comment.id)) {
    throw new Error(`duplicate comment id: ${comment.id}`)
  }
  return { ...review, comments: [...review.comments, comment] }
}

/**
 * Re-anchor a single comment onto a new version of the source. Pure, immutable
 * (returns a NEW comment). Owns the `status → orphaned` invariant.
 *   - exact/fuzzy  → keep status, refresh anchor.range + anchoredRev, keep quote
 *   - orphan       → status: 'orphaned', anchor left intact (still shown vs comment.rev)
 * Only open inline comments are re-anchored; others are returned untouched.
 *
 * M3 will consult revision.anchorMap (the PRIMARY rung) above this fuzzy fallback.
 */
export function reanchor(comment: Comment, newSource: string, currentRev: number): Comment {
  if (comment.type !== 'inline' || !comment.anchor || comment.status !== 'open') {
    return comment
  }
  const outcome = resolveAnchor(newSource, comment.anchor)
  if (outcome.kind === 'orphan') {
    return { ...comment, status: 'orphaned' }
  }
  return {
    ...comment,
    anchor: {
      ...comment.anchor,
      range: { start: outcome.start, end: outcome.end },
      anchoredRev: currentRev,
    },
  }
}

/** Re-anchor every comment onto a new source (immutable). */
export function reanchorAll(
  comments: ReadonlyArray<Comment>,
  newSource: string,
  currentRev: number,
): Comment[] {
  return comments.map((c) => reanchor(c, newSource, currentRev))
}

/** Merge two reviews by stable id (append-only). Implemented in M4. */
export function merge(_a: Review, _b: Review): Review {
  throw new Error('@markreview/model.merge: implemented in M4')
}
