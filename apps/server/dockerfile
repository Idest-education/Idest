FROM node:22-bookworm-slim AS base

RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/assignments/package.json apps/assignments/package.json
COPY apps/website/package.json apps/website/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .
RUN pnpm --filter idest-server build

FROM base AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/server
EXPOSE 8000

CMD ["node", "dist/main.js"]
