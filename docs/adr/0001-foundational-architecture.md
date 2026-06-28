# 0001. Foundational architecture

- Status: Accepted
- Phase: M0
- Date: 2026-06-28

## Context
Greenfield, open-source, built in public over ~30 days in 8 milestones. The format will be
public, so cross-cutting decisions are expensive to reverse once files exist in the wild and
once contributors build on them. We ran an independent architecture review before writing
code to lock the load-bearing walls now and defer everything surface-level.

## Decision
Lock the following now (full detail in `ARCHITECTURE.md` and `spec/SPEC.md`):

1. **`.review.json` is a public protocol**, not an app data file. Schema v0.2 adds stable
   `thread[].id`, `authorId`, forward-compat (`specVersion` pattern + `ext` bags),
   `revision.anchorMap` storage, `contentHash`, comment-level `createdAt`, and an
   inline-requires-anchor rule.
2. **Anchoring contract:** `resolveAnchor` returns exact | fuzzy | orphaned; precedence is
   agent anchor-map (primary) > fuzzy (fallback) > orphan floor; ambiguity → orphan.
3. **Agent I/O:** tool-neutral text prompt in, strict **ReviewPatch** out
   (patch-not-replace), validated with bounded retry. No vendor SDK in the codebase.
4. **Merge model:** set-union by stable id, append-only, last-writer-never-wins; one
   `model.merge()` reused for git conflicts and hosted sync.
5. **Structure:** pnpm monorepo; pure core (`schema, anchor, model, markdown, revision,
   agent`) vs swappable surfaces (`store-fs, service, web, cli, server, mcp`); import-lint
   enforces no-I/O-in-core; one `ReviewService` + one UI bundle reused by CLI/web/host.
6. **Stack:** TypeScript/Node ≥20, remark/mdast (source-position offsets), diff-match-patch
   (behind the anchor interface), ajv 2020-12, Vitest + fast-check + Playwright.

## Alternatives considered
- **Build the app first, formalize the format later** — rejected: a published format can't
  be quietly changed; retrofitting ids/forward-compat after files exist is a breaking change.
- **Single package, split later** — rejected: the core/surface boundary is what makes the
  "two modes (agent / no-agent), many surfaces" promise real and prevents a forked
  server-side data model at M5.
- **Line-number anchoring** — rejected: cannot survive agent rewrites; text-quote + agent
  anchor-map is the only approach that holds.
- **Renderer without source positions** — rejected: would force line-number anchoring.

## Consequences
- M0's real work is the schema + `spec/SPEC.md` + the monorepo skeleton, not feature code.
- The markdown renderer choice (remark) is effectively permanent once anchors depend on its
  offsets.
- Phase-local decisions (hosting provider, MCP transport, fuzzy threshold, UI framework)
  are explicitly deferred and will each get their own ADR when reached.
