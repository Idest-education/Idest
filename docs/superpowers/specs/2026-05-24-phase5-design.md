# Phase 5 Design Spec — Class, Session, Meet, Profile/Settings, Admin

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Warm orange design system rewrite — Phase 5 surfaces

---

## Context

Phases 1–4 applied the warm orange design system (DESIGN.md) to the assignment flow, home/landing, listening, writing, speaking, and result pages. Phase 5 completes the product UI: class pages, session pages, the live meeting room, profile/settings, and admin.

**Design rules enforced throughout:**
- No cool colors (blue, teal, purple, gray) in product UI
- No gradient text (`background-clip: text`)
- No dark gradient card overlays on hover
- No side-stripe borders as decorative accents
- No identical card grids (cards may share structure but vary in density or accent)
- All typography: Oswald (display/headings), Plus Jakarta Sans (body), JetBrains Mono (numbers/timers)
- Page background: `var(--color-surface-app)` (`#fffaf5`) — not `bg-white`

---

## 1. Class Pages

### 1a. Classes List Page (`/classes/page.tsx`)

**Page background:** `var(--color-surface-app)`

**Header:**
- Eyebrow pill: `surface-subtle` background, `border-default` border, uppercase label — no `animate-pulse`
- `h1` in Oswald display font — no gradient text
- Muted body subtitle, `max-w-[52ch]`

**Stat strip** (left column, above calendar):
- Three cells in a 3-column grid, intentionally varied in size and accent:
  - Cell 1 (accent): `surface-subtle` bg, `border: 1.5px solid var(--color-brand)`, large JetBrains Mono number
  - Cell 2: `surface-card` bg, standard number
  - Cell 3 (compact): `surface-card` bg, smaller number
- No identical card treatment across all three

**Next class callout:**
- `surface-subtle` bg, `3px solid var(--brand)` left border, `border-radius: 0 8px 8px 0`
- Live dot (8px circle, brand color), class name + formatted datetime
- Not a Card component — inline strip only

**Right column:** `ClassScheduleCalendar` unchanged (layout only)

**Search bar:** `border-default` border, orange focus ring (`border-brand` + `0 0 0 3px #FF6B3520`)

**Section headers:** Oswald title + `count-pill` in `surface-subtle`

**Empty/no-results state:** warm dashed border (`border-default`), no cool-gray gradient background

**Action buttons:** "Tạo lớp học" → `btn-primary` (orange), "Tham gia lớp" → `btn-outline` (warm)

---

### 1b. ClassCard (`/components/class/class-card.tsx`)

Replaces the dark-gradient-overlay hover anti-pattern.

**Rest state:**
- `surface-card` background, `border-default` border, `border-radius: 12px`
- Ghost number watermark (01, 02…) top-right: Oswald 80px, brand color at 7% opacity

**Hover state:**
- Background floods to `linear-gradient(135deg, #FF6B35 0%, #c94010 100%)`
- Border color → `#FF6B35`
- `transform: translateY(-4px)`, `box-shadow: 0 12px 32px #FF6B3544`
- All text → white, ghost number → white at 12% opacity
- Skill pill → `rgba(255,255,255,0.25)`
- Footer border → `rgba(255,255,255,0.2)`
- CTA arrow shifts `translateX(2px)`
- Transition: `200ms ease` on all properties

**Card content:**
- Skill pill (brand bg, white text) — top
- Class name in Oswald 16px
- Description 12px `text-muted`, `line-clamp-2`
- Footer: member count + session count left; "Xem chi tiết →" right

---

### 1c. Class Detail Page (`/classes/[slug]/page.tsx`)

**Warm header band:**
- `linear-gradient(160deg, #fff4ed 0%, #ffe8d6 100%)` background
- `border-bottom: 1.5px solid var(--border-default)`
- Class name in Oswald 28px, description 14px `text-secondary`
- Creator line in `text-muted`
- Actions: "Mở nhóm chat lớp" → `btn-primary`; invite code → `btn-outline` with mono font

