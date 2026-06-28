# 0002. M1 — storage port, anchoring placement, and boundary hardening
- Status: Accepted
- Phase: M1
- Date: 2026-06-29

## Context
M1 built the headless backbone (markdown render, model, store-fs, ReviewService). A
code + architecture review flagged decisions that are cheap to fix at stub stage but
expensive once M2 (anchoring) and M5 (hosted server) build on them. This ADR records
what we changed now and what we deliberately deferred, so each is an owned decision.

## Decision
1. **Storage is a port.** `ReviewService` no longer imports `node:fs` or `store-fs`.
   It depends on a pure `ReviewStore` interface (defined in `@markreview/model`,
   keyed by `docPath`, methods sync-or-async). `@markreview/store-fs` provides
   `fsReviewStore`; the M5 host will provide a datastore adapter. This makes the
   "one service for cli/web/host" promise real instead of aspirational.
2. **Anchoring lives in `@markreview/anchor`.** `locateQuote` moved out of
   `@markreview/markdown` (which now only renders). It **orphans on ambiguity**
   (returns `null` when the best match is not unique) — honoring the locked
   contract "ambiguity → orphan, never guess."
3. **`ResolveOutcome` is three-tier** again: `exact | fuzzy(+confidence) | orphan`,
   matching locked contract #2 before M2 implements it.
4. **Comment ids are monotonic from the persisted max** (`maxCommentCounter`), not
   array length, so reopening/deleting can't reissue an id.
5. **`import-lint` fails closed**: layer is read from each `package.json`
   `markreview.layer` (untagged ⇒ core), core built-ins are an allowlist
   (`crypto`, `util`, `path`), and global I/O (`fetch`, `process`, `eval`, …) is
   scanned — so core can't reach the network without an import either.
6. **Hardened I/O error handling** in store-fs/service: unique temp filename +
   cleanup-on-failure for atomic writes, JSON-parse guard, `docPath` validation
   and missing-doc errors (also closes a latent M5 path-traversal read).

## Alternatives considered
- *Keep `ReviewService` on `node:fs`, refactor at M5* — rejected: forces a service
  + host rewrite exactly when two code paths already exist (the divergence risk).
- *Port interface in `service` or a new `store-api` package* — rejected: creates a
  surface→surface dependency; the domain package owning its persistence port is the
  standard hexagonal placement and adds no new dependency edges.
- *uuid comment ids now* — deferred (see below); readable `c_NN` is nicer for the
  format/demo and the monotonic fix removes the immediate collision risk.

## Consequences
- `ReviewService.open` / `addComment` are now async (await the store). CLI/web await.
- Deferred, tracked here so they're owned, not forgotten:
  - **json-schema-to-typescript** (locked in ADR-0001 stack) is still not wired;
    `model` hand-declares the format types. Risk is compile-time drift only
    (runtime is validated). **Wire it before M3** adds agent/anchorMap fields.
  - **Globally-unique ids (uuid / author-prefixed)** for true merge survival —
    **do at M4** when `model.merge()` lands; `c_NN` is single-writer-only until then.
  - **Schema package publishing**: `@markreview/schema` imports `../../../spec`
    (outside the package) and ships raw `.ts`. Fine internally; **before publishing
    `@markreview/schema` (M5/M6)** add a build that bundles the schema JSON.
