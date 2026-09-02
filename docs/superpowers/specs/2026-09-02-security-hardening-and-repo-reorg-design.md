# Security Hardening & Repo Reorganization — Design

- **Date:** 2026-09-02
- **Status:** Approved for planning
- **Branch:** `hardening/security-and-repo-reorg` (single branch, one PR)
- **Author:** pairing session

---

## 1. Overview

Two sequenced efforts on one branch:

1. **Phase 1 — Security & reliability pass.** Fix the full set of security and
   reliability defects found in the project review: one critical (unverified
   JWTs), one severe (self-service privilege escalation at registration), two
   significant (RabbitMQ poison-message handling, unauthenticated paid-API
   proxy), the two failing unit tests on `main`, and the moderate items
   (prod dev-login endpoint, 5xx error-detail leakage, open image proxy,
   permissive CORS on the assignments service, non-constant-time secret
   compare, un-scoped game-session participation, and the
   `403 → 500` exception-rewrap pattern).

2. **Phase 2 — Repo reorganization.** Reduce repo-root clutter, give `docs/` a
   consistent scheme, document (and where safe, relocate) top-level
   directories, tidy within-app layout, and move the misplaced CI workflows to
   the repo root while adding a PR test gate.

Phase 1 commits land first and are individually cherry-pickable. Phase 2
commits stack on top. `tsc` + unit tests must be green before the first Phase 2
commit.

### Goals

- No token that fails signature/expiry validation is ever trusted by any HTTP
  API or WebSocket gateway in `apps/server` or `apps/assignments`.
- A public, unauthenticated caller cannot obtain any role other than `STUDENT`.
- A malformed or permanently-failing queue message cannot loop forever or be
  silently lost.
- Repo layout is navigable: a newcomer can read one document and know what every
  top-level directory is for.
- `apps/*` package directories stay where they are (Docker, Fly, and
  `pnpm-workspace.yaml` pin those paths).

### Non-goals

- Rewriting the frontend auth/session model (Supabase SSR stays as-is).
- Moving `pronunciation/` or restructuring its internals (an active rebuild
  branch, `feat/pronunciation-module-rebuild`, would conflict).
- Moving `scraper/` internals or `apps/ai` / `pronunciation` source layout.
- Introducing Redis or any shared store for the in-memory game/meet state
  (documented as a known limitation only).
- Structured logging migration, dependency version-pinning, or removing the
  `/hehe` proxy — out of scope for this pass (may be follow-ups).
- Any content rewrite of existing `docs/` material — Phase 2 moves files, it
  does not edit them.

---

## 2. Constraints discovered

These pin the current layout and must be respected or updated in lockstep:

| Constraint | Evidence | Consequence |
|---|---|---|
| Docker builds use **monorepo-root context** with explicit per-package `COPY` lines | `apps/server/dockerfile` (`COPY apps/server/package.json …`, `COPY packages/shared/package.json …`, `COPY . .`), `docker-compose.yml` (`context: .` for every service) | `apps/*` and `packages/shared` cannot move; any `COPY` path that changes must be updated in the Dockerfile |
| Fly apps are separate: `ie-backend`, `idest-assignment-microservice` | `apps/server/fly.toml`, `apps/assignments/fly.toml` | Server deploy runs `prisma migrate deploy` as `release_command`; auto-deploy has prod-migration side effects |
| `pnpm-workspace.yaml` globs are `apps/*`, `packages/*` | file contents | `scraper/`, `pronunciation/`, `models/` are **not** workspaces; folding them into `apps/`/`packages/` would make them workspaces (unwanted) |
| The `impeccable` skill loads `PRODUCT.md` and `DESIGN.md` **from repo root** | `.claude/skills/impeccable/SKILL.md` (“Load context (PRODUCT.md / DESIGN.md)… at the project root”) | `PRODUCT.md` / `DESIGN.md` must stay at root |
| `apps/ai` reads artifacts and a dataset by **repo-relative path** | `apps/ai/ielts_ai/paths.py`: `REPO_ROOT/models/rubric_catboost*`, `APPS_AI_DIR.parent/"server"/"data"/"ielts_task2_dataset.json"` | `models/` cannot move without editing `paths.py`; the dataset move (§10.3) requires the same edit |
| `packages/shared` is consumed as **raw TypeScript** (`main: src/index.ts`, no build step) | `packages/shared/package.json` | A runtime module added there needs its npm deps (`jose`) installed where both apps resolve them |
| `apps/assignments` already depends on `@idest/shared` (`workspace:*`) | `apps/assignments/package.json:42` | The shared JWT verifier is reachable from both NestJS apps |
| WebSocket gateways already verify HS256 with `JWT_SECRET` successfully today | `conversation.gateway.ts` (`JWT.verify`), `game.gateway.ts` / `meet.service.ts` (`verifyTokenAsync`) | The Supabase project currently issues HS256 tokens verifiable with `JWT_SECRET`; the JWKS path (§5) is a forward-compatible fallback |

---

## 3. Phase 1 — commit map

