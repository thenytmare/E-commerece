FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY tooling/eslint-config/package.json tooling/eslint-config/package.json
COPY tooling/tailwind-config/package.json tooling/tailwind-config/package.json
COPY tooling/typescript-config/package.json tooling/typescript-config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
ENV STANDALONE_BUILD=true
RUN pnpm --filter @repo/database db:generate
RUN pnpm --filter @repo/web build:standalone

# One-off migration image. Run it before starting (or updating) the app:
#   docker build --target migrator -t primeaccessorieskenya-migrate .
#   docker run --rm --env-file .env primeaccessorieskenya-migrate
# It applies any new files in packages/database/prisma/migrations with
# `prisma migrate deploy` (never `migrate dev`, which can reset data).
FROM builder AS migrator
WORKDIR /app
CMD ["pnpm", "--filter", "@repo/database", "db:deploy"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
# Admin uploads live outside the app so they survive rebuilds. Mount a volume
# (or a host folder) at /data/uploads, and include it in your backups.
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown node:node /data/uploads
VOLUME ["/data/uploads"]
USER node
EXPOSE 3000
# Alpine's busybox provides wget out of the box (no curl in this image, and
# nothing extra is installed above) — use it to poll the app's own health
# endpoint, which checks DB connectivity and returns 503 on failure.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget --quiet --tries=1 --spider "http://localhost:${PORT}/api/health" || exit 1
CMD ["node", "apps/web/server.js"]
