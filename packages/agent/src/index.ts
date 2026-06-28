// @markreview/agent — the ONLY package that knows agent I/O shape. Pure; no
// network, no vendor SDK (agent-agnostic by construction).
//
// M0 boundary stub. Builds a tool-neutral prompt (doc + open comments + the
// required output contract) and parses/validates the strict ReviewPatch the
// agent returns (patch-not-replace), with bounded retry. Built in M3.

export interface PromptInput {
  doc: string
  openComments: ReadonlyArray<{ id: string; body: string }>
}

/** Build a tool-neutral review prompt. Implemented in M3. */
export function buildPrompt(_input: PromptInput): string {
  throw new Error('@markreview/agent.buildPrompt: implemented in M3')
}

/** Parse + validate the agent's ReviewPatch output. Implemented in M3. */
export function parsePatch(_raw: string): unknown {
  throw new Error('@markreview/agent.parsePatch: implemented in M3')
}