| Commit | Fix | Section |
|---|---|---|
| 1 | Shared Supabase JWT verifier (`jose`, HS256 + JWKS) | §5 |
| 2 | `apps/server` `AuthGuard` uses the verifier; gateways migrated | §5 |
| 3 | `apps/assignments` `JwtAuthGuard` uses the verifier; `decode()` fallback removed | §5 |
| 4 | Registration cannot self-assign role | §4 |
| 5 | RabbitMQ consumer reliability (both apps) | §6 |
| 6 | TTS route requires auth + rate limit | §7 |
| 7 | Fix the two failing unit tests | §8 |
| 8 | Moderate hardening bundle (dev-login, error leak, image proxy, CORS, timing-safe compare, game class-scoping, `HttpException` rethrow) | §9 |

Each commit message ends with the `Claude-Session` trailer per repo attribution rules.

---

## 4. Registration privilege escalation (Severe)

### Problem

`POST /user/serverside-create` is `@Public()` and its body DTO (`CredDto`,
`apps/server/src/user/dto/cred.dto.ts`) accepts `role: Role` validated only by
`@IsEnum(Role)`, where `Role` includes `ADMIN` and `TEACHER`.
`UserService.createUserWithCredentials` writes `credentials.role` straight into
both Supabase user metadata and `prisma.user.create({ data: { role } })`. Any
anonymous caller can create an `ADMIN` account.

### Change

- **`apps/server/src/user/dto/cred.dto.ts`** — remove the `role` field entirely
  (and its `@ApiProperty`).
- **`apps/server/src/user/user.service.ts` → `createUserWithCredentials`** —
  hardcode `role: Role.STUDENT` for both the Supabase `signUp` metadata and the
  Prisma create. Do not read any role from input.
- **`apps/server/src/user/user.controller.ts`** — no signature change;
  the `serverside-create` handler keeps taking `CredDto` (now role-free).
- **`apps/website/components/sign-up-form.tsx`** — stop sending `role` in the
  request body. Remove the role `Select` from the form (students are the only
  self-service registrants). This also resolves the pre-existing
  lowercase-`"student"` vs enum-`STUDENT` contract mismatch.
- Teacher/admin provisioning path is unchanged: an existing `ADMIN` promotes a
  user via `PUT /user/:id` (`UserService.updateUser`, which already gates
  `role`/`isActive` changes to admins).

### Tests

- `apps/server/src/user/user.service.spec.ts` (create if absent): calling
  `createUserWithCredentials` with any object → the persisted user has
  `role === 'STUDENT'`; a supplied `role: 'ADMIN'` is ignored.
- DTO validation test: a body containing `role` is rejected by
  `forbidNonWhitelisted` (the global `ValidationPipe` already sets it), or is
  silently stripped — assert the resulting persisted role is `STUDENT` either
  way.

### Risk

Low. If any internal tooling relied on `serverside-create` to make non-student
accounts, it breaks intentionally; document in the PR that admin/teacher
creation is now `PUT /user/:id` by an admin, or a direct DB/seed operation.

---

## 5. JWT verification (Critical) + verifier consolidation

### Problem

- **`apps/server/src/common/guard/auth.guard.ts`** — `AuthGuard.canActivate`
  calls `decode(token, { complete: false })`. No signature check, no `exp`
  check. A forged `{ "sub": "<any user id>" }` authenticates as that user; the
  guard then loads that user's real role from the DB. A correct
  `verifyTokenAsync` (HS256 + issuer) is exported from the *same file* but only
  the gateways use it.
- **`apps/assignments/src/guards/jwt-auth.guard.ts`** — tries
  `jwtService.verifyAsync` then **falls back to `decode()`** on failure, so
  unsigned tokens are accepted.
- Four divergent implementations exist: `auth.guard.ts` (`decode`),
  `conversation.gateway.ts` (`JWT.verify`), `game.gateway.ts` +
  `meet.service.ts` (`verifyTokenAsync`), `assignments/jwt-auth.guard.ts`
  (verify-then-decode).

### Design — one shared verifier

New module: **`packages/shared/src/auth/verify-supabase-jwt.ts`**, exported from
`packages/shared/src/index.ts` (or a subpath `@idest/shared/auth` if the index
barrel is kept type-only — implementation chooses; must be importable from both
NestJS apps).

```
verifySupabaseJwt(token: string, opts: {
  jwtSecret?: string;      // process.env.JWT_SECRET
  supabaseUrl?: string;    // process.env.SUPABASE_URL
  issuer?: string;         // process.env.JWT_ISSUER (HS256 path)
}): Promise<SupabaseJwtPayload>   // { sub: string, email?: string, role?: string, ... }
```

Verification order:

1. **HS256** — if `jwtSecret` is set: `jose.jwtVerify(token, secretKey, {
   algorithms: ['HS256'], issuer })`. `exp` / `nbf` are enforced by `jose`.
   On success, return the payload.
2. **JWKS fallback** — on HS256 failure (or if `jwtSecret` is unset) and if
   `supabaseUrl` is set: verify against a module-level
   `createRemoteJWKSet(new URL(\`${supabaseUrl}/auth/v1/.well-known/jwks.json\`))`
   with `{ algorithms: ['RS256','ES256'], issuer: \`${supabaseUrl}/auth/v1\` }`.
   `createRemoteJWKSet` handles key caching + rotation internally.
