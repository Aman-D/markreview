# Architecture Decision Records (ADRs)

How we record decisions over a phased build. The **foundational** architecture is locked
once, in [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md). Every **phase-local** decision
(one that ARCHITECTURE.md deliberately deferred) gets a short, dated ADR here when we reach
it. This is the per-phase governance.

## When to write an ADR
Write one when you make a decision that:
- a future contributor would otherwise have to reverse-engineer, or
- closes off an alternative that was reasonable (e.g. "REST not gRPC for sync"), or
- ARCHITECTURE.md lists as "defer to M_x".

Don't write one for trivial or easily-reversible choices.

## Convention
- File: `NNNN-short-title.md` (zero-padded, incrementing).
- Each ADR names the **phase/milestone** it belongs to (M0–M7).
- Status: `Proposed → Accepted → Superseded by NNNN`.
- Keep it to one screen: context, decision, alternatives, consequences.

## Template
```markdown
# NNNN. <title>
- Status: Accepted
- Phase: M_x
- Date: YYYY-MM-DD

## Context
<the forces; why a decision is needed now>

## Decision
<what we chose>

## Alternatives considered
<what we rejected and why>

## Consequences
<trade-offs, what this locks in, follow-ups>
```

## Index
- [0001 — Foundational architecture](./0001-foundational-architecture.md) (M0)
- [0002 — M1: storage port, anchoring placement, boundary hardening](./0002-m1-boundaries-and-storage-port.md) (M1)