**Invite code strip (staff only):**
- `surface-subtle` bg, `border-default` border, `border-radius: 8px`
- Uppercase label + JetBrains Mono code + copy button — inline strip, not a card

**Stats:** Single joined strip (`display: flex`), `border-default` border, `border-radius: 12px`, `overflow: hidden`. Three cells separated by `border-right: 1px solid border-default`. JetBrains Mono numbers in brand color. Not 3 separate cards.

**Schedule:** Pill row (`display: flex; flex-wrap: wrap; gap: 8px`). Each day/time is a `surface-subtle` pill with `border-default` border. Not a bordered card section.

**Teachers/Members:** Retain existing component structure; apply warm borders and `surface-subtle` hover on individual member items.

**Session filter tabs:** Warm pill tabs (`surface-muted` container, brand-filled active). Not shadcn `Button` components.

**Session rows:** `surface-card` bg, `border-default` border, `border-radius: 10px`. Live session: `border-color: correct`, `background: #f0fdf4`. Join button: `btn-primary` (orange). Past/upcoming: `btn-outline`.

**"Tạo buổi học" button:** `btn-primary` small.

---

## 2. Session Pages

### 2a. Sessions List Page (`/sessions/page.tsx`)

**Page background:** `var(--color-surface-app)`  
**Heading:** Oswald 32px, muted subtitle

**Filter tabs:** Warm pill tabs — `surface-muted` container, brand active — replaces shadcn `Button` pair

**SessionCard states:**

| State | Border | Background | Right element |
|---|---|---|---|
| Live | `--color-correct` | `#f0fdf4` | Orange join button |
| Upcoming | `border-default` | `surface-card` | JetBrains Mono countdown |
| Past | `border-default` | `surface-app` | Warm outline "Xem lại" button |

**Live badge:** `background: correct`, white text, white 6px dot — no green Tailwind classes  
**Past badge:** `surface-subtle` bg, `text-secondary`

---

### 2b. SessionCard (`/components/session/session-card.tsx`)

- Container: `border-default`, `border-radius: 12px`, warm hover (`surface-subtle` bg transition)
- Topic: Oswald font, 15px
- Class name: 12px brand color
- Meta row: `text-muted`, plain text — no emoji
- "Tham gia buổi học" button: `background: #FF6B35` — replaces `bg-blue-600`
- Active badge: brand-correct colors (not Tailwind `bg-green-100 text-green-800`)
- Host actions (end/delete): warm outline, delete in `error` color

---

### 2c. Session Review Page (`/sessions/[sessionId]/review/page.tsx`)

**Warm header band:** same gradient as class detail (`#fff4ed` → `#ffe8d6`), Oswald title, session date as subtitle, "← Quay lại" outline button right-aligned

**Layout:** 2-column on lg — video + info left (2fr), attendance right (1 column, `300px`)

**Video panel:** `background: #111`, `border-radius: 12px`, `border: 1.5px solid border-default`. Placeholder text in muted white when no recording.

**Download actions:** `btn-primary` (Tải video) + `btn-outline` (Tải điểm danh) below video

**Info block:** `surface-subtle` bg, `border-default` border, `border-radius: 12px`. Rows of uppercase label (`text-muted`) + value — not a shadcn Card component.

**Attendance sidebar:**
- `surface-card` bg, `border-default` border, `border-radius: 12px`
- Header: `surface-subtle` tint, Oswald title, download button
- Row per student: name + duration left, status badge right
- Attended: `#dcfce7` bg, `#166534` text
- Absent: `surface-muted` bg, `text-muted`
- Max height `640px`, `overflow-y: auto`

---

## 3. Meet Page (`/sessions/[sessionId]/meet/page.tsx`)

Full-screen immersive surface. Navbar does not render on `/meet` routes.

