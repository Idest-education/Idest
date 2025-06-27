# 1. Use Node base
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 4. Copy package and install deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 5. Copy everything else
COPY . .

# 6. Generate Prisma client
RUN pnpm prisma generate

# 7. Build the NestJS app
RUN pnpm build

# 8. Start command (prod build)
CMD ["node", "dist/main.js"]
