FROM node:20-alpine AS base
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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
