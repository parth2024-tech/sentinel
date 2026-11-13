# Sentinel - Industrial Hardware Telemetry & Posture Engine
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build

# Production runtime container
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

LABEL org.opencontainers.image.title="Sentinel"
LABEL org.opencontainers.image.description="Industrial System Diagnostics & Posture Engine"
LABEL org.opencontainers.image.source="https://github.com/parth2024-tech/sentinel"
LABEL org.opencontainers.image.licenses="MIT"

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/report-engine/package.json ./lib/report-engine/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --prod --frozen-lockfile

COPY lib/db ./lib/db
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 3000

# Automatically run database migrations on boot before launching API server
CMD ["sh", "-c", "node lib/db/migrate.mjs && node artifacts/api-server/dist/index.mjs"]
