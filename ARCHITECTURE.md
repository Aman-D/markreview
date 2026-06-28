# Architecture

How MarkReview is structured and why. Foundational decisions are locked here; phase-local
decisions are recorded as ADRs in [`docs/adr/`](./docs/adr/).

> **Governance — whole now, details per phase.** The cross-cutting decisions below (the
> `.review.json` contract, the anchoring engine, agent-agnostic invocation, the
> local↔hosted merge model, the package boundary, the tech stack) are locked *now*, before
> code, because they are expensive to reverse and they shape every milestone. Decisions
> that are local to one milestone (hosting provider, MCP transport, fuzzy threshold, UI
> framework) are deliberately deferred and captured as a dated ADR when reached. See the
> decide-now vs defer table below.

## Core principle
`.review.json` is a **wire format and public protocol**, not an app data file (see
[`spec/SPEC.md`](./spec/SPEC.md)). The format + the four contracts are the load-bearing
walls. The CLI, web UI, host, and MCP server are replaceable surfaces. Get the contracts
right; surfaces can be rewritten cheaply.

## Components

**Pure core (no filesystem, network, or DOM — fully testable, embeddable):**

| Package | Responsibility |
|---|---|
| `@markreview/schema` | JSON Schema + generated types + `validate()` + `migrate()`. Single source of truth for the format. |
| `@markreview/anchor` | `createAnchor` / `resolveAnchor`. Quote+context, fuzzy fallback, ambiguity→orphan. Pure. |
| `@markreview/model` | The `Review` aggregate: append comment/reply, add revision, apply agent anchor-map, state-machine, `merge()`. Immutable. Owns invariants. |
| `@markreview/markdown` | Source-position render: `render(source) → {html, sourceMap}`, DOM-range ↔ source-range. Isolates the hidden complexity. |
| `@markreview/revision` | Revision storage policy (rev1 full + diffs), `materialize`, `diff`. |
| `@markreview/agent` | Tool-neutral prompt builder + ReviewPatch parser/validator + retry. The ONLY place that knows agent I/O. No vendor SDK. |

**Surfaces (I/O, swappable):**

| Package | Responsibility | Milestone |
|---|---|---|
| `@markreview/store-fs` | Read/write the sidecar + sibling revisions, git identity, atomic writes. | M1 |
| `@markreview/service` | `ReviewService` — orchestrates core+store. One impl reused by cli/web/host. | M1 |
| `@markreview/web` | The comment UI (render, select→comment, sidebar). Built once, reused by the host. | M1 |
| `@markreview/cli` (`mdreview`) | `open`, `agent-prompt`, `ingest`, `push`, `pull`. Thin. | M1+ |
| `@markreview/server` | Hosted share links, no-account commenting, expiry, sync. | M5 |
| `@markreview/mcp` | MCP server: `request_review` / `get_comments`. | M6 |

**Enforced boundaries (import-lint in CI):** core packages import no I/O. `web` and
`server` both talk to the same `ReviewService` so the UI is built once (avoids the #1
duplication trap — two divergent UIs). All agent-specific logic stays in `@markreview/agent`.

## The four locked contracts
1. **`.review.json` schema** — see `spec/`. Locked v0.2 additions: stable `thread[].id`,
   `authorId`, forward-compat (`specVersion` pattern + `ext` bags), `revision.anchorMap`
   storage, `contentHash`, comment-level `createdAt`, inline-requires-anchor.
2. **Anchoring** — the `resolveAnchor` three-tier outcome and the precedence ladder
   (agent anchor-map > fuzzy > orphan). Heuristics/threshold are deferred.
3. **Agent I/O** — tool-neutral prompt in, strict **ReviewPatch** out (patch-not-replace),
   validate + bounded retry. Prompt wording is deferred (it's data, not contract).
4. **Merge** — set-union by stable id, append-only, last-writer-never-wins; one
   `model.merge()` reused for git conflicts and hosted sync. Transport/auth deferred to M5.

## Tech stack (boring, proven)
TypeScript on Node ≥20 · pnpm workspaces monorepo · **remark/mdast** (source-position
offsets — non-negotiable) · **diff-match-patch** for fuzzy anchoring (behind the
`@markreview/anchor` interface) · **ajv** (2020-12) + `json-schema-to-typescript` ·
**hono** or Node `http` for the local server (hono handlers port to the M5 host) ·
**jsdiff** for revision diffs · **Vitest** + **fast-check** (property tests for anchoring)
+ **Playwright** (comment-flow E2E) · `@modelcontextprotocol/sdk` (M6). No DB in M1–M4
(git is the database). No vendor AI SDKs anywhere.

## Decide-now vs defer

| Decide NOW (M0) | Defer to |
|---|---|
| Full schema + the four contracts | — |
| Monorepo + core/surface boundary + import rules | — |
| TS + Node + remark (renderer offsets are ~permanent once anchors depend on them) | — |
| Patch-not-replace + stable-id append-only | — |
| Web UI runtime, selection lib | M1 |
| Fuzzy threshold, dmp-vs-token matcher | M2 |
| Prompt wording, per-agent few-shots, retry count | M3 |
| Diff vs snapshot policy, revision GC | M4 |
| Transport, datastore, auth, E2EE, expiry, deploy | M5 |
| MCP tool schemas, stdio vs SSE | M6 |
| Mermaid, syntax highlight, UI framework, landing | M7 |

## Top risks (de-risk early)
1. **Anchoring across agent rewrites** — lock agent-anchor-map as PRIMARY (M0 schema),
   build the precedence ladder + property tests in M2 before M3.
2. **Rendered-selection → source-offset** — remark offsets (M0); round-trip test harness (M1).
3. **Agent output validity in the live demo** — strict patch + retry (M3); deterministic
   replay mode for a reproducible GIF.
4. **Two-UI divergence (M1 local vs M5 host)** — single `ReviewService` + one UI bundle.
5. **Schema forward-compat lock-in** — `specVersion` pattern + `ext` + `migrate()` (M0).
6. **Git-merge of concurrent reviews** — append-only, stable ids, merge-by-union; test by M4.
7. **Agent-agnostic in name only** — Claude AND Codex as a CI/manual gate (M3).
8. **Revision bloat** — diffs + `contentHash` from M4 (fields reserved in M0).

## Repo layout
See `spec/` (the public protocol: schema + SPEC + fixtures) and `packages/` (core + surfaces).
`server/` and `mcp/` are reserved boundaries, built at M5/M6.
