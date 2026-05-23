# Design

## Color Palette

Strategy: **Committed** — warm orange carries the identity across all product surfaces. Only green (correct/success) is allowed off the warm axis.

| Token | Value | Role |
|---|---|---|
| `--color-brand` | `#FF6B35` | Primary orange — CTAs, active states, accent |
| `--color-brand-hover` | `#ff8a55` | Hover state for brand elements |
| `--color-surface-app` | `#fffaf5` | Page background (warm off-white) |
| `--color-surface-card` | `#ffffff` | Card / panel background |
| `--color-surface-subtle` | `#fff4ed` | Subtle tint — active tab bg, tag bg |
| `--color-surface-muted` | `#f0ede8` | Muted surface — dividers, skeleton |
| `--color-border-default` | `#ffe8d6` | Default border — nav bottom, card borders |
| `--color-border-subtle` | `#e0dbd4` | Subtle border — FocusNav, kbd hints |
| `--color-text-primary` | `#1a0a00` | Main body text |
| `--color-text-secondary` | `#6b3a1f` | Nav links, secondary labels |
| `--color-text-muted` | `#9a7060` | Metadata, hints, muted captions |
| `--color-correct` | `#22c55e` | Correct answer — only non-warm color |
| `--color-error` | `#dc2626` | Error / wrong answer |

Dark landing surfaces (hero sections only, not product UI):
- Background: `#0b0b0b`, Surface: `#151515`, Border: `#2a2a2a`

No cool colors (blue, teal, purple, gray) anywhere in the product UI.

## Typography

| Token | Font | Weights | Role |
|---|---|---|---|
| `--font-display` | Oswald | 700 | Headers, hero text, skill names, score numbers. Vietnamese-safe. |
| `--font-body` | Plus Jakarta Sans | 400–800 | Body text, labels, descriptions, buttons |
| `--font-mono` | JetBrains Mono | 700 | Timers, band scores, numeric counters |

Line length cap: 65ch on body copy. Hierarchy by scale + weight contrast (≥1.25× between steps).

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Burst, spring-in — celebratory moments only |
| `--ease-smooth` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Default transitions |
| `--ease-snap` | `cubic-bezier(0.55, 0, 1, 0.45)` | Dismiss, exit |
| `--dur-fast` | `150ms` | Hover, focus |
| `--dur-normal` | `250ms` | Slide-up, fade-in |
| `--dur-slow` | `400ms` | Page transitions |
| `--dur-reveal` | `600ms` | Score reveal |

Named animations: `float` (mascot hover), `breathe` (processing orb), `timer-pulse` (countdown urgency), `burst` (correct answer), `slide-up` (card entrance), `spin-slow` (loading cat icon), `stripe-flow` (divider accent).

No CSS layout property animation. No bounce, no elastic outside of deliberate `spring-in` celebration.

## Border Radius

- `4px` — inline chips, small badges
- `8px` — default: input fields, small buttons
- `12px` — medium cards
- `16px` — large cards, panels
- `24px` — hero sections, full-bleed cards
- `9999px` (rounded-full) — nav links, pill badges

## Components

### Navbar
Sticky, `h-14`, white card background, warm border-bottom. Active links: brand color + subtle tint, rounded-full pill. Logo is the horizontal `logo.png`. Disappears on `/meet` routes, replaced by FocusNav on test routes.

### FocusNav
Slim `h-11` bar for test-taking. `logo-icon.png` (20×20) + skill label in uppercase muted text. Keyboard hints (Tab / Space) on md+ screens.

### LoadingScreen
Full-screen warm off-white. `logo-icon.png` (52×52) spinning at `spin-slow`. "Đang tải..." in muted body text.

### AssignmentCard
Warm card with `--color-border-default` border. No cool-color per-skill tints. No dark gradient hover overlays. Cat mascot image per skill displayed prominently.

## Assets

| File | Use |
|---|---|
| `logo.png` | Horizontal logo with wordmark — navbar, footer |
| `logo-icon.png` | Cat ear icon — loading screen, FocusNav, favicon |
| `assignment-reading.png` | Orange reading cat |
| `assignment-listening.png` | Orange listening cat |
| `assignment-writing.png` | Orange writing cat |
| `assignment-speaking.png` | Orange speaking cat |
| `cat-peeps.webm` | Video loop — landing hero background |

## Anti-patterns (enforced)

- No gradient text (`background-clip: text`) anywhere
- No cool colors (blue, teal, purple, emerald) in product UI
- No dark gradient card overlays on hover
- No emoji in body copy or labels
- No side-stripe borders as decorative accents
- No identical card grids (cards may share structure but must vary in density or accent)
