# Idest Assignment Microservice

NestJS service that manages assignments (reading, listening, speaking, writing) and grading. It depends on MongoDB, RabbitMQ, and optional Supabase/OpenAI integrations.

## Requirements

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- MongoDB instance
- RabbitMQ instance (defaults to `amqp://localhost:5672`)

## Quick Start

```bash
pnpm install
cp .env.example .env   # fill in your values
```

## Run project
```bash
pnpm run start:dev
```

The API defaults to `http://localhost:8008`.

## Environment Variables

Create `.env` using `.env.example` as a guide. Key variables used by the service:

- `PORT` (default `8008`) — HTTP port.
- `API_URL` — Base URL of this service (used in HTML landing).
- `FRONTEND_URL` — Allowed CORS origin.
- `MONGODB_URI` — MongoDB connection string (required).
- `JWT_SECRET` — Secret for signing tokens (defaults to `default-secret-key`).
- `RABBITMQ_URL` — RabbitMQ connection string (defaults to `amqp://localhost:5672`).
- `OPENAI_API_KEY` — Needed for grading with OpenAI.
- `SUPABASE_URL` / `SUPABASE_KEY` — Needed for Supabase storage access.

## Scripts

- `pnpm run start:dev` — Start in watch mode.
- `pnpm run start` — Start once (development).
- `pnpm run start:prod` — Run compiled app (`dist/`).
- `pnpm run build` — Compile TypeScript to `dist/`.
- `pnpm run test` — Unit tests.
- `pnpm run test:e2e` — E2E tests.
- `pnpm run lint` — Lint and auto-fix.

## Notes

- Swagger is exposed at `/api` when the server is running.
- [Main service](https://github.com/LuckiPhoenix/idest-server) is required to run this
