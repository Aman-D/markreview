// page.ts — the HTML shell + styling. Pure string building (no I/O). The server
// renders the doc, serializes the bootstrap data, and injects the bundled client.

import type { Review } from '@markreview/model'

export interface PageData {
  docHtml: string
  review: Review
  /** The bundled browser client JS (esbuild output from the server). */
  clientJs: string
}

const STYLES = `
:root {
  --bg: #fbfbfa; --panel: #ffffff; --ink: #1f2328; --muted: #656d76;
  --line: #e4e6ea; --accent: #4f46e5; --hl: #fff3bf; --hl-line: #f1c40f;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
header {
  display: flex; align-items: baseline; gap: 12px;
  padding: 14px 24px; border-bottom: 1px solid var(--line);
  background: var(--panel); position: sticky; top: 0; z-index: 5;
}
header .brand { font-weight: 700; letter-spacing: -0.01em; }
header .brand span { color: var(--accent); }
header .doc-title { color: var(--muted); font-size: 14px; }
.layout { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 0; align-items: start; }
#doc {
  padding: 36px 48px; max-width: 760px; margin: 0 auto;
}
#doc h1 { font-size: 1.7rem; margin: 0 0 .6em; letter-spacing: -0.02em; }
#doc h2 { font-size: 1.25rem; margin: 1.6em 0 .5em; }
#doc p { margin: 0 0 1em; }
#doc code { background: #f3f4f6; padding: .1em .35em; border-radius: 4px; font-size: .9em; }
#doc pre { background: #f3f4f6; padding: 14px; border-radius: 8px; overflow: auto; }
#doc mark.mr-hl {
  background: var(--hl); border-bottom: 2px solid var(--hl-line);
  border-radius: 2px; padding: 0 1px; cursor: pointer;
}
#doc mark.mr-hl.active { background: #ffe08a; }
aside {
  position: sticky; top: 57px; height: calc(100vh - 57px); overflow-y: auto;
  border-left: 1px solid var(--line); background: var(--panel); padding: 20px;
}
aside h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 12px; }
.composer textarea, .popover textarea {
  width: 100%; min-height: 64px; resize: vertical; padding: 9px 11px;
  border: 1px solid var(--line); border-radius: 8px; font: inherit; background: #fff;
}
.composer { margin-bottom: 22px; }
.btn {
  margin-top: 8px; padding: 7px 14px; border: 0; border-radius: 8px;
  background: var(--accent); color: #fff; font-weight: 600; cursor: pointer;
}
.btn.secondary { background: #eef0f3; color: var(--ink); }
.btn:disabled { opacity: .5; cursor: default; }
.comment {
  border: 1px solid var(--line); border-radius: 10px; padding: 12px 13px; margin-bottom: 12px;
}
.comment.inline { border-left: 3px solid var(--hl-line); }
.comment.overall { border-left: 3px solid var(--accent); }
.comment.orphaned { opacity: .65; border-left-color: #d0d5dd; }
.badge {
  margin-left: auto; background: #fde2e1; color: #b42318;
  border-radius: 6px; padding: 1px 7px; font-size: 11px; font-weight: 600;
}
.comment .meta { font-size: 12px; color: var(--muted); margin-bottom: 5px; display: flex; gap: 6px; }
.comment .meta .who { color: var(--ink); font-weight: 600; }
.comment .quote {
  font-size: 12.5px; color: var(--muted); background: #faf8e8;
  border-radius: 6px; padding: 5px 8px; margin: 0 0 7px; border-left: 2px solid var(--hl-line);
}
.comment .body { white-space: pre-wrap; }
.empty { color: var(--muted); font-size: 13px; font-style: italic; }
.popover {
  position: absolute; z-index: 20; width: 280px; background: var(--panel);
  border: 1px solid var(--line); border-radius: 10px; padding: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,.12); display: none;
}
.popover.open { display: block; }
.popover .row { display: flex; gap: 8px; margin-top: 8px; }
`

function escapeJson(s: string): string {
  // Safe to embed in a <script> tag.
  return s.replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e')
}

export function pageHtml(d: PageData): string {
  const title = d.review.doc.title ?? d.review.doc.path
  const bootstrap = escapeJson(JSON.stringify({ review: d.review, html: d.docHtml }))
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — MarkReview</title>
<style>${STYLES}</style>
</head>
<body>
<header>
  <div class="brand">Mark<span>Review</span></div>
  <div class="doc-title">${title}</div>
</header>
<div class="layout">
  <article id="doc">${d.docHtml}</article>
  <aside>
    <div class="composer">
      <h3>Overall comment</h3>
      <textarea id="overall-input" placeholder="A comment on the whole document…"></textarea>
      <button class="btn" id="overall-submit">Add overall comment</button>
    </div>
    <h3>Comments</h3>
    <div id="comment-list"></div>
  </aside>
</div>
<div class="popover" id="popover">
  <div style="font-size:12px;color:#656d76">Comment on selection</div>
  <textarea id="popover-input" placeholder="What about this?"></textarea>
  <div class="row">
    <button class="btn" id="popover-submit">Comment</button>
    <button class="btn secondary" id="popover-cancel">Cancel</button>
  </div>
</div>
<script id="bootstrap" type="application/json">${bootstrap}</script>
<script type="module">${d.clientJs}</script>
</body>
</html>`
}
