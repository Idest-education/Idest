# Game Platform Redesign — Classroom Engagement Platform

**Date:** 2026-06-10
**Status:** Approved
**Scope:** Complete redesign of the in-meeting game feature into a Kahoot/Quizizz-style classroom engagement platform with achievements, persistent leaderboards, new question types, and teacher analytics.

---

## Overview

The existing game feature (basic multiple-choice + fill-blank, manual timer, session leaderboard) is extended and redesigned in three phases:

- **Phase 1** — Core engine fixes, three new question types, full UI redesign, teacher controls, engagement layer (XP, streaks, rank changes)
- **Phase 2** — Achievement/medal system, persistent class leaderboard, orange-name honour system
- **Phase 3** — Teacher analytics dashboard and exportable session reports

The backend service layer (`GameSessionService`, `GameGateway`, `GameTemplateService`) is solid and is extended rather than rewritten. The EventEmitter2 bridge pattern is preserved. All new screens follow the existing dark meeting room theme (`#0b0b0b` background, `#fffaf5` text, `#7c3aed` accent).

---

## Phase 1: Core Engine + UI Redesign

### 1.1 Auto-Advance Timer (Server-Side)

**Problem:** The current timer is client-only — when it hits zero, nothing happens server-side unless the teacher clicks "Next."

**Solution:** When a question starts, `GameSessionService` schedules a `setTimeout` keyed by `gameSessionId`. When the timeout fires, it calls `nextQuestion()` internally (the same path as the teacher clicking Next). The teacher's "Next" button cancels the pending timeout before advancing. If the teacher extends the timer (`POST /game-sessions/:id/extend`), the existing timeout is cleared and a new one is set for the extended duration.

Key details:
- Timeout keyed by `gameSessionId` in a `Map<string, NodeJS.Timeout>` (existing `questionStartedAt` map pattern)
- Teacher clicking Next cancels the auto-advance timeout
- `game:timer_extended` WS event sent to all players when teacher extends, carrying `newTimerSeconds` and `elapsedSeconds`
- Students who haven't answered when auto-advance fires get 0 pts (no `GameAnswer` row written — already the case)
- Server restart: in-memory timeout is lost; reconnecting teacher gets the current question state and can manually advance

### 1.2 Question Lifecycle Fixes

- **Duplicate submission:** Already protected by DB unique constraint `(participantId, questionId)` + service-level 409. No change needed.
- **Race condition on advance:** `nextQuestion()` is wrapped in a Prisma transaction that checks `status === IN_PROGRESS` and `currentQuestionIndex` hasn't already advanced. Returns 409 if called twice simultaneously.
- **Unanswered students:** Already handled — no `GameAnswer` row = 0 pts. The `game:question_ended` event now additionally includes `unansweredCount` for teacher display.
- **State transitions:** Added `PAUSED` value to `GameSessionStatus` enum. Pausing stops the auto-advance timeout and emits `game:session_paused` / `game:session_resumed`.

### 1.3 New Question Types

Three new entries added to the `QuestionType` enum:

#### `MULTI_CHOICE` — Select All That Apply
- `correctAnswer` field stores a comma-separated list of correct labels, e.g. `"B,C"`
- Student submits a comma-separated string of selected labels
- Scoring: full points only if the submitted set exactly matches the correct set. Partial submissions (subset) score 0 — keeps scoring simple and prevents guessing strategies.
- `GameOption` model unchanged (still A/B/C/D with text)

#### `MATCH_LR` — Connect Left to Right
- `GameOption` records represent left-side items. A new `GameMatchPair` model stores the correct right-side value for each option.
- Student submission is a JSON string: `'[{"left":"A","right":"Joyful"},{"left":"B","right":"Sad"},...]'`
- Scoring: 1 point per correct pair, total normalised to the standard 500–1000 speed-bonus formula
- UI: tap a left chip → tap a right chip to connect; submit when all connected
- Teacher sees a "pair grid" reveal showing which connections were right/wrong

#### `WORD_CLOUD` — Free Word Submission
- No `correctAnswer` — this is not graded. All students who submit any word receive a participation point award (100 pts flat, no speed bonus).
- `GameAnswer.answer` stores the single submitted word (one word per student per question)
- `game:word_cloud_updated` WS event debounced 500ms, sends `{ words: [{text, count}] }` sorted by frequency descending
- Teacher and student both see the live cloud; teacher has a moderation button to hide a word (`POST /game-sessions/:id/hide-word`)
- Hidden words stored in `GameSession.hiddenWords` (JSON string array)
- Word cloud rendering: CSS font-size proportional to count (min 12px → max 36px); color assigned by consistent hash of the word text

