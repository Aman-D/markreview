# CLAUDE.md — MarkReview (public product repo)

This is the PUBLIC product repo. Code and audience-facing docs only. Do NOT put strategy,
competitor analysis, or post drafts here — those live in my private `build-journal` repo.

## Project context
MarkReview: open-source, agent-agnostic markdown review. Agent writes a doc → humans
comment inline (no account) → agent reads comments, replies in-thread, ships a new version.
The open `.review.json` format is the core; CLI / hosted link / MCP are surfaces over it.

## Where the plan lives
Full status, roadmap, and design are in the private `build-journal` repo under
`markreview/` (`STATUS.md`, `ROADMAP.md`, `DESIGN.md`). If that repo is available in this
environment, read `markreview/STATUS.md` there first to know the current milestone and
next action. If not, infer scope from this repo and ask.

## Architecture (locked)
- Foundational architecture: `ARCHITECTURE.md`. Format contract: `spec/SPEC.md` + `spec/review.schema.json`.
- Per-phase decisions are recorded as ADRs in `docs/adr/` (see its README for the convention).
- Read these before changing the schema, the anchoring contract, or the package layout.

## Build principles
- `.review.json` is the product — keep the schema clean, open, versioned.
- Text-range anchoring (quote + prefix/suffix), never line numbers. Agent emits an
  anchor-map when it revises; fuzzy match is the fallback; orphan gracefully.
- Agent-agnostic: emit a tool-neutral prompt + output contract. Never hardcode one agent.
- Small files, tests alongside features, ship incrementally.
