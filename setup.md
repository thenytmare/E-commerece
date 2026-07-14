# TechVault — Local Setup Guide

Step-by-step instructions to get the TechVault e-commerce monorepo running on your machine.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | **20+** | Required by `package.json` engines |
| [pnpm](https://pnpm.io/) | **9.15.9** | Enforced via `packageManager` field; use `corepack enable` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Runs PostgreSQL locally via `docker-compose.yml` |
| Git | Latest | Clone the repository |

### Enable pnpm via Corepack

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

Verify versions:

```bash
node -v    # v20.x or higher
pnpm -v    # 9.15.9
docker -v  # Docker CLI available
```

---

## 1. Clone and install dependencies

```bash
git clone <repository-url> e-commerce
cd e-commerce
pnpm install
```

This installs all workspace packages (`apps/web`, `packages/*`, `tooling/*`) and links them via pnpm workspaces.

---

## 2. Configure environment variables

Copy the example env file at the repository root:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | **Yes** | Session signing secret (min 32 characters) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (default matches Docker) |
| `NEXT_PUBLIC_APP_URL` | Recommended | App URL for links and redirects (`http://localhost:3000`) |
| `NEXT_PUBLIC_APP_NAME` | Optional | Display name shown in the UI |

Generate `AUTH_SECRET`:

```bash
# macOS / Linux / Git Bash
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

The default `DATABASE_URL` in `.env.example` matches the Docker Compose PostgreSQL service:

```
postgresql://techvault:techvault@localhost:5432/techvault?schema=public
```

---

## 3. Start PostgreSQL

Start the database container:

```bash
pnpm docker:up
```

This runs PostgreSQL 16 on port **5432** with:

- **User:** `techvault`
- **Password:** `techvault`
- **Database:** `techvault`

Check that the container is healthy:

```bash
docker ps
```

Stop the database when finished:

```bash
pnpm docker:down
```

---

## 4. Run database migrations and seed

Apply Prisma migrations:

```bash
pnpm db:migrate
```

Generate the Prisma client (also runs automatically during migrate):

```bash
pnpm db:generate
```

Seed sample data (roles, admin user, brands, categories, products):

```bash
pnpm db:seed
```

### Seed admin account

After seeding, sign in with:

| Email | Password | Role |
|-------|----------|------|
| `admin@techvault.co.ke` | `Admin123!` | ADMIN |

Use this account to access `/admin` and other protected admin routes.

### Optional: Prisma Studio

Browse and edit database records in a GUI:

```bash
pnpm db:studio
```

Opens at [http://localhost:5555](http://localhost:5555).

---

## 5. Start the development server

```bash
pnpm dev
```

Turborepo starts the Next.js storefront with Turbopack. Open:

**[http://localhost:3000](http://localhost:3000)**

---

## 6. Payments (optional in development)

By default, `.env.example` sets `PAYMENT_DEV_MODE=true`, which simulates Stripe and M-Pesa payments without real API keys. No extra configuration is needed for basic checkout testing.

To integrate real payment providers, set `PAYMENT_DEV_MODE=false` and configure:

### Stripe

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → API keys](https://dashboard.stripe.com/test/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI or Dashboard webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard |

Local webhook forwarding (example):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### M-Pesa (Daraja)

| Variable | Source |
|----------|--------|
| `MPESA_CONSUMER_KEY` | [Safaricom Daraja](https://developer.safaricom.co.ke) |
| `MPESA_CONSUMER_SECRET` | Daraja portal |
| `MPESA_SHORTCODE` | Your paybill/till number |
| `MPESA_PASSKEY` | Daraja Lipa Na M-Pesa passkey |
| `MPESA_ENV` | `sandbox` or `production` |

Webhook endpoint: `POST /api/webhooks/mpesa`

---

## Development commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers (storefront on :3000) |
| `pnpm build` | Production build for all packages |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm typecheck` | TypeScript check across the monorepo |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm format` | Format with Prettier |
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:push` | Push schema changes without migration files |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start PostgreSQL container |
| `pnpm docker:down` | Stop PostgreSQL container |

### Run a single package

```bash
pnpm --filter @repo/web dev
pnpm --filter @repo/database test
```

---

## Production build

### Standard build

```bash
pnpm build
```

### Standalone build (Docker / VPS)

For deployment images, build the Next.js standalone output:

```bash
pnpm --filter @repo/web build:standalone
```

### Docker

```bash
docker build -t techvault .
docker run --env-file .env -p 3000:3000 techvault
```

**Required production env vars:**

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

Configure Stripe and/or M-Pesa variables when `PAYMENT_DEV_MODE=false`.

---

## Project structure

```
apps/
  web/              Next.js storefront
packages/
  ui/               Design system components
  utils/            Shared utilities
  config/           Environment validation
  database/         Prisma schema, client, repositories
tooling/
  eslint-config/
  tailwind-config/
  typescript-config/
docs/
  modules/          Per-module documentation
```

---

## Troubleshooting

### `Invalid environment variables` on startup

`AUTH_SECRET` must be at least 32 characters. Regenerate and update `.env`.

### Database connection refused

1. Ensure Docker Desktop is running.
2. Run `pnpm docker:up` and wait for the health check to pass.
3. Confirm `DATABASE_URL` in `.env` matches `docker-compose.yml` credentials.

### Port 5432 already in use

Another PostgreSQL instance may be running locally. Stop it or change the host port in `docker-compose.yml` and update `DATABASE_URL` accordingly.

### `pnpm db:migrate` prompts for a migration name

Enter a short descriptive name (e.g. `init`) when creating a new migration in development.

### Standalone build fails on Windows

Next.js standalone output uses symlinks. Either:

- Build inside Docker (recommended for production), or
- Enable [Windows Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development) for local standalone builds.

### Prisma client out of date

After pulling schema changes:

```bash
pnpm db:generate
```

---

## Next steps

- Browse the catalog at `/products`
- Register a customer account at `/register`
- Sign in as admin and open `/admin`
- Read module docs in `docs/modules/` for feature-specific details

For a high-level overview, see [README.md](./README.md).