3. Both fail → throw a typed `JwtVerificationError` (message distinguishes
   `expired` from `invalid` where `jose` error codes allow).

Notes:

- **New dependency `jose`** added to `packages/shared/package.json`,
  `apps/server/package.json`, and `apps/assignments/package.json` (explicit in
  both apps so the Docker `pnpm install --frozen-lockfile` + `COPY node_modules`
  flow ships it). `jose` is pure-JS, no native build.
- Payload shape lives in `packages/shared` as `SupabaseJwtPayload`.
- The verifier does **not** touch the database. Callers keep doing their own
  user lookup / `is_active` check.

### Call-site changes

| File | Before | After |
|---|---|---|
| `apps/server/src/common/guard/auth.guard.ts` | `decode()` | `await verifySupabaseJwt(token, …)`; keep the existing `prisma.user.findUnique` + `is_active` check + `req.user` assembly (`role` from DB stays source of truth). Delete the local `verifyTokenAsync` **or** re-export it as a thin wrapper around `verifySupabaseJwt` for one release to avoid churn — implementation chooses; final state has no second implementation. |
| `apps/server/src/meet/meet.service.ts` → `validateToken` | `verifyTokenAsync(token, JWT_SECRET)` | `verifySupabaseJwt(token, …)` |
| `apps/server/src/game/game.gateway.ts` → `handleConnection` | `verifyTokenAsync(...)` | `verifySupabaseJwt(...)` |
| `apps/server/src/conversation/conversation.gateway.ts` → `afterInit` middleware | `JWT.verify(token, jwtSecret)` | `verifySupabaseJwt(token, …)` |
| `apps/assignments/src/guards/jwt-auth.guard.ts` | verify-then-`decode()` fallback | `verifySupabaseJwt(token, …)` only; keep the optional internal-HS256 path **only if** it also fully verifies (it does — `jwtService.verifyAsync`); remove the `decode()` branch entirely |

`jsonwebtoken` / `@nestjs/jwt` imports that become unused are removed. If
`jsonwebtoken` is still used elsewhere (e.g. Stripe or LiveKit SDKs bring their
own), leave the dependency; only remove dead imports.

### Environment

No new required env vars. `JWT_SECRET`, `SUPABASE_URL`, `JWT_ISSUER` already
exist in `.env.example`. Update `.env.example` comments to note that
`SUPABASE_URL` is now also used for JWT verification (JWKS).

`apps/server/src/main.ts` currently hard-requires `['DATABASE_URL','JWT_SECRET']`.
Keep `JWT_SECRET` required (HS256 remains the primary path) but document that
`SUPABASE_URL` enables the fallback.

### Tests

New spec `packages/shared/src/auth/verify-supabase-jwt.spec.ts`:

- Sign a token with a test HS256 secret → verifies; returns `sub`.
- Tamper one byte of the signature → throws.
- `exp` in the past → throws (`expired`).
- Wrong `issuer` → throws.
- HS256 disabled (`jwtSecret` undefined) + a mocked JWKS endpoint serving a
  generated RSA public key, token signed with the matching private key →
  verifies. (Mock `fetch` / use `jose`'s `createLocalJWKSet` seam — implementer
  picks; the JWKS URL fetch must be stubbed, no network in tests.)

Update `apps/server` guard specs (`auth.guard` is currently exercised
indirectly): add a direct `AuthGuard` spec — forged token → `UnauthorizedException`;
valid token for an inactive user → `UnauthorizedException`; valid token for an
active user → `true` and `req.user.role` comes from the DB row.

Update `apps/assignments` — add a `JwtAuthGuard` spec: unsigned token → 401.

### Risk

- **If the Supabase project issues tokens that are neither HS256-with-`JWT_SECRET`
  nor served by the standard JWKS URL**, all logins break. Mitigation: the three
  gateways verify HS256 with `JWT_SECRET` in the current running code, so HS256
  is known-good today; the JWKS path only adds coverage. The `SMOKE-TEST.md`
  step "log in with a real account, call `GET /user`" is the merge gate.
- `jose` ESM/CJS interop under the NestJS CommonJS build: `jose` ships CJS
  entrypoints for the versions in use; if the Nest build chokes, pin to a
  `jose` version with CJS support (implementer verifies `tsc` + `nest build`).

---

## 6. RabbitMQ consumer reliability (Significant)

### Problem

- **`apps/assignments/src/rabbit/rabbit.service.ts`** (`consume`, ~line 120):
  on any callback error → `this.channel.nack(msg, false, true)` — unconditional
  requeue, no attempt cap, no dead-letter. A deterministically-failing message
  (bad payload, missing assignment) loops forever and starves the queue.
  `apps/assignments/src/grade/grade.service.ts` `processGradeMessage` re-throws
  on every error "to requeue".
- **`apps/server/src/rabbit/rabbit.service.ts`** (`consume`, ~line 20): calls
  `callback(data)` then `ack(msg)` with **no try/catch** — a throwing callback
  leaves the message unacked (stuck) and never nacked.

### Change

