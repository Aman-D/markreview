# MarkReview

Open-source, agent-agnostic review for the markdown your coding agent writes.

Your AI agent writes a plan, a spec, a PRD. It tells you to review it. Today that means
pasting it into a doc tool that mangles the formatting and hides the feedback where the
agent can't read it back. **MarkReview closes the loop:** share the exact markdown, let
anyone comment inline (no account needed), and the agent reads the comments, replies in
the thread, and ships a revised version.

Works with any agent — Claude Code, Codex, Gemini, Copilot — or with no agent at all,
just two humans reviewing a markdown file.

> Status: early, building in public. Not ready yet.

## Why

- **Inline + overall comments** on the rendered doc, anchored to the text (survives rewrites).
- **The agent argues back** — comments are a conversation, not a dead sticky note.
- **No-account share link** — send it to anyone, they just comment.
- **Open format** — everything lives in a `.review.json` file in your repo. Portable, versioned, yours.
- **Local-first** — your repo is the source of truth; hosting is optional.

## Status / roadmap

Building incrementally in public. See the milestones in [`ROADMAP`](#roadmap) (coming soon).

## License

MIT — see [LICENSE](./LICENSE).