**Color palette (dark warm):**
- Canvas: `#0b0b0b`
- Chrome (header, tab bar, controls bar): `#151515`
- Borders: `#2a2a2a`
- Primary text: `#fffaf5` (warm off-white)
- Muted text: `rgba(255,250,245,0.35)`
- Video tile background: `#1a0a00` (deep warm brown — not cool gray)

**Header bar (`h-auto`, `py-10px`):**
- `background: #151515`, `border-bottom: 1px solid #2a2a2a`
- Session title in Oswald 15px, `color: #fffaf5`
- Start time in JetBrains Mono 11px, muted

**Tab bar (video / whiteboard):**
- `background: #151515`, `border-bottom: 1px solid #2a2a2a`
- Active tab: `background: var(--brand)`, white text, `border-radius: 9999px`
- Inactive tab: `color: rgba(255,250,245,0.35)`

**Video tiles:**
- Background: `#1a0a00` — not `bg-gray-800` or similar
- Active speaker: `border: 1.5px solid var(--brand)` ring
- Muted indicator: `background: var(--error)` pill top-right
- Participant name label: `background: rgba(0,0,0,0.45)`, warm off-white text

**Controls bar:**
- `background: #151515`, `border-top: 1px solid #2a2a2a`
- Control buttons: `background: rgba(255,250,245,0.1)`, warm off-white icon (on state)
- Off state (mic/camera disabled): `background: var(--error)`
- Chat button (active panel): `background: var(--brand)`
- "Rời buổi học": `background: var(--error)`, `border-radius: 9999px`, white text

**Side panels (chat, participants):**
- `background: #151515`, `border-left: 1px solid #2a2a2a`
- Input field: `background: rgba(255,250,245,0.07)`, `border: 1px solid #2a2a2a`
- Send button: `background: var(--brand)`

---

## 4. Profile / Settings Pages

### 4a. Profile Settings (`/settings/profile/page.tsx`)

**Page background:** `var(--color-surface-app)`  
**Page title:** Oswald 28px

**Warm card pattern** (applied to both the profile card and danger zone card):
- Card: `surface-card` bg, `border-default` border, `border-radius: 16px`, `overflow: hidden`
- Card header: `surface-subtle` bg, `border-bottom: 1.5px solid border-default`, Oswald title

**Avatar section (top of profile card):**
- 72×72 circle, `border: 2.5px solid border-default`, `surface-subtle` bg
- Initials in Oswald brand color when no avatar image
- Name in Oswald 18px, role + status in `text-muted` 12px
- "Đổi ảnh" button → `btn-outline` small, right-aligned

**Form fields:**
- `border: 1.5px solid border-default`, `border-radius: 8px`
- Focus: `border-color: var(--brand)`, `box-shadow: 0 0 0 3px #FF6B3520`
- Disabled fields: `background: surface-muted`, `color: text-muted`
- Labels: 11px, uppercase, `letter-spacing: .06em`, `text-muted`
- Grid: 2-column on md+

**Actions:** "Hủy" → `btn-outline`, "Lưu thay đổi" → `btn-primary`, right-aligned

**Danger zone card:**
- `background: #fff5f5`, `border: 1.5px solid #fecaca`
- Header: `background: #fee2e2`, title in `var(--error)` — this red treatment is on-palette per DESIGN.md
- "Xóa tài khoản" → `btn-danger` (`background: var(--error)`)

---

### 4b. Password Settings (`/settings/password/page.tsx`)

Same warm card pattern as profile. Single card, `max-w-xl`.

- All three password fields: warm border, orange focus ring
- "Cập nhật mật khẩu" → `btn-primary`, right-aligned

---

## 5. Admin Pages

### 5a. AdminShell (`/components/admin/AdminShell.tsx`)

- Remove `bg-gray-50` from shell container
- Main area: `background: var(--color-surface-app)`

### 5b. AdminSidebar (`/components/admin/AdminSidebar.tsx`)