Introduce a small shared helper pattern (not necessarily shared code — the two
`rabbit.service.ts` files are per-app and may each implement it):

- Wrap each delivery in `try/catch`.
- On success → `ack`.
- On failure:
  - Read the redelivery count from the `x-death` header (set by the broker when
    a message is dead-lettered and re-published) **or** an app-set
    `x-attempts` header; default 0.
  - If attempts `< MAX_ATTEMPTS` (constant, default **3**) **and** the error is
    classified transient (connection reset, timeout, `ECONNREFUSED`,
    5xx from a downstream) → `nack(msg, false, false)` and re-publish to the
    same queue with `x-attempts` incremented and a short delay
    (publish to a `*.retry` queue with per-message TTL that dead-letters back,
    or `setTimeout` + re-publish if a delay queue is overkill — implementer
    picks the simplest that works with the current broker setup, preferring the
    option that adds the fewest new exchange/queue declarations).
  - Otherwise (attempts exhausted, or a non-transient error such as validation
    / "not found" / JSON parse) → `nack(msg, false, false)` so the message goes
    to the queue's dead-letter exchange.
- Declare a dead-letter exchange + queue per consumer queue:
  `grade_queue` → DLX `grade_queue.dlx` → `grade_queue.dead`. Same for the
  server's queues. Assert them in the same place queues are currently asserted.
- `grade.service.ts` `processGradeMessage`: stop blanket-re-throwing. Throw a
  typed `TransientGradingError` only for genuinely retryable failures; for
  `Unknown skill type` and validation failures, log and return (message will be
  dead-lettered by the consumer wrapper, not retried).

### Config

New optional env, documented in `.env.example`, with defaults so nothing breaks
if unset: `RABBIT_MAX_ATTEMPTS=3`, `RABBIT_RETRY_DELAY_MS=5000`.

### Tests

- `apps/assignments/src/rabbit/rabbit.service.spec.ts` (create): a callback that
  throws a non-transient error → `nack(msg, false, false)` called once, no
  re-publish. A callback that throws a transient error twice then succeeds →
  re-published twice with incrementing attempts, then acked. Attempts at the cap
  → dead-lettered.
- `apps/server/src/rabbit/rabbit.service.spec.ts` (already exists): add a case —
  throwing callback → message is nacked (not left unacked).
- `grade.service.spec.ts` (create or extend): `Unknown skill type` → no throw,
  logged; downstream transient failure → `TransientGradingError`.

### Risk

Medium-ish surface but well-contained. The retry-queue mechanism must match the
broker topology already in use; if the current code uses a plain queue with no
exchange, adding a DLX is a one-time `assertExchange`/`assertQueue` addition.
Verify no existing consumer depends on infinite-requeue behavior (none should).

---

## 7. Unauthenticated TTS proxy (Significant)

### Problem

`apps/website/app/api/tts/route.ts` is a public `POST` route that forwards
arbitrary text to OpenAI `audio/speech` using a server-side `OPENAI_API_KEY`,
with no auth and no rate limit → cost-based abuse / DoS.

### Change

- Require an authenticated Supabase session: build a server client from request
  cookies (mirror `apps/website/lib/supabase/middleware.ts` /
  `lib/supabase/server`), call `supabase.auth.getClaims()` (or `getUser()`);
  no user → `401`.
- Add a lightweight rate limit keyed by user id (fallback to IP): in-memory
  fixed-window or token bucket, e.g. **20 requests / 5 min / user**. A module-
  level `Map` is acceptable for a single-instance deployment; document the
  single-instance assumption in a comment (consistent with the existing
  in-memory game/meet state). If the app already has a rate-limit util, reuse
  it.
- Cap input length (e.g. reject `text.length > 4000`) before calling OpenAI.
- Keep the existing behavior for authenticated callers unchanged.

### Tests

Website has no test harness today; do **not** stand one up for this. Instead:
- Add a `SMOKE-TEST.md` item: `curl -XPOST /api/tts` with no cookie → 401;
  with a valid session → 200 audio; 25 rapid calls → some 429.
- Inline code comments state the limit and the single-instance caveat.

### Risk

Low. The only behavioral change for real users is the length cap and the rate
limit ceiling; both are generous.

---

## 8. Fix the two failing unit tests (Significant)

`pnpm --filter idest-server test` on `main` → **2 failed / 294 passed**.

### 8.1 `apps/server/src/stripe/stripe.service.spec.ts`

Fails with `STRIPE_SECRET_KEY is not configured` — the spec instantiates
`StripeService` whose constructor throws when the key is absent from the test
env.

**Fix:** provide a mock `ConfigService` in the testing module that returns a
dummy `STRIPE_SECRET_KEY` (and any other keys the constructor reads), so the
service constructs without touching `process.env`. Do not rely on a real env
var in tests.

### 8.2 `apps/server/src/game/game-session.service.spec.ts` — "auto-advances question when timer fires"

Fails: `mockPrisma.gameSession.updateMany` expected to be called with
`{ data: { currentQuestionIndex: 1 } }`, actual calls: 0. The test drives the
`setTimeout`-based `scheduleAutoAdvance` → `endCurrentQuestion` →
(advance) path and the scheduled callback never resolves within the test.

