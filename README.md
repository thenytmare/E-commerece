# Prime Accessories Kenya E-Commerce

Premium electronics e-commerce platform built with a modular monorepo architecture.

## Stack

- **Monorepo:** Turborepo + pnpm
- **Frontend:** Next.js 15, React 19, TypeScript
- **Styling:** Tailwind CSS + custom design system (`@repo/ui`)
- **Hosting:** Host Africa VPS (Docker, planned)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build all packages
pnpm build

# Production build for Docker / Host Africa VPS (Linux)
pnpm --filter @repo/web build:standalone
```

The storefront runs at [http://localhost:3000](http://localhost:3000).

### Database setup

```bash
# Start PostgreSQL (Docker)
pnpm docker:up

# Copy env and run migrations
cp .env.example .env
# Set AUTH_SECRET (see .env.example)
pnpm db:migrate
pnpm db:seed
```

> **Windows note:** `pnpm build` works locally. Standalone output (for Docker) uses symlinks and should be built on Linux or with [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development) enabled.

## Project Structure

```
apps/
  web/          Storefront (Next.js)
packages/
  ui/           Design system components & tokens
  utils/        Shared utilities
  config/       Environment validation & constants
  database/     Prisma schema, client, repositories
tooling/
  eslint-config/
  tailwind-config/
  typescript-config/
docs/
  modules/      Per-module documentation
```

## Module Progress

| Module | Status |
|--------|--------|
| M1 — Foundation & Design System | ✅ Complete |
| M2 — Database & Core Models | ✅ Complete |
| M3 — Authentication & RBAC | ✅ Complete |
| M4 — Catalog Storefront | ✅ Complete |
| M5 — Cart | ✅ Complete |
| M6 — Checkout & Orders | ✅ Complete |
| M7 — Payments | ✅ Complete |
| M8 — Admin & Polish | ✅ Complete |

## License

Private — All rights reserved.

## Production Deployment

### Docker build

```bash
docker build -t primeaccessorieskenya .
docker run --env-file .env -p 3000:3000 primeaccessorieskenya
```

### Required environment variables

At minimum, production needs:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

For payments, also configure Stripe and/or Daraja values from `.env.example`.

### Admin tools

After signing in with an `ADMIN` or `MANAGER` role:

- `/admin` — dashboard
- `/admin/orders` — fulfillment actions
- `/admin/inventory` — low-stock alerts
