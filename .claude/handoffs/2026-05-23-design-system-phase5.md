# Idest Design System — Phase 5 (Class / Meeting / Profile / Admin)

Last Updated: 2026-05-23 23:00
Status: active
Phase: implementation

# Objective

Continue the Idest warm orange design system rewrite into the remaining product surfaces: class pages, meeting/live-session pages, profile/settings pages, and admin pages. Phases 1–4 are fully committed on `main`.


# Current State

Phases 1–4 complete and committed (22 commits ahead of origin/main, not yet pushed).

## Completed

- **Phase 1 — Foundation:** Font loading (Oswald/Plus Jakarta Sans/JetBrains Mono), LoadingScreen (spinning cat icon), Navbar warm palette, FocusNav (slim h-11 bar on test routes), LandingRoot full rewrite.
- **Phase 2 — Dashboard:** `/assignment` browse page + AssignmentCard. Ghost index number (Oswald numeral, 7% opacity) replaces per-skill cat images on cards. Hover floods card with skill-accent gradient (135°), all text turns white.
- **Phase 3 — Test-taking:** ProcessingScreen (breathing orb + typewriter), WordCountBar, AnswerOption, CustomAudioPlayer. All 4 test pages (Reading/Writing/Listening/Speaking) redesigned. Speaking uses 3-column layout (prompts | uploads | sidebar).
- **Phase 4 — Results + Auth:** ScoreReveal (count-up + confetti), RevelationHeader (animated stripe + floating cat + ScoreReveal). Writing/Speaking result pages use full RevelationHeader. Reading/Listening result pages use compact warm score card (ScoreReveal inline). Auth forms (login + sign-up) are dark Arrival state (#0b0b0b page, #151515 card, warm dark inputs, orange CTA).

## Not Started

- Class pages (live lesson browsing, class detail)
- Meeting/live-session UI (video call, in-session overlay)
- Profile / settings pages
- Admin pages


# Key Decisions

- **Warm orange palette only in product UI.** No cool colors (blue, teal, purple, gray) anywhere in product surfaces. `--color-brand: #FF6B35`, surface tokens from DESIGN.md.
- **Dark surfaces only for hero/landing and auth Arrival state.** Product UI remains warm off-white (`--color-surface-app: #fffaf5`).
- **Reading/Listening result pages keep split layout** (passage left, results right) — do not restructure to single column. ScoreReveal is embedded in the right panel, not a full-width header.
- **Writing/Speaking result pages use full-width RevelationHeader** because they're single-column scrollable.
- **AssignmentCard hover pattern** (gradient flood + white text) was explicitly requested and should be a template for other interactive card surfaces.
- **FocusNav route regex:** `/^\/assignment\/(reading|listening|writing|speaking)\/[^/]+$/` — check if class/meeting routes need FocusNav too.

# Constraints / Rules

- **Absolute bans (enforced per DESIGN.md + impeccable skill):**
  - No side-stripe borders (`border-left`/`border-right` > 1px as colored accent) — use full borders, background tints, or leading numerals instead
  - No gradient text (`background-clip: text` + gradient)
  - No glassmorphism decoratively
  - No identical card grids (vary density/accent)
  - No emoji in body copy or labels
- **Impeccable skill** (`/impeccable`) is the design authority — load it before any design work.
- **FocusNav** hides Navbar on test routes. If class/meeting pages are immersive, consider a similar FocusNav variant.
- **Skill accent colors** (for cards/badges): reading `#FF6B35`, listening `#fbbf24`, writing `#dc2626`, speaking `#f59e0b`. Admin/profile surfaces don't have a skill, use `--color-brand` directly.
- CSS vars must be used instead of Tailwind color classes for anything touching the brand palette, to avoid dark mode interference.


# Files / Modules Involved

Key new components created this session — reference these as patterns:

- `components/processing-screen.tsx` — breathing orb + typewriter, dark bg, floating cat
- `components/score-reveal.tsx` — count-up with cubic easeOut, confetti on complete
- `components/revelation-header.tsx` — animated stripe + warm gradient header + ScoreReveal
- `components/assignment/assignment-card.tsx` — ghost index, gradient hover flood
- `components/assignment/word-count-bar.tsx` — progress bar, turns green at target
- `components/assignment/answer-option.tsx` — MCQ with spring bounce
- `components/assignment/custom-audio-player.tsx` — play/pause, clickable gradient bar, replay counter

Routes to redesign next:
- `app/(protected)/class/` — class browsing
- `app/(protected)/meet/` — live video session (Navbar already hidden on `/meet` routes per DESIGN.md)
- `app/(protected)/profile/` or `app/(protected)/settings/` — profile/settings
- Admin routes (if they exist)


# Known Issues / Blockers

- **Not pushed to origin** — 22 commits on local `main` need `git push` before deploy.
- **Subagent layout risk** — when subagents are dispatched for layout-heavy pages (especially flex/grid full-viewport layouts), they may collapse to centered narrow column. Always specify exact layout structure in the implementer prompt, and verify the result visually after.
- The `.claude/skills/aesthetics/` files are deleted in the working tree (7 deleted files shown in git status at session start) — unrelated to design work but worth noting.


# Failed Approaches / Lessons Learned

- **Subagents broke the Speaking 3-column layout.** Subagent changed `flex w-full h-[calc(100vh-44px)] overflow-hidden` to `min-h-screen flex flex-col items-center justify-start py-10 px-6 max-w-2xl mx-auto`, collapsing the layout. Fixed by explicitly providing the exact outer wrapper structure in the prompt.
- **Side-stripe `border-left` creep** — when first redesigning AssignmentCard, a `w-1` left accent bar div was added (violates the ban). Caught before commit. Watch for this pattern especially on list items, callouts, and card variants.
- **Blue indigo gradients in result pages** — all 4 result pages had `from-blue-500 to-indigo-600` score cards. All replaced this session. If new pages have similar score cards, start warm from scratch.


# Verification Status

## Verified

- TypeScript: `npx tsc --noEmit` — clean (0 errors) after Phase 4 commit
- Phases 1–4 committed and lintable

## Not Verified

- Visual browser test of Phase 4 (result pages + auth forms) — not run this session
- Mobile responsiveness of result pages
- Phase 5 targets (class/meeting/profile/admin) — not yet inspected


# Recommended Next Steps

1. Inspect the class, meeting, profile, and admin route files to understand current UI patterns and identify cool colors / anti-patterns.
2. Run `/impeccable` to load design context, then use `/impeccable craft` to plan each surface before implementing.
3. For class browsing pages: apply the same card pattern as AssignmentCard (ghost index, gradient hover) if cards are used.
4. For meeting/live-session: check if FocusNav should show — DESIGN.md says Navbar disappears on `/meet` routes, so a FocusNav may be appropriate.
5. For profile/settings: warm surface-card layout, orange active states, no cool colors in form fields.
6. After each page: run `npx tsc --noEmit` to verify TypeScript is clean.
7. Push to origin when ready: `git push origin main`.


# Session Resume Prompt

Continue the Idest design system rewrite (Phases 1–4 done, all committed on main).

Phase 5 targets: class pages, meeting/live-session pages, profile/settings, and admin pages.

Start by reading the existing files for each target route, then use /impeccable craft to design and implement each surface in warm orange — no cool colors, no side-stripe borders, no gradient text, no identical card grids.

Key reference files: DESIGN.md (palette + anti-patterns), components/revelation-header.tsx and components/score-reveal.tsx (result page patterns), components/assignment/assignment-card.tsx (card hover pattern).


# Notes For Future Claude Sessions

- Memory file `project-design-system-progress.md` tracks phase completion — update it after each phase.
- The impeccable skill at `.claude/skills/impeccable/` is the design authority — always invoke it before design work.
- `--font-display` (Oswald 700) for headers/scores, `--font-body` (Plus Jakarta Sans) for labels/descriptions, `--font-mono` (JetBrains Mono) for timers/numeric counters.
- Subagent layout verification: after any subagent edits a page with a flex/grid full-viewport layout, read the file and confirm the outer wrapper is correct before committing.
- The 22 uncommitted-to-origin commits are all clean — just needs a `git push`.