**Fix:** use `jest.useFakeTimers()`, trigger `jest.advanceTimersByTime(...)` (or
`jest.runOnlyPendingTimers()`), and `await` the async chain (flush
microtasks) before asserting. Ensure timers are restored in `afterEach`.
If the production code's auto-advance genuinely doesn't call `updateMany` in the
tested state, treat it as a real bug and fix the code — but first confirmation
is that this is a test-timing issue.

### Verification

`pnpm --filter idest-server test` → 296 passed / 0 failed. Add to CI (§10.7).

---

## 9. Moderate hardening bundle (one commit)

### 9.1 Production dev-login endpoint

`apps/server/src/app.controller.ts` `@Post('jwt')` → `AppService.getDevJwt`
signs into a shared Supabase dev account and returns a real `access_token`.
`AppController` has no guard. Gated only by `SecretPassword !== SECRET_PASS`
(plain `!==`).

**Change:**
- `getDevJwt` throws `ForbiddenException` immediately when
  `process.env.NODE_ENV === 'production'`.
- Replace the comparison with a constant-time check:
  `crypto.timingSafeEqual(Buffer.from(input), Buffer.from(secret))` guarded by a
  length pre-check (return 403 on length mismatch without leaking timing).
- Keep the endpoint functional in non-prod for the smoke-test workflow.

### 9.2 5xx error-detail leakage

`apps/server/src/common/filters/exception.filter.ts` returns raw
`exception.message` in `details` for every `status >= 500`.

**Change:** include `details` only when `process.env.NODE_ENV !== 'production'`.
Always `Logger.error(message, stack)` server-side (inject/instantiate a Nest
`Logger`). The client-facing body for 5xx in prod is
`{ status:false, message:'Internal server error', data:null, statusCode:500 }`.

### 9.3 Open Next.js image proxy

`apps/website/next.config.ts` sets `images.remotePatterns` with
`hostname: "**"` for both `http` and `https`.

**Change:** delete the two wildcard entries. Keep the explicit hosts already
listed (`*.supabase.co` storage, `lh3.googleusercontent.com`,
`s4-media1.study4.com`, `i.pinimg.com`, `images.unsplash.com`) and add the
Cloudinary host used by the backend (`res.cloudinary.com`). If a needed host
surfaces during smoke-testing, add it explicitly.

### 9.4 Permissive CORS on the assignments service

`apps/assignments/src/main.ts` — `enableCors({ origin: true, credentials: true })`
("DEMO MODE").

**Change:** parse `CORS_ORIGINS` (comma-separated) from env into an allowlist,
mirroring `apps/server/src/main.ts`. Default to
`['http://localhost:3000']` when unset. Add `CORS_ORIGINS` to the
`apps/assignments` section of `.env.example` (it currently only appears under
`apps/server`).

### 9.5 Game-session participation not class-scoped

`apps/server/src/game/game-session.service.ts` `submitAnswer` (and the join
path) `upsert`s a `GameParticipant` for any authenticated `userId` that knows a
`gameSessionId`. No check that the user belongs to the class hosting the
meeting.

**Change:** before creating/upserting a participant, resolve
`gameSession.sessionId` → meeting `Session.class_id` (`prisma.session.findUnique`)
→ `checkClassAccessById(classId, userId, prisma)` (from
`apps/server/src/class/class.util.ts`). Reject with `ForbiddenException` if the
user is not creator/teacher/active-student/admin of that class. Apply the same
check in `GameSessionService.joinSession` (or wherever the WS `game:join_room`
path lands on the service) and in any REST controller that adds a participant.

**Tests:** `game-session.service.spec.ts` — a `userId` with no class membership
calling `submitAnswer` → `ForbiddenException`; an active student of the class →
succeeds (existing happy-path tests get a membership stub added to the mock).

### 9.6 `403 → 500` exception-rewrap pattern

Multiple service `catch` blocks re-throw only a subset of Nest exceptions and
wrap everything else in `InternalServerErrorException`, so `ForbiddenException`
/ `ConflictException` surface as HTTP 500. Confirmed in
`apps/server/src/user/user.service.ts` (`updateUser`); the pattern recurs.

**Change:** in every `catch` block that re-wraps, add as the first line:

```ts
if (error instanceof HttpException) throw error;
```

Scope: `apps/server/src/{user,class,session,stripe,game,conversation}` services
(grep for `new InternalServerErrorException(` and `catch (`). Do not change
control flow otherwise. Add/extend a spec per touched service asserting that a
thrown `ForbiddenException` propagates as 403 (e.g. `updateUser` by a
non-admin on another user → 403, not 500).

### Risk

Low individually. 11.6 is broad (many files) but mechanical and `tsc`- +
test-verified.

---

## 10. Phase 2 — Repo reorganization

All moves use `git mv` so history follows. After each move-set: `tsc`
(affected apps), `pnpm test` (server + assignments), `docker compose config`,
and a grep sweep for stale path strings.

### 10.1 Root cleanup