### 1.4 Schema Changes

```prisma
enum QuestionType {
  MULTIPLE_CHOICE  // existing — single correct option
  FILL_BLANK       // existing — fuzzy text match
  MULTI_CHOICE     // new — select all correct options
  MATCH_LR         // new — connect left to right pairs
  WORD_CLOUD       // new — ungraded free word submission
}

enum GameSessionStatus {
  WAITING
  IN_PROGRESS
  PAUSED           // new
  ENDED
}

model GameQuestion {
  // existing fields …
  isMultiAnswer   Boolean      @default(false)  // true for MULTI_CHOICE
  matchPairs      GameMatchPair[]
}

model GameMatchPair {
  id         String       @id @default(cuid())
  questionId String
  question   GameQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  leftLabel  String       // matches GameOption.label
  rightText  String       // the correct right-side value
}

model GameSession {
  // existing fields …
  status         GameSessionStatus @default(WAITING)
  pausedAt       DateTime?         // new
  hiddenWords    String?           // new — JSON array of moderated words
}

model GameParticipant {
  // existing fields unchanged …
  answerStreak    Int @default(0)   // new — consecutive correct answers in the current session
  maxAnswerStreak Int @default(0)   // new — best answer streak this session
}

// Note: XP is not stored separately. It is derived client-side as score / 10 for display in the HUD.
// Phase 2 exposes totalXp = totalPoints / 10 from GameClassStats.
```

Migration: new columns are nullable or have defaults — no data loss.

### 1.5 New REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/game-sessions/:id/pause` | Teacher | Pause the current round |
| `POST` | `/game-sessions/:id/resume` | Teacher | Resume a paused round |
| `POST` | `/game-sessions/:id/extend` | Teacher | Extend timer `{extraSeconds: number}` |
| `POST` | `/game-sessions/:id/skip` | Teacher | Skip current question (0 pts for all) |
| `POST` | `/game-sessions/:id/reveal` | Teacher | Manually reveal answer before timer ends |
| `POST` | `/game-sessions/:id/hide-word` | Teacher | Hide a word in word cloud `{word: string}` |
| `GET`  | `/game-sessions/:id/stats` | Teacher | Per-question stats after session ends |

### 1.6 New WebSocket Events

**Server → Client**

| Event | Payload | Recipients |
|-------|---------|------------|
| `game:timer_extended` | `{newTimerSeconds, elapsedSeconds}` | All in game room |
| `game:session_paused` | `{pausedAt}` | All in game room |
| `game:session_resumed` | `{elapsedSeconds}` | All in game room |
| `game:word_cloud_updated` | `{words: [{text, count}]}` | All in game room |
| `game:question_ended` | existing + `{distribution: [{label, count, pct}], unansweredCount}` | All |

### 1.7 Scoring Updates

**MULTI_CHOICE:** Same formula as MULTIPLE_CHOICE, but `isCorrect` is true only if the submitted set exactly matches the correct set.

**MATCH_LR:** Partial credit based on how many pairs are correct:
```
ratio = correctPairs / totalPairs                       // 0.0 → 1.0
speedBonus = 500 + 500 * (1 - responseTimeMs / (timerSeconds * 1000))
pointsAwarded = ratio > 0 ? Math.round(ratio * speedBonus) : 0
```
A student who gets all pairs correct gets full speed-bonus points. Partial matches get a proportional share. Zero correct pairs = 0 pts. `isCorrect` is `true` only when all pairs are correct.

**WORD_CLOUD:** Fixed 100 pts for any submission. `isCorrect = true` for all submitted words (participation reward).

**Answer streak tracking** (server-side, in `submitAnswer`):
- `isCorrect` → increment `answerStreak`, update `maxAnswerStreak` if exceeded
- `!isCorrect` → reset `answerStreak = 0`
- Include `{answerStreak, maxAnswerStreak}` in the `submitAnswer` REST response so client can update HUD immediately
- The HUD displays XP as `Math.round(currentSessionScore / 10)` — no separate XP field persisted

Note: "Consecutive wins" in Phase 2 (used for streak medals) tracks finishing #1 in N sessions in a row — a separate counter in `GameClassStats.consecutiveWins`, updated at session end.

### 1.8 Answer Distribution in `game:question_ended`

