# MarkReview `.review.json` — Specification (v0.2, draft)

The `.review.json` file is the product. It is an open, portable protocol: a markdown
document, its revisions, and anchored comments. The CLI, web UI, hosted link, and MCP
server are replaceable surfaces over this format. Schema: [`review.schema.json`](./review.schema.json).

## 1. File & location
- One `.review.json` per reviewed document. Lives in the repo next to the doc or under
  `.review/` (the repo is the source of truth; any host is a cache).
- Format JSON with stable key order and newline-friendly arrays so git 3-way-merges cleanly.

## 2. Versioning & forward compatibility
- `specVersion` is `"MAJOR.MINOR"`. Readers MUST accept a higher MINOR and MUST ignore
  unknown fields inside any `ext` object. Core objects are otherwise strict
  (`additionalProperties:false`) to catch typos.
- New optional data goes in an `ext` bag (present on root, `meta`, `doc`, `comment`,
  `thread[]`, `anchor`, `revision`). A MINOR bump never breaks an older reader.
- Breaking changes bump MAJOR and ship with a `migrate()` in `@markreview/schema`.

## 3. Comment state machine
- `status`: `open → resolved | wontfix | orphaned`.
- `open`: created by a human (or agent question).
- `resolved`: addressed; set by agent (with an `action:"revised"` thread entry) or human.
- `wontfix`: declined; MUST carry a thread entry with `action:"rejected"` stating why.
- `orphaned`: set by the system when the anchor can no longer be resolved (see §4). Never
  deleted; shown against the revision it was made on (`comment.rev`).
- Comments are append-only. Existing comment/thread objects are never mutated across a
  sync boundary; you append thread entries and flip `status`.

## 4. Anchoring contract (the load-bearing wall)
An inline comment's `anchor` is a text-quote selector (`quote` + `prefix`/`suffix`),
optionally with a cached character `range` and a `checksum`. Resolution against a source:

```
resolveAnchor(anchor, source) ->
  | { status: "exact",    range }
  | { status: "fuzzy",    range, confidence }   // a single unambiguous match
  | { status: "orphaned", reason }              // gone, OR ambiguous (>1 match)
```

Locked rules:
- Exact match first; fuzzy only as fallback; **ambiguity (multiple matches) → orphan,
  never guess**.
- **Precedence when applying a new revision:** agent `anchorMap` (authoritative) > fuzzy
  re-anchor (for human/external edits) > orphan floor. The agent knows what it changed, so
  its reported mapping wins. This is the PRIMARY strategy; fuzzy matching is the fallback.
- `anchor.range` is a cache only; `quote`+`prefix`+`suffix` is authoritative on conflict.

## 5. Agent invocation & output contract
- The agent is given a **tool-neutral text prompt** (doc + open comments + this contract).
  MarkReview never calls a vendor SDK; the agent is the user's, invoked by paste or (M6) MCP.
- The agent returns a strict **ReviewPatch**, never a whole new file:
  ```
  ReviewPatch = {
    newRevision?: { content | diff, contentHash? },
    anchorMap?:   { [commentId]: { action, anchor? } },
    threadReplies?: [ { commentId, body, action, appliedInRev? } ],
    statusChanges?: [ { commentId, status, reason? } ]
  }
  ```
- Patch-not-replace keeps concurrent human edits safe and merges sane. The host/CLI
  validates the patch against the schema and asks the agent to resubmit on malformed output.

## 6. Sync & merge (local ↔ hosted)
- Merge is a **set-union by stable id**: union comments by `comment.id`, union thread
  entries by `thread[].id`, append revisions by `rev`. No in-place edits cross the boundary;
  last-writer-never-wins.
- `model.merge(a, b)` is one function reused for both git conflict resolution and hosted
  sync. `pull` is idempotent and never drops a local-only comment.

## 7. Identity
- `thread[].author` is a display name; `thread[].authorId` is an opaque stable id per
  reviewer (distinguishes two "Alex"s and survives merges). The agent uses `role:"agent"`.

## 8. Integrity
- `revision.contentHash` lets a reader verify a diff materializes to the stated content and
  detect a hand-edited/corrupted sidecar. Writers SHOULD set it (and `anchor.checksum`).

See [`fixtures/`](./fixtures/) for canonical valid examples (and, later, must-fail cases).