**Stay at root** (do not move): `README.md`, `CLAUDE.md`, `PRODUCT.md`,
`DESIGN.md` (impeccable-skill contract), `package.json`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `.npmrc`, `docker-compose.yml`, `.gitignore`, `.dockerignore`,
`skills-lock.json`.

**Moves / cleanup:**

| Item | Action |
|---|---|
| `DC_KLTN_23520455&23521137_TS.NguyenThiXuanHuong.docx` / `.pdf` (untracked) | `mkdir -p docs/thesis/`, move both in, `git add` (commit — they are project deliverables). Rename to ASCII-safe filenames, e.g. `docs/thesis/KLTN-23520455-23521137.docx` / `.pdf`. |
| `llm_features.csv` (tracked; added in commit 252daaa; **grep-confirmed no live reader** — code uses `apps/ai/cache/*.parquet`) | `git mv llm_features.csv apps/ai/data/llm_features.csv`. Add `apps/ai/data/` to nothing special; keep tracked as a reference artifact. If the implementer confirms it is truly dead, delete instead and note it in the PR. |
| `.DS_Store` (untracked; already matched by `.gitignore` line 43) | No action needed. Confirm `git ls-files .DS_Store` is empty. |
| New: `docs/repo-structure.md` | Author it (see §10.6). |
| `README.md` | Add a "Repository layout" section linking to `docs/repo-structure.md` and naming every top-level dir. |

### 10.2 `docs/` restructure (moves only, no content edits)

Before → after:

```
docs/game-module/                  → docs/modules/game/
docs/progress-tracking-module/     → docs/modules/progress-tracking/
docs/progress-tracking-module.md   → docs/modules/progress-tracking/README.md
docs/superpowers/specs/            → docs/specs/            (existing design docs)
docs/superpowers/plans/            → unchanged (gitignored agent scratch)
docs/superpowers/                  → keep dir for plans/ only; add docs/superpowers/README.md
                                     ("agent working files; not authoritative")
(new)                              → docs/architecture/  (holds repo-structure.md,
                                     plus a short system-overview.md authored from
                                     the existing root README architecture notes —
                                     new file, not a move)
(new)                              → docs/thesis/  (§10.1)
```

Update any relative links between moved docs (grep `](` within `docs/` for
`game-module`, `progress-tracking-module`, `superpowers/specs`). `CLAUDE.md`
references `/docs/game-module/` and `/docs/progress-tracking-module/` — update
those two paths to the new locations.

This spec file itself lives at `docs/superpowers/specs/` and moves to
`docs/specs/` with the rest.

### 10.3 Top-level non-app directories

| Dir | Decision | Action |
|---|---|---|
| `models/` | Keep in place (pinned by `apps/ai/ielts_ai/paths.py`) | Document in `docs/repo-structure.md` as "CatBoost/LightGBM artifacts consumed by `apps/ai` via `paths.py`". No move. |
| `pronunciation/` | Keep at root (active; `feat/pronunciation-module-rebuild` branch) | Document. Add/refresh `pronunciation/README.md` (one paragraph: what it is, that it is a standalone CLI, link to its design doc). No internal changes. |
| `scraper/` | Keep at root (active) | Document. Add `scraper/README.md` (what it scrapes, where output lands, how to run). `scraper/output/` — confirm it is gitignored or intentionally tracked; if large generated data is tracked, add a `.gitignore` entry and note it. No internal changes. |

**Cross-app data coupling fix:** `apps/ai/ielts_ai/paths.py` reads
`APPS_AI_DIR.parent / "server" / "data" / "ielts_task2_dataset.json"`.

- `git mv apps/server/data/ielts_task2_dataset.json apps/ai/data/ielts_task2_dataset.json`.
- Update `paths.py`: `CRAWLED_DATA_PATH = APPS_AI_DIR / "data" / "ielts_task2_dataset.json"`.
- Grep the whole repo for `ielts_task2_dataset` and `server/data` /
  `server", "data"` — update every reference (the server's `scripts/` crawler
  writes it: `apps/server/scripts/crawl-ielts-task2.js` and the
  `crawl:ielts-task2` npm script — repoint its output path, or leave the
  crawler writing to `apps/server/data/` and add a copy step; implementer picks,
  but the runtime read path in `apps/ai` must resolve).
- If `apps/server/data/` becomes empty, remove it.

### 10.4 Within-app tidy — `apps/server`

**`src/common/` → standardize to plural, consistent names:**

```
src/common/decorator/     → src/common/decorators/
src/common/guard/         → src/common/guards/
src/common/filters/       → src/common/filters/        (already plural)
src/common/interceptors/  → src/common/interceptors/   (already plural)
src/common/enum/          → src/common/enums/
src/common/dto/           → src/common/dtos/
src/common/types/         → src/common/types/          (already fine)
```

`git mv` each file; then rewrite imports. Imports use the `src/...` alias
(`moduleNameMapper: ^src/(.*)$`) and relative paths — a repo-wide search-replace
of `common/decorator/` → `common/decorators/` etc. across `apps/server/src`,
followed by `tsc -p tsconfig.build.json --noEmit` until clean. The
`ROLES_KEY` / decorator public API is unchanged.

**`src/game/` flat → per-feature subfolders:**