`GameGateway.handleQuestionEnded` fetches all `GameAnswer` rows for the current question, groups by answer value, computes count and percentage, and includes in the event payload:

```ts
distribution: [
  { label: 'A', text: 'Melancholy', count: 3, pct: 15, isCorrect: false },
  { label: 'B', text: 'Joyful',     count: 14, pct: 70, isCorrect: true },
  { label: 'C', text: 'Tranquil',   count: 2,  pct: 10, isCorrect: false },
  { label: 'D', text: 'Anxious',    count: 1,  pct: 5,  isCorrect: false },
]
```

### 1.9 UI Redesign — All Screens

All game screens share a dark game theme: `#0b0b0b` background, `#fffaf5` text.

#### Student — Question Screen
- **HUD strip** (top): current pts, 🔥 streak count, rank badge (`#N of M`)
- **Circular timer ring** (SVG arc): replaces flat progress bar; colour shifts `#7c3aed` → `#f59e0b` → `#ef4444` as time runs out; pulses in the last 5 seconds
- **Question text**: larger (14–16px), bold
- **Answer buttons** (MULTIPLE_CHOICE): full-colour gradient buttons (A=blue, B=purple, C=green, D=amber); scale up on hover/tap
- **Answer buttons** (MULTI_CHOICE): checkbox-style selection; "Submit" button appears after ≥1 selected
- **Match L/R**: two columns of chips; tap left then right to connect; connected pairs show a green dot between them; "Submit All" when all connected
- **Word Cloud**: single text input + Submit button; after submit shows "✓ Submitted" state
- **After submit**: answer locked, "Waiting for results…" shown with subtle pulse animation

#### Student — Answer Reveal
- Full-screen overlay (backdrop blur)
- ✓/✗ icon with colour glow
- `+820 pts` in large type (animated count-up)
- "Correct answer" card showing the answer text
- **Distribution bars**: animated fill from 0% to final width (0.8s spring easing); correct answer glows green; percentages and counts shown
- Rank change: "↑ #3 → #2" in purple

#### Teacher — Active Round
- Split layout: question + controls (left) / live leaderboard (right)
- Controls bar: `[Skip] [+30s Extend] [Reveal] [Pause] [Next →]`
- Circular timer (same as student view)
- Response count: "14 / 20 answered (70%)"
- Live mini-distribution bars that update in real time as answers come in
- Rank-change arrows (↑/↓) on leaderboard rows

#### Teacher — Question Editor (Games Dashboard)
- New question type selector: **Single Choice** / **Multiple Choice (select all)** / **Fill in the Blank** / **Match Left → Right** / **Word Cloud**
- MATCH_LR editor: add left/right pair rows; drag to reorder
- WORD_CLOUD editor: only question text + timer; no correct-answer field

#### Game Ended Screen (both roles)
- Podium: 2nd left, 1st centre (taller), 3rd right; player name + score + avatar emoji
- Animated rank entries below podium
- Student sees their personal summary: total pts, accuracy %, best streak, XP gained this session

---

## Phase 2: Achievement System + Persistent Class Leaderboard

### 2.1 New Data Models

```prisma
model GameClassStats {
  id                String   @id @default(cuid())
  classId           String
  userId            String
  totalPoints       Int      @default(0)
  weeklyPoints      Int      @default(0)
  monthlyPoints     Int      @default(0)
  totalWins         Int      @default(0)   // #1 finishes
  totalGames        Int      @default(0)
  correctAnswers    Int      @default(0)
  totalAnswers      Int      @default(0)
  consecutiveWins   Int      @default(0)   // current consecutive #1 streak
  maxConsecWins     Int      @default(0)
  rank1WeeksSince   DateTime?              // date first achieved rank-1 in current streak
  rank1MonthsSince  DateTime?
  weeklyResetAt     DateTime @default(now())
  monthlyResetAt    DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([classId, userId])
}

model GameMedal {
  id          String       @id @default(cuid())
  key         String       @unique  // e.g. "WINS_3", "STREAK_TOP1_3"
  category    MedalCategory
  name        String
  description String
  icon        String       // emoji
  awards      GameMedalAward[]
}

model GameMedalAward {
  id        String   @id @default(cuid())
  medalId   String
  medal     GameMedal @relation(fields: [medalId], references: [id])
  userId    String
  classId   String
  awardedAt DateTime @default(now())

  @@unique([medalId, userId, classId])
}

enum MedalCategory {
  WINNING
  STREAK
  LEADERBOARD
  PARTICIPATION
  ACCURACY
  SPEED
}
```

