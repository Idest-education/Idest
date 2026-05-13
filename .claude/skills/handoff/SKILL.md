---
name: handoff
description: Create or update structured engineering handoff documents for continuing work across Claude Code sessions. Use when ending a work session, compacting context, switching chats, or preserving implementation state, architectural decisions, blockers, debugging progress, refactor status, or next steps.
---

# Session Handoff Skill

Create structured documents that enable seamless continuity across Claude
sessions.

## When to Use

- Ending a work session for the day
- Before taking a break mid-task
- Switching to a different project temporarily
- When you want to capture state for a future session
- Before a context reset you know is coming


## Workflow

Follow these phases in order.

### Phase 1 — Assess Current State

Analyze the current repository and conversation context.

Before generating the handoff:
- inspect git diff if available
- inspect modified files
- inspect TODO/FIXME comments
- inspect recent terminal output/errors if available

Determine:

- current project/module
- current engineering phase
  - planning
  - implementation
  - refactor
  - debugging
  - testing
  - deployment
  - maintenance
- active tasks
- completed tasks
- partially completed work
- blockers/issues
- unresolved architectural debates
- modified files/modules
- verification/testing status
- estimated continuation point

Identify whether the session is:
- stable and complete
- interrupted
- context-compacted
- blocked
- exploratory

If the session contains multiple unrelated workstreams:
- create/update separate handoff documents
- avoid mixing unrelated initiatives


### Phase 2 — Ask User For Important Context

Ask the user:

- Are there important decisions to preserve?
- Any constraints or preferences future sessions must follow?
- Any lessons learned, pitfalls, or failed approaches?
- Anything still uncertain or experimental?
- Any priorities for the next session?

Do NOT skip this phase.

Human context is often more important than code diffs.


### Phase 3 — Determine Handoff Target

Inspect `.claude/handoffs/`.

If a related handoff already exists for the same initiative/module/problem:
- update the existing handoff
- preserve useful historical context
- refresh status and next steps

If no related handoff exists:
- create a new handoff using:
  `.claude/handoffs/YYYY-MM-DD-brief-description.md`

Use short kebab-case descriptions.

Examples:
- `2026-05-10-auth-refactor.md`
- `2026-05-10-payment-retry-bug.md`

Avoid duplicate or redundant handoffs.


### Phase 4 — Generate Structured Handoff

Use the template at:

`.claude/handoff/assets/handoff-template.md`

Keep handoffs:
- concise
- operational
- continuation-focused
- low ambiguity

Avoid:
- long prose
- motivational language
- generic summaries
- repeating obvious repository information

Prioritize:
- actionable context
- exact continuation points
- architectural reasoning
- unresolved risks
- debugging findings
- known constraints


## Handoff Quality Rules

A good handoff allows a future Claude session to:
- continue implementation quickly
- avoid repeating failed work
- understand key decisions
- identify remaining blockers
- know what to verify next

A bad handoff:
- only summarizes activity
- lacks concrete next actions
- omits architectural reasoning
- omits failed approaches
- contains excessive prose


## Output Rules

Always:
- update/create the handoff file
- clearly state which handoff file was modified
- include timestamp/update metadata
- preserve important historical context

Never:
- overwrite useful information blindly
- create duplicate handoffs unnecessarily
- generate vague next steps
