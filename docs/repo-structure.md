# Repository structure

The map of this monorepo and the rules about which directories may move. If you
relocate anything under `apps/` or `packages/`, read section 4 first — several
build and deploy files hardcode these paths and must change in lockstep.

## 1. Top-level map

| Path | Purpose |
|------|---------|
| `apps/website` | Next.js 15 / React 19 frontend (port 3000). pnpm workspace package. |
| `apps/server` | Main NestJS API + Socket.io gateway, Prisma + PostgreSQL (port 8000). pnpm workspace package. Deployed to Fly as `ie-backend`. |
| `apps/assignments` | NestJS assignment CRUD + grading service, MongoDB (port 8008). pnpm workspace package. Deployed to Fly as `idest-assignment-microservice`. |
| `apps/ai` | FastAPI + Python ML service for IELTS writing scoring (port 8001). Not a pnpm package; own `requirements.txt`. |
| `packages/shared` | Shared TypeScript types, published in-workspace as `@idest/shared`. pnpm workspace package. |
| `pronunciation/` | Standalone Python pronunciation-assessment CLI (`python main.py --audio …`). Not a workspace; not built by Docker. See `pronunciation/README.md`. |
| `scraper/` | Standalone Node scraper for study4.com practice tests. Not a workspace. Output lands in `scraper/output/`. See `scraper/README.md`. |
| `models/` | CatBoost / LightGBM artifacts consumed by `apps/ai` via `ielts_ai/paths.py` (`rubric_catboost/`, `rubric_catboost_task1/`). Copied into the AI image. |
| `docs/` | All project documentation. Layout in section 3. |
| `README.md` | Entry point: prerequisites, setup, run instructions. |
| `CLAUDE.md` | Guidance for Claude Code agents working in this repo. |
| `PRODUCT.md` | Product brief. Stays at repo root — the `impeccable` skill loads it from there. |
| `DESIGN.md` | Design-system contract. Stays at repo root — the `impeccable` skill loads it from there. |
| `docker-compose.yml` | Full-stack local orchestration. Root context for every service (see section 2). |
| `pnpm-workspace.yaml` | Declares the workspace globs `apps/*` and `packages/*`. |

Other root files that stay put: `package.json`, `pnpm-lock.yaml`, `.npmrc`,
`.gitignore`, `.dockerignore`, `skills-lock.json`.

## 2. Why `apps/*` and `packages/*` cannot move

The workspace layout is pinned in multiple places that resolve paths literally,
not by discovery:

- **`pnpm-workspace.yaml`** globs exactly `apps/*` and `packages/*`. A package
  outside those two directories is not part of the workspace.
- **`docker-compose.yml`** builds every service with `context: .` (the repo
  root) and `dockerfile: apps/<name>/Dockerfile`. Each Node `Dockerfile`
  (`server`, `assignments`, `website`) then runs explicit
  `COPY apps/server/package.json …`, `COPY apps/assignments/package.json …`,
  `COPY apps/website/package.json …`, `COPY packages/shared/package.json …`
  lines before `COPY . .`, and copies `apps/<name>` + `packages/shared` into the
  runtime stage. `apps/ai/Dockerfile` does `COPY apps/ai …` and
  `COPY models ./models`.
- **`apps/server/fly.toml`** (`app = 'ie-backend'`) and
  **`apps/assignments/fly.toml`** (`app = 'idest-assignment-microservice'`) are
  per-app Fly configs read from those directories; the server config also runs
  `npx prisma migrate deploy` as its release command.
- **`apps/ai/ielts_ai/paths.py`** derives `APPS_AI_DIR` and `REPO_ROOT` by
  walking up from its own file location, then reads `REPO_ROOT/models/…` for the
  rubric artifacts and `APPS_AI_DIR/data/ielts_task2_dataset.json` for the
  crawled dataset. Moving `apps/ai` or `models/` breaks these reads.

## 3. `docs/` layout

| Path | Contents |
|------|----------|
| `docs/architecture/` | Reserved for system-overview material. Currently this file lives at `docs/` root; a `system-overview.md` is a planned future addition. |
| `docs/modules/<name>/` | Per-feature design packets: `game/`, `progress-tracking/`. Files numbered `00-…` through `07-…` plus a `README.md`. |
| `docs/specs/` | Dated design docs, `YYYY-MM-DD-<topic>-design.md`. The authoritative record. |
| `docs/thesis/` | The KLTN thesis (`.pdf` / `.docx`). |
| `docs/superpowers/` | Transient agent working files. `plans/` is git-ignored (`.gitignore` line 95); see `docs/superpowers/README.md`. Not authoritative — design docs live in `docs/specs/`. |

## 4. Files that hardcode the layout

Anyone moving a top-level directory, an app, or `models/` must update all of
these in the same change:

- [ ] `apps/server/Dockerfile` — `COPY apps/<name>/package.json` lines, runtime `COPY` of `apps/server` + `packages/shared`
- [ ] `apps/assignments/Dockerfile` — same pattern
- [ ] `apps/website/Dockerfile` — same pattern
- [ ] `apps/ai/Dockerfile` — `COPY apps/ai …`, `COPY models ./models`
- [ ] `docker-compose.yml` — `dockerfile:` path per service (context is repo root)
- [ ] `apps/server/fly.toml` — deployed app `ie-backend`
- [ ] `apps/assignments/fly.toml` — deployed app `idest-assignment-microservice`
- [ ] `.dockerignore` — path-specific allow rules (`!apps/website/.env`, `apps/ai/catboost_info`, `apps/ai/tests/__pycache__`, …)
- [ ] `.github/workflows/*` — CI and Fly deploy workflows (added by the CI task); they check out at repo root and reference `apps/<name>` paths
- [ ] `apps/ai/ielts_ai/paths.py` — `REPO_ROOT` / `APPS_AI_DIR` walk-up, `models/` and `data/` reads
- [ ] `apps/server/scripts/crawl-ielts-task2.js` — writes the dataset to `../ai/data/ielts_task2_dataset.json` (resolved from `apps/server/`)