**Weekly/monthly reset:** A NestJS `@Cron` job (using `@nestjs/schedule`) runs at midnight Sunday and midnight on the 1st to zero `weeklyPoints` / `monthlyPoints` respectively.

### 2.2 Medal Definitions

Seeded into `GameMedal` on startup via a seed script. Full list:

**Winning:** WINS_3, WINS_10, WINS_50, WINS_100
**Streak (consecutive #1 finishes):** CONSEC_WIN_3, CONSEC_WIN_5, CONSEC_WIN_10
**Leaderboard hold:** RANK1_WEEK, RANK1_MONTH
**Participation:** GAMES_10, GAMES_50, GAMES_100
**Accuracy (within a single session):** ACC_90, ACC_95, ACC_100 (perfect)
**Speed:** SPEED_FAST (avg response < 5s in a session), SPEED_LIGHTNING (avg < 3s), SPEED_DEMON (avg < 2s and all correct)

### 2.3 Medal Check Logic

**Deriving `classId`:** `GameSession.sessionId` is a meeting `Session.id`. `AchievementService` looks up `Session.class_id` via Prisma to get the `classId` for `GameClassStats` and `GameMedalAward`.

After every game session ends, `AchievementService.checkAndAward(gameSessionId)` runs:
1. Load session + all participant data + current `GameClassStats` for each participant
2. Update `GameClassStats` (increment counters, update weekly/monthly points)
3. For each medal definition, evaluate the condition against updated stats
4. Any newly earned medals → create `GameMedalAward` row + emit `game:medal_earned` WS event to that user

`game:medal_earned` payload: `{ medal: { key, name, description, icon }, classId }`

The frontend shows an unlock toast (animated, with chime) and persists the info to `useGameStore` so it can be shown on the achievements page.

### 2.4 Orange Name Logic

At any point where a student's display name is rendered within a class context (leaderboard rows, participant list, game HUD), the client checks whether `medalHolderIds` (a Set from the class leaderboard API) includes the userId. If yes, renders the name in `#fb923c` (orange).

**API:** `GET /game-classes/:classId/medal-holders` returns `{ userIds: string[] }`. Cached client-side per class session load.

### 2.5 Class Leaderboard

**REST endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/game-classes/:classId/leaderboard?period=weekly` | Leaderboard for period (weekly/monthly/all-time) |
| `GET` | `/game-classes/:classId/medal-holders` | User IDs with ≥1 medal in this class |
| `GET` | `/game-classes/:classId/my-stats` | Caller's own stats + medals in this class |
| `GET` | `/game-classes/:classId/medals/:userId` | A student's medals in this class |

**Frontend routes:**
- `/classes/[classId]/leaderboard` — class leaderboard page with podium, tab switcher (weekly/monthly/all-time), full ranked list
- `/classes/[classId]/achievements` — a student's achievement profile: medals earned, progress toward next medals, history

### 2.6 Achievement Progress Tracking

`GET /game-classes/:classId/my-stats` response includes progress toward every unearned medal:

```json
{
  "earned": ["WINS_3", "GAMES_10"],
  "progress": [
    { "medalKey": "WINS_10", "current": 3, "target": 10, "pct": 30 },
    { "medalKey": "GAMES_50", "current": 12, "target": 50, "pct": 24 }
  ]
}
```

The achievements page renders progress bars for unearned medals.

---

## Phase 3: Analytics + Export

### 3.1 Session Stats Endpoint

`GET /game-sessions/:id/stats` (teacher-only) returns per-question analytics:

```json
{
  "questions": [
    {
      "questionIndex": 0,
      "text": "Which word…",
      "type": "MULTIPLE_CHOICE",
      "correctAnswer": "B",
      "totalResponses": 18,
      "correctCount": 14,
      "incorrectCount": 3,
      "unansweredCount": 1,
      "avgResponseTimeMs": 4200,
      "distribution": [
        { "label": "A", "count": 3, "pct": 17 },
        { "label": "B", "count": 14, "pct": 78, "isCorrect": true },
        { "label": "C", "count": 1, "pct": 6 }
      ],
      "difficultyScore": 0.22  // 1 - correctRate; higher = harder
    }
  ],
  "summary": {
    "participantCount": 18,
    "avgAccuracy": 76,
    "avgResponseTimeMs": 5100,
    "hardestQuestion": 3,
    "easiestQuestion": 1
  }
}
```

All data is computed from existing `GameAnswer` rows. No new models needed.

### 3.2 Teacher Analytics Dashboard

Route: `/games/sessions/[id]/report`

Sections:
- **Summary bar**: participants, avg accuracy, avg response time, session duration
- **Question difficulty chart**: horizontal bar chart (using recharts, already installed) sorted by difficulty score; red = hardest, green = easiest
- **Most-missed questions**: top 3 questions with lowest correct rate, showing which wrong answer was most popular
- **Per-student table**: name, score, accuracy %, avg response time, answered/total; sortable

### 3.3 Export

`GET /game-sessions/:id/export?format=csv` — teacher-only, streams a CSV with columns: `studentName, score, accuracy, avgResponseTimeMs, answeredCount, correctCount`

`GET /game-sessions/:id/export?format=json` — full session data including per-question breakdown.

---

## Frontend File Map

### New / modified files

```
apps/server/src/game/
  game-session.service.ts          — extend: auto-timer, pause/resume/skip/extend/reveal, word cloud, MATCH_LR/MULTI_CHOICE scoring, streak tracking, distribution in question_ended
  game.gateway.ts                  — new events: timer_extended, session_paused/resumed, word_cloud_updated
  game-template.service.ts         — extend: MATCH_LR/WORD_CLOUD/MULTI_CHOICE support
  achievement.service.ts           — NEW: checkAndAward, medal seeding
  achievement.controller.ts        — NEW: class leaderboard, medal-holders, my-stats endpoints
  class-stats.service.ts           — NEW: updateStats, weekly/monthly cron reset
  dto/
    extend-timer.dto.ts            — NEW
    hide-word.dto.ts               — NEW
  game.module.ts                   — add AchievementService, ClassStatsService

apps/server/prisma/schema.prisma   — add new enums/models (§1.4 + §2.1)

apps/website/
  types/game.ts                    — extend: new event payloads, MATCH_LR/MULTI_CHOICE/WORD_CLOUD types, medal types
  services/game.service.ts         — extend: new endpoints
  hooks/useGameStore.ts            — extend: wordCloud, medalEarned, distribution, streak, xp
  hooks/useGameSocket.ts           — extend: new event handlers
  components/game/
    GameActiveStudent.tsx          — full redesign + new question type renderers
    GameActiveTeacher.tsx          — full redesign + new controls + live distribution
    GameEnded.tsx                  — full redesign + personal summary
    GameLauncher.tsx               — minor polish
    GameQuestionEditor.tsx         — extend: MATCH_LR editor, WORD_CLOUD editor, MULTI_CHOICE option
    GameWordCloud.tsx              — NEW: live word cloud renderer (CSS font-size scaling)
    GameMatchLR.tsx                — NEW: student match UI (tap to connect)
    GameMatchLREditor.tsx          — NEW: teacher editor for pair rows
    GameAchievementToast.tsx       — NEW: medal unlock toast
    GameTimer.tsx                  — NEW: circular SVG ring timer (shared by student + teacher)
    GameHUD.tsx                    — NEW: score/streak/rank strip
  app/(protected)/
    classes/[classId]/leaderboard/page.tsx  — NEW: class leaderboard page
    classes/[classId]/achievements/page.tsx — NEW: achievement profile page
    games/sessions/[id]/report/page.tsx     — NEW: teacher analytics report
```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Timer fires while teacher is clicking Next | `nextQuestion()` checks idempotency via transaction; second call returns 409, client silently ignores |
| Student submits MULTI_CHOICE after timer | 409 if already advanced; standard duplicate protection |
| WORD_CLOUD question — student submits empty string | Rejected with 400 client-side validation |
| Server restarts mid-session | `questionStartedAt` map lost; reconnecting teacher can click Next to advance manually; auto-advance resumes for new questions |
| Medal check fails (DB error) | Logged and swallowed — does not roll back the session end |
| Weekly cron runs while a session is in progress | Points from the in-progress session are applied after it ends; no mid-game interference |
| Class has no `GameClassStats` row yet | `AchievementService` upserts on first check |

---

## Out of Scope

- Admin viewing other teachers' game templates
- Real-time collaborative question editing
- Student-created games
- Image or audio in questions
- Multiple word submissions for WORD_CLOUD (one word per student per question)
- Partial credit for MULTI_CHOICE (all-or-nothing keeps scoring predictable)
