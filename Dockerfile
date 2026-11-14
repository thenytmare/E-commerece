FROM node:22-alpine AS base
RUN apk add --no-cache openssl
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

# One-off migration image. Run it before starting (or updating) the app:
#   docker build --target migrator -t primeaccessorieskenya-migrate .
#   docker run --rm --env-file .env primeaccessorieskenya-migrate
# It applies any new files in packages/database/prisma/migrations with
# `prisma migrate deploy` (never `migrate dev`, which can reset data).
FROM deps AS migrator
WORKDIR /app
COPY packages/database/prisma ./packages/database/prisma
CMD ["pnpm", "--filter", "@repo/database", "db:deploy"]

FROM deps AS builder
WORKDIR /app
COPY . .
ENV STANDALONE_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
# Public configuration is compiled into browser assets by Next.js.
ARG NEXT_PUBLIC_APP_URL
RUN test -n "$NEXT_PUBLIC_APP_URL" || (echo "Set NEXT_PUBLIC_APP_URL as a build argument." >&2; exit 1)
RUN pnpm --filter @repo/database db:generate
# Build imports validate configuration, but must not access the live database
# or receive production credentials. These values exist only for this command;
# the runner still requires its own DATABASE_URL and AUTH_SECRET at startup.
RUN AUTH_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")" \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    pnpm --filter @repo/web build:standalone

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
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
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "apps/web/server.js"]
