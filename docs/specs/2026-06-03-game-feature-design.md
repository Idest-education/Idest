# Game Feature Design

**Date:** 2026-06-03  
**Status:** Approved  
**Scope:** Kahoot-style in-meeting quiz game with game management dashboard, real-time sync, speed-based scoring, and automatic recording capture.

---

## 1. Overview

Teachers create reusable game templates (collections of questions) in a dedicated `/games` dashboard. During a meeting, a teacher can launch any of their games — all participants are automatically redirected to a new Game tab. Questions are shown one at a time with a countdown timer. Students submit answers; faster correct answers earn more points. After each question, students see their points earned and current rank. The teacher sees a live leaderboard. When the game ends, everyone sees the final leaderboard. When recording is active, the game view is automatically captured as a video track in the LiveKit recording.

---

## 2. Architecture

### Approach
Separate `/game` WebSocket namespace (aligns with existing `docs/modules/game/05-websocket-gateway.md` design) alongside the existing `/meet` namespace. Two concurrent socket connections from the client. Canvas-based automatic game capture for recording.

### New pieces

**Backend (`apps/server/src/game/`)**
- `GameTemplateController` + `GameTemplateService` — CRUD for game templates
- `GameSessionController` + `GameSessionService` — session lifecycle, answer submission, leaderboard
- `GameGateway` — `/game` WebSocket namespace, EventEmitter2 bridge pattern
- Prisma schema additions: `GameTemplate`, `GameQuestion`, `GameOption`, `GameSession`, `GameParticipant`, `GameAnswer`

**Frontend (`apps/website`)**
- `/games` route — standalone game management dashboard (teacher/admin only)
- `components/game/GameTab.tsx` — in-meeting Game tab (renders launcher or active game depending on state)
- `hooks/useGameSocket.ts` — socket connection to `/game` namespace
- `hooks/useGameStore.ts` — Zustand store for game session state, scores, leaderboard
- `hooks/useGameCapture.ts` — canvas stream → LiveKit track when recording + game are both active
- Extend `meet/page.tsx` to add 3rd tab; tab is hidden until `game:session_started` is received

---

## 3. Data Model

```prisma
model GameTemplate {
  id          String         @id @default(cuid())
  title       String
  description String?
  createdBy   String         // userId (teacher)
  questions   GameQuestion[]
  sessions    GameSession[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model GameQuestion {
  id           String       @id @default(cuid())
  templateId   String
  template     GameTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  text         String
  type         QuestionType // MULTIPLE_CHOICE | FILL_BLANK
  order        Int
  timerSeconds Int          @default(20)
  correctAnswer String      // stored server-side, never sent to clients until question ends
  options      GameOption[] // populated only for MULTIPLE_CHOICE
  answers      GameAnswer[]
}

model GameOption {
  id         String       @id @default(cuid())
  questionId String
  question   GameQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  label      String       // "A" | "B" | "C" | "D"
  text       String
}

model GameSession {
  id                   String            @id @default(cuid())
  templateId           String
  template             GameTemplate      @relation(fields: [templateId], references: [id])
  sessionId            String            // FK to meeting Session.id
  startedBy            String            // userId (teacher)
  status               GameSessionStatus // WAITING | IN_PROGRESS | ENDED
  currentQuestionIndex Int               @default(0)
  participants         GameParticipant[]
  answers              GameAnswer[]
  startedAt            DateTime          @default(now())
  endedAt              DateTime?
}

model GameParticipant {
  id                   String      @id @default(cuid())
  sessionId            String
  session              GameSession @relation(fields: [sessionId], references: [id])
  userId               String
  score                Int         @default(0)
  lastSeenQuestionIndex Int        @default(0)
  joinedAt             DateTime    @default(now())
  lastActiveAt         DateTime    @default(now())
  answers              GameAnswer[]

  @@unique([sessionId, userId])
}

model GameAnswer {
  id             String          @id @default(cuid())
  sessionId      String
  session        GameSession     @relation(fields: [sessionId], references: [id])
  questionId     String
  question       GameQuestion    @relation(fields: [questionId], references: [id])
  participantId  String
  participant    GameParticipant @relation(fields: [participantId], references: [id])
  answer         String          // option label (MCQ) or free text (FILL_BLANK)
  isCorrect      Boolean
  responseTimeMs Int             // ms from question start → submit; used for scoring
  pointsAwarded  Int
  submittedAt    DateTime        @default(now())

  @@unique([participantId, questionId])
}

enum QuestionType {
  MULTIPLE_CHOICE
  FILL_BLANK
}

enum GameSessionStatus {
  WAITING
  IN_PROGRESS
  ENDED
}
```

---

## 4. REST API