Warm-toned dark sidebar — signals "admin territory" while staying on the warm axis.

**Colors:**
- Sidebar bg: `#1a0a00`
- Hover bg: `#2d1500`
- Active bg: `var(--brand)` (`#FF6B35`)
- Inactive link text: `rgba(255,250,245,0.5)`
- Hover text: `rgba(255,250,245,0.8)`
- Active text: `#ffffff`
- Divider: `rgba(255,250,245,0.1)`

**Logo area:** "IDEST" in Oswald 18px `#fffaf5`, "Admin Console" in 11px muted below

**Nav links:** icon + label. Active link: brand background. No cool grays anywhere.

**"Back to App" link:** bottom, above divider, same link style.

### 5c. Admin Dashboard (`/admin/page.tsx`)

**Heading:** Oswald 26px, muted subtitle

**Stat strip:** 3-column grid
- Each cell: `surface-card` bg, `border-default` border, `border-radius: 12px`
- Icon area: 36×36 `surface-subtle` bg, `border-radius: 8px`, brand-colored SVG icon
- Number: JetBrains Mono 26px, `text-primary`
- Label: 11px `text-muted`

### 5d. Admin Users Page (`/admin/users/page.tsx`)

**Filter bar:** warm `border-default` inputs, warm select dropdowns — no Tailwind gray borders

**Table wrapper:** `surface-card` bg, `border-default` border, `border-radius: 12px`, `overflow: hidden`

**Table head bar:** `surface-muted` bg, `border-bottom: 1.5px solid border-default`, Oswald section title

**Column headers (`<th>`):** 10px uppercase `text-muted` — not default browser bold

**Row hover:** `background: surface-subtle`

**Role badges:**
- ADMIN: `background: #1a0a00`, `color: #fffaf5`
- TEACHER / STUDENT: `surface-subtle` bg, `text-secondary`

**Status badges:**
- Active: `#dcfce7` bg, `#166534` text
- Banned: `#fee2e2` bg, `#7f1d1d` text

**Action buttons:** `surface-muted` bg, `border-subtle` border for neutral; `#fee2e2` bg, `error` color for destructive (Ban)

**Pagination:** warm outline buttons

### 5e. Admin Classes Page (`/admin/classes/page.tsx`)

Same table pattern as users. Invite code displayed in JetBrains Mono inside `surface-subtle` chip (not `bg-gray-100`). Edit/Delete actions follow same warm destructive pattern. Create/Edit dialogs: warm card headers, warm form fields, orange submit.

### 5f. Admin Sessions Pages (`/admin/sessions/`, `/admin/sessions/[id]/`, `/admin/classes/[id]/`, `/admin/users/[id]/`)

Same warm table/card treatment. No new structural changes — color pass only.

---

## Anti-patterns eliminated

| Location | Was | Becomes |
|---|---|---|
| `class-card.tsx` hover | `bg-gradient-to-br from-gray-900 via-orange-900 to-orange-800` | Warm orange flood gradient |
| `classes/page.tsx` h1 | `bg-gradient-to-r ... bg-clip-text text-transparent` | Plain Oswald, `text-primary` |
| `session-card.tsx` join button | `bg-blue-600 hover:bg-blue-700` | `background: #FF6B35` |
| `sessions/page.tsx` background | `bg-white` | `var(--color-surface-app)` |
| `classes/page.tsx` eyebrow icon | `animate-pulse` | Removed |
| `classes/[slug]/page.tsx` stats | 3 identical `border border-gray-200 rounded-lg` cards | Single joined strip |
| `admin/AdminSidebar.tsx` | `bg-gray-900` | `#1a0a00` warm brown |
| `admin/AdminShell.tsx` | `bg-gray-50` | `var(--color-surface-app)` |
| All admin pages | Cool-gray text, borders, badges | Warm token equivalents |
| `settings/profile/page.tsx` | `bg-gray-200` avatar, generic Card | Warm card pattern, brand avatar ring |
