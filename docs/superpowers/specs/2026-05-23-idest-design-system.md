# Idest Design System — Full Website Redesign Spec

**Date:** 2026-05-23  
**Scope:** Entire website — landing page, dashboard, all 4 test-taking flows (Reading, Listening, Writing, Speaking), all 4 result pages, auth pages, navigation  
**Approach:** Full design system (Approach B) + 5-state emotional architecture (Approach C)  
**Target audience:** Young Vietnamese IELTS learners (Gen Z)  
**Language:** Vietnamese throughout, Gen Z casual tone, no emoji

---

## 1. Design Tokens

### 1.1 Color — Orange Warm Palette

All colors are warm-toned (red, orange, yellow). No cool colors (blue, purple, grey-blue) anywhere in the product.

#### Primary Orange Scale
| Token | Hex | Usage |
|---|---|---|
| `orange-50` | `#fff4ed` | Subtle fills, hover backgrounds |
| `orange-100` | `#ffe8d6` | Borders, dividers |
| `orange-200` | `#ffd0b5` | Inactive state fills |
| `orange-300` | `#ffb088` | Secondary borders, processing state accents |
| `orange-400` | `#ff8a55` | Hover states |
| `orange-500` | `#FF6B35` | **Brand primary** — buttons, active states, links |
| `orange-600` | `#e5531a` | Coherence rubric, pressed states |
| `orange-700` | `#c43d0f` | Lexical rubric, destructive accents |
| `orange-800` | `#9c2d08` | Grammar rubric, dark emphasis |
| `orange-900` | `#7a2005` | Darkest warm accent |

#### App Interior Surfaces (Light)
| Token | Hex | Usage |
|---|---|---|
| `surface-app` | `#fffaf5` | App-wide background |
| `surface-card` | `#ffffff` | Cards, panels |
| `surface-subtle` | `#fff4ed` | Instruction blocks, info panels |
| `surface-muted` | `#f0ede8` | Inactive tabs, code backgrounds |
| `border-default` | `#ffe8d6` | Card borders |
| `border-subtle` | `#e0dbd4` | Focus state inner borders |

#### Dark Landing Surfaces
| Token | Hex | Usage |
|---|---|---|
| `dark-bg` | `#0b0b0b` | Landing page background |
| `dark-surface` | `#151515` | Raised cards on landing |
| `dark-raised` | `#1e1e1e` | Tooltips, dropdowns on dark |
| `dark-border` | `#2a2a2a` | Borders on dark |
| `dark-warm-bg` | `#0d0905` | Processing state background |
| `dark-warm-surface` | `#1e0c04` | Processing state cards |
| `dark-warm-border` | `#3d1800` | Processing state borders |

#### Text Scale (on light)
| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#1a0a00` | Headings, body text — warm dark brown |
| `text-secondary` | `#6b3a1f` | Subheadings, labels |
| `text-muted` | `#9a7060` | Captions, placeholders |
| `text-brand` | `#FF6B35` | Links, labels, accents |
| `text-on-dark` | `#ffffff` | Primary text on dark surfaces |
| `text-on-dark-muted` | `#9a8880` | Secondary text on dark |

#### Semantic Colors
| Token | Hex | Usage |
|---|---|---|
| `correct` | `#22c55e` | Correct answers, auto-save indicator — **only exception to the warm-tones-only rule; required for universal "correct" affordance** |
| `correct-bg` | `#f0fdf4` | Correct answer cell background |
| `correct-border` | `#86efac` | Correct answer cell border |
| `error` | `#dc2626` | Timer warning, error states |

### 1.2 Typography

#### Font Stack
| Role | Font | Weight | Usage |
|---|---|---|---|
| Display | **Oswald** | 700 | Hero headlines, band scores, section names in test UI, result numbers |
| UI & Body | **Plus Jakarta Sans** | 400–900 | All interface copy, passage text, questions, buttons, labels |
| Monospace | **JetBrains Mono** | 700 | Timers, scores in-flight, word counts |

