# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Idest** is an AI-powered English language learning platform. It provides live video tutoring sessions, IELTS writing assessment with ML-based scoring, real-time chat, assignment management, pronunciation feedback, and Stripe-based payments.

## Monorepo Structure

pnpm workspace with these apps:

| App | Tech | Port | Purpose |
|-----|------|------|---------|
| `apps/website` | Next.js 15 + React 19 | 3000 | Frontend |
| `apps/server` | NestJS 11 + PostgreSQL (Prisma) | 8000 | Main API + WebSocket gateway |
| `apps/assignments` | NestJS 11 + MongoDB | 8008 | Assignment CRUD + grading |
| `apps/ai` | FastAPI + Python ML | 8001 | IELTS writing scorer |
| `pronunciation/` | Standalone Python | CLI | Pronunciation assessment MVP |
| `packages/shared` | TypeScript | — | Shared types (`@idest/shared`) |

## Commands

### Root (run from repo root)
```bash
pnpm prep           # Install all dependencies (monorepo-wide)
pnpm dev            # Start all apps in parallel (dev mode)
pnpm build          # Build all apps
pnpm lint           # Lint all apps
pnpm format         # Prettier format
pnpm docker         # Full stack via Docker Compose
pnpm db:generate    # Generate Prisma Client (apps/server)
pnpm db:push        # Push Prisma schema to PostgreSQL
```

### apps/server
```bash
pnpm run dev           # Watch mode
pnpm run test          # Jest unit tests
pnpm run test:e2e      # E2E tests
pnpm run test:watch    # Jest watch
pnpm run prisma:migrate  # Create + apply migration
pnpm run seed          # Seed database
```

### apps/website
```bash
pnpm run dev    # Turbopack dev server
pnpm run build  # Production build
pnpm run lint   # Next.js lint
```

### apps/assignments
```bash
pnpm run dev        # Watch mode
pnpm run test       # Jest unit tests
pnpm run test:e2e   # E2E tests
```

### apps/ai (Python)
```bash
# From repo root:
pnpm python         # Install Python deps (requirements.txt)
# Then inside apps/ai:
uvicorn api:app --reload --port 8001
```

### pronunciation (Standalone Python CLI)
```bash
python main.py --audio voice-sample.wav
```

## Architecture

### Data Flow
1. **Auth**: Supabase issues JWT tokens; the NestJS server validates them via Passport.js guards.
2. **Live Sessions**: LiveKit handles WebRTC video/audio; recordings are egressed to S3.
3. **Real-time Chat**: Socket.io on `apps/server` (`src/conversation/`), stored in PostgreSQL.
4. **Assignment Grading**: Submissions hit `apps/assignments` → published to RabbitMQ → `apps/ai` (ML models) or OpenAI returns scores.
5. **Writing Scoring**: `apps/ai` uses CatBoost/LightGBM models (stored in `/models`) + Transformers for IELTS rubric scoring (Task Achievement, Coherence, Lexical Resource, Grammar Range).

### Key Patterns in `apps/server`
- Each feature is a NestJS module under `src/<feature>/` with controller, service, module, and DTO files.
- `src/common/` holds shared guards, decorators, filters, interceptors, and enums used across modules.
- `src/rabbit/` manages the RabbitMQ connection; `src/grade/` consumes grading results.
- Swagger docs available at `/api` when the server runs.

### Key Patterns in `apps/website`
- Uses Next.js App Router (`app/` directory). Protected routes live under `app/(protected)/`.
- `components/ui/` = Radix UI + Tailwind base primitives. Feature components live in `components/<feature>/`.
- `services/` contains axios-based API clients for each backend service.
- `hooks/` for custom React hooks; `lib/` for utilities and the Supabase browser client.

### Key Patterns in `apps/assignments`
- MongoDB via Mongoose. Modules: `src/assignment/`, `src/grade/`, `src/supabase/`, `src/rabbit/`.
- Consumes RabbitMQ messages for async grading; exposes REST + Swagger at `/api`.

## Environment Variables

Each app needs its own `.env`. See `.env.example` at the repo root for all variables.

Critical variables that must match across `apps/server` and `apps/assignments`:
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RABBITMQ_URL` (default: `amqp://localhost:5672`)

`apps/website` uses `NEXT_PUBLIC_` prefixed variables for all API URLs (server, assignments, WebSocket, LiveKit, TURN server).

## External Services Required

- **PostgreSQL** — main database (`apps/server`)
- **MongoDB** — assignments database (`apps/assignments`)
- **RabbitMQ** — async job queue (quick local start: `docker run -d -p 5672:5672 rabbitmq`)
- **Supabase** — auth and file storage
- **LiveKit** — WebRTC video sessions and egress recording
- **Stripe** — payment processing
- **Cloudinary** — image CDN
- **OpenAI** — fallback AI grading in assignments service
- **Ollama** *(optional)* — local LLM for pronunciation coaching feedback

## Docs

`/docs/` contains design documents for features not yet fully implemented:
- `modules/game/` — gamification system (API, WebSocket gateway, game logic, DB schema)
- `modules/progress-tracking/` — progress tracking system design

These include API contracts, acceptance criteria, and task breakdowns — refer to them when implementing those features.
