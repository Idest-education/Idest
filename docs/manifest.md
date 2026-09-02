# Idest documentation manifest

Routing table for humans and agents. Open a row's doc when its **Read when** trigger
matches your task. Paths are repo-relative.

**Authority:** `canonical` = source of truth, keep it current · `transient` = generated
or session-scoped, may be stale.

**Maintenance:** when you add, move, or retire a doc, update its row here in the same change.

---

## Orientation — check before any non-trivial task

| Doc | Read when | Authority |
|-----|-----------|-----------|
| `CLAUDE.md` | Always — the working brief for agents in this repo | canonical |
| `README.md` | Setting up or running the stack locally | canonical |
| `docs/repo-structure.md` | Moving anything under `apps/` or `packages/`; need the full monorepo map and the list of files that hardcode paths | canonical |
| `PRODUCT.md` | Any user-facing behavior, copy, scope, or personality call | canonical |
| `DESIGN.md` | Any UI change — color, type, spacing, components, motion | canonical |

## Feature design bundles — `docs/modules/<name>/`, multi-file, open `00-README.md` first

| Bundle | Read when | Lang | Built? |
|--------|-----------|------|--------|
| `docs/modules/game/00-README.md` | Implementing the in-meeting Kahoot-style game module (NestJS + Prisma + Postgres, `/game` socket namespace) | VI | design only |
| `docs/modules/progress-tracking/00-README.md` | Implementing the progress-tracking module | VI | design only |

Each bundle is numbered `00-README` → `07-task-breakdown`: architecture, DB schema, API
contract, logic, WebSocket/integration, acceptance criteria, tasks. Read in order.

## Design specs — `docs/specs/`, one dated file each, `YYYY-MM-DD-<topic>-design.md`

The authoritative design record. Newest first.

| Spec | Subject |
|------|---------|
| `2026-09-02-security-hardening-and-repo-reorg-design.md` | Auth/JWT hardening, rate limiting, CI relocation, repo reorganization |
| `2026-06-10-game-platform-redesign.md` | Game feature → full classroom engagement platform: achievements, persistent leaderboards, new question types, teacher analytics |
| `2026-06-03-game-feature-design.md` | Kahoot-style in-meeting quiz: management dashboard, real-time sync, speed scoring, recording capture |
| `2026-05-30-pronunciation-module-design.md` | `pronunciation/` + `apps/ai` pronunciation rebuild and two-flow report |
| `2026-05-24-phase5-design.md` | Warm-orange design-system rewrite for Class, Session, Meet, Profile/Settings, Admin |
| `2026-05-23-idest-design-system.md` | Full website redesign: design system + 5-state emotional architecture across all flows |
| `2026-05-18-speaking-ui-redesign.md` | Three frontend speaking pages wired to the new grading pipeline |
| `2026-05-16-hybrid-ielts-scorer-design.md` | `apps/ai` writing-scoring pipeline (hybrid ML + LLM) |
| `2026-05-13-speaking-grading-design.md` | Speaking grading pipeline design |

## Testing

| Doc | Read when | Authority |
|-----|-----------|-----------|
| `docs/testing/smoke-test.md` | Manual pre-merge verification of auth, security, rate-limiting, and session flows | canonical |

## Reference

| Doc | Read when | Authority |
|-----|-----------|-----------|
| `docs/thesis/` | Need the KLTN thesis (`.pdf` / `.docx`) — background, not an engineering contract | reference |
| `apps/*/README.md`, `pronunciation/README.md`, `scraper/README.md` | Working inside that one package | canonical |

## Agent working files — transient, not authoritative

| Path | Notes |
|------|-------|
| `docs/superpowers/plans/` | Implementation plans from the writing-plans skill. Git-ignored (`.gitignore`). May lag the code. |
| `docs/superpowers/README.md` | Explains the plans/ vs specs/ split |
| `.claude/handoffs/` | Session handoff docs from the handoff skill |

---

## Conventions for new docs

| Kind | Location & name |
|------|-----------------|
| Design spec (single file) | `docs/specs/YYYY-MM-DD-<kebab-topic>-design.md` |
| Feature design bundle | `docs/modules/<name>/NN-<kebab-topic>.md`, entry `00-README.md` |
| Manual test procedure | `docs/testing/<kebab-topic>.md` |
| Transient implementation plan | `docs/superpowers/plans/` (skill-managed) |
| Product / design contract | repo root, `PRODUCT.md` / `DESIGN.md` (loaded from root by the `impeccable` skill) |