All endpoints are under `apps/server`. Auth via existing Supabase JWT guards.

### Game Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/game-templates` | Teacher/Admin | List caller's own templates |
| `POST` | `/game-templates` | Teacher/Admin | Create template with questions |
| `GET` | `/game-templates/:id` | Owner | Get template detail (questions + options) |
| `PATCH` | `/game-templates/:id` | Owner | Update template metadata or questions |
| `DELETE` | `/game-templates/:id` | Owner | Delete template (cascades to questions) |

### Game Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/game-sessions` | Teacher | Start session `{templateId, sessionId}` |
| `POST` | `/game-sessions/:id/next` | Teacher (session owner) | Advance to next question or end game |
| `POST` | `/game-sessions/:id/submit` | Student | Submit answer `{answer}` — 409 on duplicate |
| `GET` | `/game-sessions/:id/leaderboard` | All | Final leaderboard (only after ENDED) |
| `GET` | `/game-sessions/active` | All | `?sessionId=` — get active session for a meeting (used on reconnect) |

---

## 5. WebSocket Gateway (`/game` namespace)

Follows `EventEmitter2` bridge pattern from `docs/modules/game/05-websocket-gateway.md`. `GameService` emits domain events; `GameGateway` subscribes with `@OnEvent()` and forwards to socket rooms. REST is authoritative; WS is push-only.

### Server → Client

| Event | Payload | Recipients |
|-------|---------|------------|
| `game:session_started` | `{gameSessionId, title, questionCount}` | All in meeting room |
| `game:question_started` | `{questionIndex, text, type, options[], timerSeconds, elapsedSeconds}` | All in game room |
| `game:question_ended` | `{correctAnswer, pointsBreakdown[{userId, pointsAwarded}]}` | All in game room |
| `game:leaderboard_updated` | `{top10[{userId, displayName, score}]}` | All in game room (debounced 500ms) |
| `game:session_ended` | `{leaderboard[{rank, userId, displayName, score}]}` | All in game room |
| `game:participant_rejoined` | `{userId, displayName}` | Teacher only |

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `game:join_room` | `{gameSessionId}` | Join game room; triggers reconnect logic server-side |
| `game:leave_room` | `{gameSessionId}` | Leave game room (does not delete GameParticipant) |

Answer submission is REST-only (`POST /game-sessions/:id/submit`) to ensure validation, deduplication, and rate-limiting.

### `game:session_started` is emitted to the `/meet` room

When a teacher starts a game, `GameService` emits an internal `game.session.started` event via `EventEmitter2`. `MeetGateway` listens with `@OnEvent('game.session.started')` and broadcasts `game:session_started` to the `/meet` room — so all clients in the meeting, including those not yet connected to the `/game` namespace, receive it immediately. The client's `useMeetClient` hook listens for `game:session_started` and sets `activeGameSessionId` in `useMeetStore`. This causes the Game tab to appear in the tab bar and auto-focus.

---

## 6. Frontend

### `/games` — Game Management Dashboard

- Route: `app/(protected)/games/page.tsx`
- Access: teacher and admin roles only (same auth pattern as other protected pages)
- Displays the caller's game templates in a card/list layout
- "New Game" button → `/games/new` (creation form)
- Each template: title, question count, Edit and Delete actions
- Edit: `/games/[id]/edit`
- Game creation/editing form: template title + description, then a question list editor. Each question: text, type selector, timer (default 20s), correct answer, and options (MCQ only: 4 options with labels A–D). Questions are reorderable.

### In-Meeting Game Tab (`components/game/GameTab.tsx`)

The tab is added as the 3rd tab in `meet/page.tsx` with `forceMount` + `data-[state=inactive]:hidden` (same pattern as whiteboard). The tab trigger is hidden from the tab bar via CSS until `activeGameSessionId` is set in `useMeetStore`.

**Teacher view — no active game:**  
Shows a "Start a Game" launcher listing all the teacher's templates with a Start button. Clicking Start calls `POST /game-sessions` and the session begins.

**Teacher view — game active:**  
Shows the current question text and question index (e.g., "Question 2 of 6"), a count of how many students have answered, and the live leaderboard (top 10, updated via `game:leaderboard_updated`). A "Next Question →" button calls `POST /game-sessions/:id/next`. An "End Game" button is available to end early.

**Student view — game active:**  
Shows the question text, a timer progress bar, and either 4 colored option buttons (MCQ) or a text input + Submit button (FILL_BLANK). After submitting, the answer is locked (no re-submission). After `game:question_ended`, the correct answer is revealed and the student sees points earned this round + cumulative score + their rank.

**All — game ended:**  
Both teacher and student see the final leaderboard (podium top 3 + full ranked list).

### State Management