> **Why Oswald over Anton:** Anton lacks Vietnamese diacritics support — tonal marks break. Oswald 700 has the same condensed bold energy with full Vietnamese Unicode support.

#### Type Scale
| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display XL | `clamp(52px, 8vw, 96px)` | Oswald 700 | 0.95 | Landing hero headline |
| Display L | `clamp(32px, 4vw, 48px)` | Oswald 700 | 1.05 | Section headlines |
| Display M | `22–28px` | Oswald 700 | 1.05 | Page titles, score numbers in-line |
| Heading 1 | `22px` | Plus Jakarta Sans 800 | 1.3 | App page titles |
| Heading 2 | `17px` | Plus Jakarta Sans 700 | 1.4 | Card headers, section labels |
| Label | `14px` | Plus Jakarta Sans 600 | 1.4 | Question numbers, field labels |
| Body | `13–15px` | Plus Jakarta Sans 400–500 | 1.8–1.9 | Passage text, paragraph copy |
| Caption | `11px` | Plus Jakarta Sans 500 | 1.6 | Word counts, timestamps, helper text |
| Eyebrow | `10–11px` | Plus Jakarta Sans 800 | 1 | Section category labels, ALL CAPS, 2px letter-spacing |

### 1.3 Motion Language

Five named curves — each used in specific contexts only:

| Curve | Value | Usage |
|---|---|---|
| **Spring** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Answer selection, button press, card hover lift, score number landing |
| **Smooth** | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Panel slides, page transitions, tab switches |
| **Snap** | `cubic-bezier(0.55, 0, 1, 0.45)` | Dismiss, exit, toast disappear |
| **Breathe** | `linear, 2.5s, alternate infinite` | Processing orb, loading indicators |
| **Burst** | Spring + 50ms child stagger | Score reveal, rubric card fan-in, confetti |

Duration tokens: `fast: 150ms`, `normal: 250ms`, `slow: 400ms`, `reveal: 600ms`

### 1.4 Spacing

4px base unit: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px`

### 1.5 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | `4px` | Tags, chips |
| `radius-sm` | `8px` | Inputs, badges, answer cells |
| `radius-md` | `12px` | Buttons, question cards |
| `radius-lg` | `16px` | Cards, panels |
| `radius-xl` | `20–24px` | Modals, skill cards on landing |
| `radius-full` | `9999px` | Pills, avatars, skill tab buttons |

---

## 2. Five Emotional States

The UI does not stay uniform. It shifts visual register at each stage of the user journey. This is the core of the product's personality.

### State 1 — Arrival (Landing Page)
- **Surface:** `dark-bg` (#0b0b0b)
- **Character:** Cinematic, bold, one decision. Dark with orange glow from laptop video.
- **Type:** Oswald for headline, Plus Jakarta Sans for sub-copy
- **Orange role:** Primary — headline color, CTA button, radial glow
- **Cat role:** cat-peeps.webm video background (already implemented)

### State 2 — Discovery (Dashboard, /assignment)
- **Surface:** `surface-app` (#fffaf5)
- **Character:** Warm, organised, energising. Like opening a well-kept notebook.
- **Orange role:** Active skill tab, card accent borders, brand elements
- **Cat role:** Hero image that switches per active skill tab (reading/listening/writing/speaking cat)
- **Greeting:** Time-aware — "Sang som roi Ken, on bai luon di!" / "Toi roi ne, luyen them mot bai nua nhe?"

### State 3 — Focus (Test-taking, /assignment/[type]/[id])
- **Surface:** `#fafaf9` (barely warm off-white — not bright white, softer on eyes)
- **Character:** Near-silent. UI retreats. Maximum reading comfort.
- **Orange role:** Timer only, selected answer, active question dot — nowhere else
- **No:** Shadows, gradients, decorative elements
- **Nav:** Collapses to slim bar — logo-icon + section label + timer only
- **Type size:** Passage text bumped to 15px, 1.8–1.9 line-height
- **Cat role:** Skill-matched cat icon at 18px, 35% opacity, top-right of tab bar — disappears during active reading, reappears on hover

