# Idest Server (NestJS)

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm (recommended package manager)
- A running PostgreSQL database for Prisma

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Copy env template and fill values

```bash
cp .env.example .env
```

3. Generate Prisma client and run migrations (requires a configured database URL)

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

## Run the app

- Development (watch mode)

```bash
pnpm start:dev
```

- Production build & run

```bash
pnpm build
pnpm start:prod
```

## Tests

```bash
pnpm test
```

## API docs

Swagger UI is served at `/api` when the server is running

## Note

For the assignment module to function, you also need to run [Idest-Assignment Service](https://github.com/LuckiPhoenix/Idest-Assignment).