`useGameStore` (Zustand) holds:
- `activeSession: GameSession | null`
- `currentQuestion: GameQuestion | null`
- `questionStartedAt: number | null` (timestamp, for computing `responseTimeMs` client-side as a display aid — actual timing is computed server-side)
- `myScore: number`
- `myRank: number | null`
- `leaderboard: LeaderboardEntry[]`
- `gameStatus: 'idle' | 'active' | 'ended'`

`useGameSocket` manages the `/game` WebSocket connection lifecycle, binds all `game:*` events, and dispatches to `useGameStore`.

---

## 7. Recording Integration (`useGameCapture`)

When `isRecording && activeSession !== null`:

1. Create a 1280×720 offscreen `<canvas>` element.
2. Start a `requestAnimationFrame` loop at 10fps rendering the current game state from `useGameStore` onto the canvas (question text, options/input field, timer bar, current scores).
3. Call `canvas.captureStream(10)` to get a `MediaStream`.
4. Create a LiveKit `LocalVideoTrack` from the stream and publish to the LiveKit room with a distinguishable track name (`"game-view"`).
5. On game end or recording stop: stop the animation loop, stop all canvas stream tracks, unpublish the LiveKit track, and release the canvas.

The LiveKit egress recording captures this track as a screen-share-style stream from the teacher's perspective. No user permission dialog is required.

---

## 8. Scoring

**Speed-based (Kahoot-style):**

```
points = isCorrect
  ? Math.round(500 + 500 * (1 - responseTimeMs / (timerSeconds * 1000)))
  : 0
```

- Correct + instant answer → 1000 pts
- Correct + answered at last second → 500 pts  
- Wrong or no answer → 0 pts
- `responseTimeMs` is computed server-side as `submittedAt - questionStartedAt`

**Fuzzy matching for FILL_BLANK:**
- Normalize both strings: lowercase, trim whitespace
- Compute Levenshtein distance
- Accept if distance ≤ `Math.floor(correctAnswer.length / 5)` (minimum tolerance: 1 for words ≥5 chars)
- E.g., "joyful" (6 chars) → tolerance 1 → "joyfull" ✓, "joyfl" ✓, "happy" ✗

---

## 9. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Student disconnects mid-game | `GameParticipant` row preserved with current score. On reconnect: `game:join_room` → server sends current question with remaining time (`timerSeconds - elapsedSeconds`). Questions missed while away: 0 pts. |
| Student joins after game starts | Server creates new `GameParticipant`. They receive the current question and play from that point. No points for missed questions. |
| Timer expires before student submits | No `GameAnswer` row written → 0 pts for that question. Teacher manually clicks "Next Question". `game:question_ended` sent to all. |
| Teacher closes browser tab | `GameSession` remains `IN_PROGRESS`. On rejoin, `GET /game-sessions/active?sessionId=` returns the live session. Teacher's game tab restores to current question state. |
| Duplicate answer submission | `POST /game-sessions/:id/submit` returns 409 Conflict if `GameAnswer` already exists for `(participantId, questionId)`. First submission wins. |
| Game started when no students present | Valid. Students who join later pick up from current question. |
| Recording starts after game starts | `useGameCapture` watches both `isRecording` and `activeSession` — it activates whenever both are true, regardless of which started first. |

---

## 10. New Files

```
apps/server/src/game/
  game.module.ts
  game-template.controller.ts
  game-template.service.ts
  game-session.controller.ts
  game-session.service.ts
  game.gateway.ts
  dto/
    create-game-template.dto.ts
    update-game-template.dto.ts
    submit-answer.dto.ts

apps/website/
  app/(protected)/games/
    page.tsx                     # game collection list
    new/page.tsx                 # create game form
    [id]/edit/page.tsx           # edit game form
  components/game/
    GameTab.tsx                  # in-meeting game tab (launcher + active views)
    GameLauncher.tsx             # teacher: list of games to start
    GameActiveTeacher.tsx        # teacher: live leaderboard + next question control
    GameActiveStudent.tsx        # student: question + timer + answer input
    GameEnded.tsx                # final leaderboard (both roles)
    GameQuestionEditor.tsx       # question form used in create/edit pages
  hooks/
    useGameSocket.ts
    useGameStore.ts
    useGameCapture.ts
  services/
    game.service.ts              # axios calls to game REST endpoints
  types/
    game.ts                      # GameTemplate, GameSession, GameQuestion, etc.
```

---

## 11. Out of Scope (this iteration)

- Admins viewing other teachers' game templates
- Teacher-defined accepted answer variants for FILL_BLANK (fuzzy match covers this)
- Auto-advance timer (teacher manually clicks Next Question)
- Game session history / analytics
- Sounds or animations (can be added later)
- Mobile-specific layout optimizations