### State 4 — Processing (AI grading wait, post-submit)
- **Surface:** `dark-warm-bg` (#0d0905)
- **Character:** Warm dark, anticipatory, alive. Feels like AI genuinely thinking.
- **Visual:** Breathing orb with `radial-gradient(#dc2626, #FF6B35, #fbbf24)`, Breathe animation (2.5s)
- **Cat role:** Skill-matched cat (e.g. writing cat for writing submission) floats above the orb with Float animation
- **Typewriter text** cycles through Vietnamese messages:
  1. "Dang doc tung cau cua ban..."
  2. "Kiem tra Task Achievement..."
  3. "Xem mach lac co on khong..."
  4. "Danh gia Lexical Resource..."
  5. "Kiem tra ngu phap..."
- **No fake progress bar** — honest mystery is better than false certainty
- **Estimated wait shown:** "Thuong mat khoang 15–30 giay"

### State 5 — Revelation (Results, /assignment/[type]/[id]/result/[id])
- **Surface:** `linear-gradient(160deg, #fff4ed, #ffe8d6)` header, `white` body
- **Character:** Orange floods back. Earned, celebratory, clear.
- **Top stripe:** `linear-gradient(90deg, #dc2626, #FF6B35, #fbbf24, #FF6B35, #dc2626)` animated 3s
- **Score animation:** Counts up from 0 using Burst easing, 600ms — lands with Spring bounce
- **Rubric cards:** Stagger in at 50ms intervals after score lands
- **Confetti:** 8–12 particles in `#FF6B35`, `#fbbf24`, `#dc2626` burst from score number on land
- **Cat role:** Skill-matched cat floats above score number (Float animation, 3s)
- **Essay highlights:** Glow in on scroll using IntersectionObserver
- **CTAs always visible:** "Luyen them" (outline) + primary action ("Xem loi sai" / "Xem dap an")

---

## 3. Landing Page (/  — unauthenticated)

### Structure (scrollable, 5 sections)

#### Section 1 — Hero (full viewport, dark)
- Background: `#0b0b0b` + `cat-peeps.webm` video (already exists)
- Radial orange glow: `radial-gradient(ellipse 900px 600px at 50% 80%, rgba(255,107,53,0.2), transparent)`
- Subtle grid texture: `1px rgba(255,107,53,0.03)` lines at 48px
- **Nav:** Fixed, transparent → frosted glass on scroll (`rgba(11,11,11,0.85)` + `backdrop-filter:blur(16px)`)
  - Left: `logo.png`
  - Center: Live clock in Oswald (already implemented — keep)
  - Right: "Dang nhap" button (orange, 12px rounded)
- **Tag badge:** "AI CHAM BAI · GIAO VIEN THAT · IELTS CHUAN" — pill with orange pulsing dot
- **Headline:** Oswald 700, `clamp(52px, 8vw, 96px)`, line1 orange / line2 white
  - Line 1: `HOC TIENG ANH` (orange)
  - Line 2: `CUNG IDEST NHE?` (white)
- **Subhead:** Plus Jakarta Sans 500, 15px, `rgba(255,255,255,0.5)`, max-width 480px
- **CTAs:**
  - Primary: "DI HOC LUON!" — `#FF6B35` button, Oswald 700 16px, shadow glow
  - Ghost: "Tao da co tai khoan →" — muted white, hover to full white
- **Scroll indicator:** "CUON XUONG" + animated line (fade in/out loop)

#### Transition — Warm Stripe
- 6px height stripe: `linear-gradient(90deg, #dc2626, #FF6B35, #fbbf24, ...)` animated

#### Section 2 — Skills (warm light, `#fffaf5`)
- Eyebrow: "4 KY NANG · 1 NEN TANG"
- Headline: Oswald, "Luyen het, khong sot ky nang nao"
- 4 skill cards in a grid:
  - Each card: white bg, `#ffe8d6` border, 20px radius
  - On hover: lift (-6px), shadow `rgba(255,107,53,0.12)`, orange left-to-right top bar slides in
  - Cat image: 96px, bounces up 4px on card hover
  - Name: Oswald 22px
  - Badge: "Writing · AI Grading", "Speaking · AI Feedback" etc.

#### Section 3 — How It Works (dark warm, `#1a0a00`)
- 3 steps in a row with warm gradient connector line
- Each step: numbered orange circle, cat illustration, Oswald title, description
- Step cats: reading cat → writing cat → speaking cat

#### Section 4 — Stats (`#fffaf5`)
- 4 numbers in Oswald orange: `4` skills, `30s` AI result, `100+` exercises, `9.0` target
- No fake testimonials — honest numbers only

#### Section 5 — Final CTA (dark, `#0b0b0b`)
- Listening cat floating above
- Oswald headline: "Con doi gi nua? Hoc luon di!"
- Subtext: "Mien phi dang ky · Khong can the tin dung · Bat dau trong 60 giay"
- Orange radial glow from bottom

#### Footer
- Logo left, links center, copyright right
- All on `#050505`

---

## 4. Dashboard / Assignment Browse (/assignment)

- Background: `surface-app` (#fffaf5)
- **Greeting header:** Time-aware Vietnamese Gen Z copy (see copy table in §7)
- **Streak display:** "Streak X ngay" — small pill, warm orange, top-right
- **Skill tabs:** 4 pills — "Doc", "Nghe", "Viet", "Noi" — active pill is solid orange, inactive is `orange-50` with `orange-100` border
- **Hero image:** Switches to skill-matched cat on tab change (already implemented — keep, enhance animation)
- **Assignment cards:**
  - Band target shown as a range badge, not stars
  - Thin orange left-border on recently attempted cards
  - Duration shown in minutes
- **Empty state:** Cat looking to the side, warm illustration, copy: "Khu nay trong troi — thu tab khac xem?"
- **Search:** Orange focus ring, X button to clear

---

## 5. Test-Taking UIs (Focus State)

### Shared rules across all 4 skills

- **Nav:** Collapses to slim top bar — logo-icon (18px) + section label + timer only
- **Background:** `#fafaf9`
- **Orange appears only on:** timer, selected answer, active question dot number, word count bar fill
- **No:** shadows, gradients, decorative elements, full nav
- **Borders:** 1px solid `#e0dbd4` — flat, no depth
- **Passage/prompt text:** 15px, `#3d3530`, 1.9 line-height
- **Cat icon:** Skill-matched, 18px, `opacity: 0.35`, top-right of tab bar — Ghost mode in Focus state
- **Keyboard hints:** Shown in top bar — `Tab` next question, `Space` select, `←→` switch passage
- **Timer states:**
  - Normal: `#FF6B35`
  - Under 10 min: `#FF6B35` + slightly heavier weight
  - Under 5 min: `#dc2626` + `timer-pulse` animation (1s opacity)
  - Toast at 10 min: "Con 10 phut — rao len nao!"
  - Toast at 5 min: "5 phut cuoi roi do!!"

### Reading (/assignment/reading/[id])
- **Layout:** Left — passage with passage tabs (Doan A/B/C) | Right — questions (42%) | Right edge — question dot navigator sidebar
- **Passage tabs:** Active tab has orange `border-bottom: 2px`, others muted
- **Highlight:** Passage text uses `<mark>` on key phrases (amber tint, no border)
- **Answer options:** Spring bounce on select, fill orange, letter badge inverts to white
- **Q dot navigator:** 20px squares, states: default (border only) → answered (orange-50 fill) → active (solid orange)
- **Next passage:** Only shown when all questions in current passage are answered

### Listening (/assignment/listening/[id])
- **Layout:** Sticky custom audio player top | Left — instructions + stimulus | Right — questions | Sidebar — dots
- **Audio player:** Custom (no browser native `<audio>`), shows: play/pause orange circle, section label, waveform-style progress bar, timestamp, "Nghe lai (N)" replay counter
- **Section tabs:** Recording 1/2/3/4 — same tab style as Reading passages
- **Fill-in-blank inputs:** Orange border + `orange-50` bg when active, plain border when empty

### Writing (/assignment/writing/[id])
- **Layout:** Left — prompt + stimulus image | Right — textarea + word count
- **Task switcher:** Pills in top bar center — "Task 1" / "Task 2" — orange = active
- **Textarea:** `#fffaf5` background, 1px border, no resize handle, 15px Plus Jakarta Sans, 1.9 line-height
- **Word count bar:**
  - 0 → target: gradient `#FF6B35 → #fbbf24`
  - At target: switches to `#22c55e` (green) with a subtle pulse
  - Shows: `247 / 250 tu toi thieu` in monospace
- **Auto-save:** Small green dot + "Da luu tu dong" — pulses when saving
- **Validation:** On submit, incomplete task shows toast: "O khoan — Task 2 chua viet xong kia!"

### Speaking (/assignment/speaking/[id])
- **Layout:** Centered, immersive — no split panel
- **Prompt card:** `orange-50` background, `orange-300` border, 12px radius
- **Pre-recording:** 3-2-1 countdown overlay before recording starts
- **Recording:** Animated waveform (9 bars, varying heights, orange) + square stop button (not mic icon — clearer)
- **Timer arc:** Shrinking circular arc around record button (CSS conic-gradient)
- **Post-recording:** "Nghe lai" button appears before submit — user can re-record
- **Cat:** Speaking cat visible at 36px with Float animation + encouraging copy tip during recording

---

## 6. Result Pages (Revelation State)

### Shared structure
All result pages share:
1. **Revelation header** — warm gradient `linear-gradient(160deg, #fff4ed, #ffe8d6)`, 4px animated stripe top, confetti dots, skill-matched cat floating above score, score counts up (Burst), comment line
2. **Action bar** — "Chia se ket qua" ghost + "Luyen them" outline + primary CTA

### Writing Result (/assignment/writing/[id]/result/[submissionId])
- Task 1 / Task 2 tabs (score shown in tab label)
- **4 rubric cards** stagger in at 50ms intervals:
  - Task Achievement: `orange-500`
  - Coherence: `orange-600`
  - Lexical Resource: `orange-700`
  - Grammar: `orange-800`
- **Highlighted essay:** 4 warm underline colors per rubric, click to activate feedback panel
- **Feedback panel:** `orange-50` bg, shows flaws (red-prefix `—`) and improvements (green-prefix `+`) and rewrite example
- **Overlap handling:** If multiple rubrics flag same text, click cycles between them

### Reading Result (/assignment/reading/[id]/result/[submissionId])
- Score: `X/40` with band equivalent shown
- Section accuracy bars (one per passage, warm gradient)
- **Answer grid:** 5-column grid of answer cells
  - Correct: `#f0fdf4` bg, green border, answer in green
  - Wrong: `orange-50` bg, `orange-300` border, user's answer in orange, correct answer struck through below
  - Skipped: `#f0ede8` bg
- **Wrong answer explanations:** Expandable, orange left-border cards, quote the relevant passage line

### Listening Result (/assignment/listening/[id]/result/[submissionId])
- Score: `X/40` with band equivalent
- **4-section breakdown bars** using the 4 orange-red scale steps (500→800)
- Coaching note highlights weakest section

### Speaking Result (/assignment/speaking/[id]/result/[submissionId])
- Band score (Oswald 72px orange)
- **4 criteria cards** (Fluency & Coherence, Lexical Resource, Grammatical Range, Pronunciation) with mini fill bars
- **Highlighted transcript** — two highlight types:
  - Pronunciation errors: orange dotted underline (`border-bottom: 2px dotted #FF6B35`)
  - Fluency/grammar issues: red dotted underline (`border-bottom: 2px dotted #e5531a`)
- Click on highlight → feedback popover

---

## 7. Micro-copy — Vietnamese Gen Z (no emoji)

> **Note on diacritics:** Copy examples below are written without Vietnamese tonal marks for ASCII compatibility in this file. All copy must be implemented with full Vietnamese Unicode diacritics (e.g. "Ơ khoan" not "O khoan", "Xịn số" not "Xin so"). Refer to the visual mockups in `.superpowers/brainstorm/` for the canonical Vietnamese text.

| Moment | Old copy | New copy |
|---|---|---|
| Validation error on submit | "Ban phai hoan thanh tat ca nhiem vu truoc khi nop bai." | "O khoan — Task 2 chua viet xong kia!" |
| Submit success | "Gui bai thanh cong" | "Nop bai xong roi! AI dang cham ne." |
| Timer — 10 min remaining | (no warning) | "Con 10 phut — rao len nao!" |
| Timer — 5 min remaining | (no warning) | "5 phut cuoi roi do!!" |
| Timer — expired | (no message) | "Het gio roi! Bai van duoc nop nha." |
| Empty state | "Chua co bai tap nao" | "Khu nay trong troi — thu tab khac xem?" |
| Score 7.0+ | "Band 7.0" | "Xin so! Band 7.0 roi day." |
| Score 5.0–5.5 | "Band 5.5" | "Van con duong de len — doc nhan xet nha!" |
| Dashboard greeting (morning) | "Xin chao" | "Sang som roi Ken, on bai luon di!" |
| Dashboard greeting (evening) | "Xin chao" | "Toi roi ne Ken, luyen them mot bai nua nhe?" |
| AI processing | "Dang xu ly..." | Typewriter cycling: "Dang doc tung cau cua ban..." → "Kiem tra Task Achievement..." → "Xem mach lac co on khong..." |
| Streak reminder | (none) | "Streak X ngay — gioi lam! Dung de mat chuoi nhe." |
| Login error | "Sai mat khau" | "Mat khau sai roi — thu lai nhe?" |
| Network error | "Loi ket noi" | "Mat mang roi — kiem tra wifi va thu lai nha." |

---

## 8. Mascot Integration Rules

The orange cat mascot has 5 poses (existing assets):
- `assignment-reading.png` — cat reading a book
- `assignment-listening.png` — cat with headphones
- `assignment-writing.png` — cat holding paper
- `assignment-speaking.png` — cat holding microphone
- `cat-peeps.webm` — cat peeking (landing video)
- `logo-icon.png` — cat ear silhouette (favicon/loading)

### Where cat appears prominently (64–100px, animated)
- Landing: cat-peeps.webm video background
- Test start screen: skill-matched cat, 72px, Float animation
- Processing state: skill-matched cat above orb, Float animation
- Result page: skill-matched cat above score number, Float animation
- Empty states: cat at 80px, static

### Where cat appears as ghost (16–20px, low opacity)
- Focus state: skill-matched cat icon, 18px, opacity 35%, top-right of tab bar
- Loading screen: `logo-icon.png` spinning (replaces current generic spinner)
- Nav bar collapsed (mobile): logo-icon only

### Where cat does NOT appear
- Inside passage text
- Adjacent to active question
- Inside the writing textarea
- On rubric detail feedback panels
- Rule: Focus state = cat sleeps, does not distract

---

## 9. Component Library (Key Components)

### Button variants
- **Primary:** `#FF6B35` bg, white text, Oswald 700 or Plus Jakarta Sans 800, 12px radius, Spring hover scale
- **Outline:** white bg, `#FF6B35` border+text, same radius
- **Ghost:** transparent, muted text, hover to `text-primary`
- **Danger:** `#dc2626` bg (timer expired, exit confirmation only)

### Answer Option (Reading/Listening)
- Default: white bg, `#e0dbd4` border, `opt-letter` badge in muted
- Hover: `orange-50` bg, `orange-300` border
- Selected: `#FF6B35` bg, white text, opt-letter inverts — Spring bounce animation on select

### Fill-in-blank Input
- Active: `orange-50` bg, `orange-300` border, orange caret
- Filled: `orange-50` bg, `orange-100` border
- Empty: `#f0ede8` bg, `#e0dbd4` border

### Question Dot Navigator
- Default: white bg, `#e0dbd4` border, muted number
- Answered: `orange-50` bg, `orange-300` border, orange number
- Active: `#FF6B35` bg, white number, 4px radius

### Custom Audio Player
- Play/pause: orange circle button, triangle/square icon
- Progress: orange gradient fill bar
- Timestamp: JetBrains Mono
- Replay counter: decrements, greys out at 0

### Word Count Bar
- 0% → target: `linear-gradient(#FF6B35, #fbbf24)`
- At target: switches to `#22c55e` with subtle scale pulse
- Count shown in JetBrains Mono

### Processing Orb
- Gradient: `radial-gradient(circle, rgba(255,107,53,0.5), rgba(220,38,38,0.2), transparent)`
- Animation: Breathe curve, 2.5s
- Cat floats above at skill-matched pose

### Rubric Card
- Default: `#fffaf5` bg, `#ffe8d6` border
- Active: `#fff4ed` bg, `#FF6B35` border, Spring lift on select
- Score in Oswald, color matches rubric (TA=500, CC=600, LR=700, GR=800)

---

## 10. Auth Pages (Login / Sign-up)

- Background: `#0b0b0b` (matches landing — user is still in Arrival state)
- Card: `#151515`, `#2a2a2a` border, 24px radius
- Logo at top of card
- Inputs: `#1e1e1e` bg, `#2a2a2a` border → `#FF6B35` border on focus
- Primary button: `#FF6B35` full width
- Error: warm, not cold — "Mat khau sai roi — thu lai nhe?"
- Login background: `login.jpg` asset (existing, keep)
- Sign-up background: `signup.jpg` asset (existing, keep)

---

## 11. Implementation Notes

### Phase order (recommended)
1. **Design tokens** — CSS variables file (`tokens.css` or Tailwind config)
2. **Landing page** — highest visibility, standalone
3. **Dashboard / Assignment browse** — Discovery state
4. **Test-taking UIs** — all 4 skills, Focus state
5. **Processing screens** — Processing state
6. **Result pages** — Revelation state, all 4 skills
7. **Auth pages** — Arrival state, lower priority

### Font loading
```html
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```
JetBrains Mono for timers/scores only — load with `display=swap` and `font-display: optional` to avoid flash.

### Existing assets to keep
- `cat-peeps.webm` — landing video (already in use)
- `logo.png` — wordmark (already in use)
- `logo-icon.png` — cat ear silhouette for favicon + loading spinner
- `assignment-*.png` — all 4 skill cat poses (already in use on /assignment)
- `login.jpg`, `signup.jpg` — auth backgrounds (keep)

### Key behavior changes from current implementation
- Replace all `alert()` calls with toast notifications (warm orange style)
- Replace `LoadingScreen` component with `logo-icon.png` spinning loader
- Add timer component with 3 visual states (normal → warning → critical)
- Add Processing state screen (currently missing — user sees blank LoadingScreen after submit). The Processing screen is a full-page overlay shown immediately after the user submits. It displays the breathing orb, the skill-matched cat pose, and rotating Vietnamese typewriter copy. It then polls for the grading result and redirects to the result page (`/assignment/[type]/[id]/result/[submissionId]`) when ready. For Writing, the current code redirects to `/assignment/submissions` — this must be changed to redirect to the Writing result page instead. Implement as a route segment (e.g. a `processing` client component within the existing test page) or as a dedicated route (`/assignment/[type]/[id]/processing/[submissionId]`), not as the generic `LoadingScreen`.
- Collapse nav to slim bar when entering any test route
- Add `IntersectionObserver` for essay highlight glow-in on result page
- Add score count-up animation on result page load

---

*Mockups saved in `.superpowers/brainstorm/` — see session `82261-1779526877` for full visual references.*