```
src/game/
  session/     game-session.controller.ts, game-session.service.ts, game-session.service.spec.ts
  template/    game-template.controller.ts, game-template.service.ts, game-template.service.spec.ts
  achievement/ achievement.controller.ts, achievement.service.ts, achievement.service.spec.ts
  stats/       class-stats.service.ts, class-stats.service.spec.ts
  dto/         (unchanged)
  game.gateway.ts        (stays at game/ root)
  game.module.ts         (stays at game/ root; update relative imports to ./session/… etc.)
```

`git mv`, then fix relative imports in the moved files and in `game.module.ts`.
`tsc` + `pnpm --filter idest-server test` green.

**Dockerfile casing:** `git mv apps/server/dockerfile apps/server/Dockerfile`.
Update `docker-compose.yml` (`dockerfile: apps/server/dockerfile` →
`apps/server/Dockerfile`). Confirm `apps/server/fly.toml` `[build]` does not
name the dockerfile (it does not); if Fly auto-detection is case-sensitive on
the remote builder, `Dockerfile` is the safe casing.

**`apps/server/scripts/`:** add `apps/server/scripts/README.md` (what each
script does, required env). No moves.

### 10.5 Within-app tidy — `apps/website`

| Before | After |
|---|---|
| `app/_components/LandingRoot.tsx` | `components/landing/LandingRoot.tsx` — delete the `app/_components/` dir; update the import in `app/page.tsx` (and any other referrer — grep `_components`). |
| `components/sign-up-form.tsx` (loose at `components/` root) | `components/auth/sign-up-form.tsx` — update `app/auth/sign-up/page.tsx` import; grep `sign-up-form`. |

Also (part of §4): the same `sign-up-form.tsx` edit removes the role selector and
the hardcoded `https://ie-backend.fly.dev/...` URL is replaced with
`${process.env.NEXT_PUBLIC_API_URL}/user/serverside-create` (bring it in line
with the `services/http.ts` pattern).

`tsc --noEmit` (website tsconfig) + `next lint` clean.

### 10.6 `docs/repo-structure.md` (new)

One page. Sections:

- **Top-level map** — table: `apps/website`, `apps/server`, `apps/assignments`,
  `apps/ai`, `packages/shared`, `pronunciation/`, `scraper/`, `models/`,
  `docs/`, plus the root tooling files (`PRODUCT.md`/`DESIGN.md` note the
  impeccable-skill dependency).
- **Why `apps/*` can't move** — the Docker/Fly/pnpm pin (link §2).
- **`docs/` scheme** — `architecture/`, `modules/`, `specs/`, `thesis/`,
  `superpowers/`.
- **Build/deploy path references** — the list of files that hardcode layout
  (Dockerfiles, `docker-compose.yml`, `fly.toml`, `.dockerignore`, CI, and
  `apps/ai/ielts_ai/paths.py`), so the next person editing layout knows what to
  update.

### 10.7 CI relocation + test gate

New `.github/workflows/` at repo root (currently none):

**`ci.yml`** — on `pull_request` (and `push` to non-`main` branches):
```
- checkout
- setup pnpm + node (match Dockerfile: node 22, pnpm 10)
- pnpm install --frozen-lockfile
- pnpm --filter idest-server exec prisma generate
- pnpm -r lint            # tolerate existing lint debt: see note
- tsc -p apps/server/tsconfig.build.json --noEmit
- pnpm --filter idest-server test
- pnpm --filter idest-assignments test
```
Note: if `pnpm -r lint` fails on pre-existing issues in apps not touched here,
scope the CI lint step to `apps/server` + `apps/assignments` or mark it
`continue-on-error: true` for the first iteration and open a follow-up. The
**test + tsc steps must be blocking.**

**`deploy-server.yml`** — moved from `apps/server/.github/workflows/fly-deploy.yml`.
Trigger: `push` to `main` with `paths: ['apps/server/**', 'packages/shared/**', '.github/workflows/deploy-server.yml']`.
Body unchanged (`flyctl deploy --remote-only` — needs `fly.toml`; set
`working-directory: apps/server` or pass `--config apps/server/fly.toml
--dockerfile apps/server/Dockerfile` with root context).

**`deploy-assignments.yml`** — moved from
`apps/assignments/.github/workflows/fly-deploy.yml`. Trigger: `push` to `main`
with `paths: ['apps/assignments/**', '.github/workflows/deploy-assignments.yml']`.

Delete the now-empty `apps/server/.github/` and `apps/assignments/.github/`.

**Operator action required (call out in PR description + `SMOKE-TEST.md`):**
add `FLY_API_TOKEN` to GitHub repo secrets before merging to `main`, or both
deploy workflows fail on the first post-merge push. The server deploy runs
`prisma migrate deploy` against the production database (existing `fly.toml`
`release_command`) — this is unchanged behavior but now triggers automatically.

---

## 11. Verification plan

### Automated (implementer runs; CI enforces going forward)

- `pnpm --filter idest-server exec prisma generate`
- `tsc -p apps/server/tsconfig.build.json --noEmit` → clean
- `tsc --noEmit` for `apps/website` and `packages/shared`
- `pnpm --filter idest-server test` → **296 passed, 0 failed** (was 294/2)
- `pnpm --filter idest-assignments test` → green (existing 11 + new rabbit/grade specs)
- `pnpm --filter @idest/shared test` → new verifier spec green
- `docker compose config` → parses after the Dockerfile rename + dataset move
- Grep sweep (must return only intended hits) for: `apps/server/dockerfile`,
  `server/data/ielts_task2_dataset`, `game-module`, `progress-tracking-module`,
  `common/decorator/`, `common/guard/`, `common/enum/`, `_components`,
  `ie-backend.fly.dev`, `decode(` (in `apps/server`/`apps/assignments` auth
  code), `origin: true`, `hostname: "**"`.

### Manual — `SMOKE-TEST.md` (operator runs against dev before merge)

1. Log in with a real Supabase account in the web app → `GET /user` returns the
   profile (JWT verification regression check — HS256 path).
2. `curl` `GET /user` with a hand-forged token (`{"sub":"<real id>"}`, no or
   invalid signature) → **401**. With an expired token → **401**.
3. `curl POST /user/serverside-create` with `"role":"ADMIN"` in the body →
   created user has role `STUDENT` (or request rejected); no admin created.
4. Web sign-up form completes and creates a `STUDENT`.
5. `POST /api/tts` with no session → **401**; with a session → audio; ~25 rapid
   calls → some **429**.
6. Join a game session as a user who is **not** in the hosting class → answer
   submission **403**; as an enrolled student → works.
7. In dev, `POST /jwt` with the correct `SECRET_PASS` still returns a token;
   confirm the code path is dead when `NODE_ENV=production`.
8. Trigger a grading message with a bad payload → it lands in
   `grade_queue.dead` after ≤3 attempts, queue keeps flowing.
9. `docker compose up --build` → all services healthy.
10. (post-merge) Confirm `FLY_API_TOKEN` secret is set; watch the first
    `deploy-server` / `deploy-assignments` runs.

---

## 12. Rollout

1. Branch `hardening/security-and-repo-reorg` from `main`.
2. Phase 1 commits 1–8 (§3), each green on `tsc` + relevant tests.
3. Gate: full automated verification (§11) green.
4. Phase 2 commits: (a) root cleanup, (b) `docs/` moves, (c) top-level dir docs
   + dataset move, (d) server within-app, (e) website within-app, (f) CI
   relocation + `repo-structure.md`. Re-run automated verification after (c),
   (d), (e), (f).
5. Author `SMOKE-TEST.md` at repo root (or `docs/`), listing §11 manual steps.
6. Open one PR. Description: summary of security fixes, the `FLY_API_TOKEN`
   operator action, and a note that admin/teacher accounts are now created only
   via `PUT /user/:id` or seed.
7. Operator runs `SMOKE-TEST.md`, sets the GitHub secret, merges.

---

## 13. Risks & mitigations (summary)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase tokens not verifiable by HS256 **or** standard JWKS → all logins 401 | Low (HS256 proven in current gateway code) | JWKS fallback; `SMOKE-TEST.md` step 1 is the merge gate; revert commit 2 is isolated |
| `jose` CJS/ESM interop breaks the Nest build | Low | `tsc` + `nest build` in verification; pin a CJS-compatible `jose` version |
| RabbitMQ retry topology mismatch with current broker setup | Medium | Implement the simplest retry that works with existing `assertQueue` usage; spec'd tests cover cap + dead-letter |
| §9.6 `HttpException` rethrow touches many files | Medium (churn only) | Mechanical change; per-service spec asserting 403 propagates; `tsc` + tests |
| CI relocation auto-deploys on merge to `main` with prod migrations | Certain (by design) | `paths:` filters; explicit operator action for `FLY_API_TOKEN`; documented in PR + smoke test |
| Within-app import rewrites conflict with in-flight branches | Low | `pronunciation/` untouched; single branch; `git mv` preserves history; land promptly |
| `docs/` link rot after moves | Low | Grep sweep for `game-module` / `progress-tracking-module` / `superpowers/specs`; update `CLAUDE.md` |

---

## 14. Decisions on record

- **Scope:** full security + reliability pass (not the lighter 2-issue patch;
  not the heavier pass that also pins deps / adds structured logging / removes
  `/hehe`).
- **Branching:** one branch, sequenced commits, one PR (security first).
- **Verification:** unit tests + `tsc` by the implementer now; operator
  smoke-tests before merge (no live-stack e2e in this effort).
- **Auth:** shared verifier in `packages/shared`, `jose`, HS256 primary with
  **JWKS fallback**.
- **Reorg targets:** all four (root clutter, top-level dirs, `docs/`,
  within-app), with `apps/*` package roots fixed in place.
- **Top-level dirs:** `models/`, `scraper/`, `pronunciation/` are documented and
  left in place; only the `apps/server/data` → `apps/ai/data` dataset moves.
- **Thesis files:** moved to `docs/thesis/` and committed.
- **Within-app churn:** source moves + import rewrites permitted, `tsc`-verified.
- **CI:** deploy workflows relocated to repo root **and** a blocking PR test
  gate added.
