# Module 3 — Authentication & RBAC

## Purpose

Add secure user authentication with Auth.js, credential-based login/registration, JWT sessions with role claims, and route protection for customer and admin areas.

## Deliverables

- [x] Auth.js v5 integration with Prisma adapter
- [x] Email/password login and registration
- [x] JWT sessions with user roles embedded
- [x] Middleware protection for `/account` and `/admin`
- [x] RBAC helpers (`ADMIN`, `MANAGER` for admin routes)
- [x] Login and register pages using `@repo/ui`
- [x] Site header with auth state
- [x] Seed admin user for local testing
- [x] `AUTH_SECRET` environment validation

## Folder Structure

```
apps/web/
├── auth.ts                          # Auth.js config (providers, callbacks)
├── auth.config.ts                   # Edge-compatible config for middleware
├── middleware.ts                    # Route protection
├── app/
│   ├── api/auth/[...nextauth]/      # Auth.js handlers
│   ├── (auth)/login/                # Sign-in page
│   ├── (auth)/register/             # Registration page
│   ├── account/                     # Customer account (protected)
│   └── admin/                       # Admin dashboard (ADMIN/MANAGER only)
├── components/
│   ├── auth/                        # Login & register forms
│   └── site-header.tsx              # Nav with auth links
└── lib/
    ├── actions/auth.ts              # Server actions (login, register, logout)
    ├── auth/rbac.ts                 # Role-checking utilities
    └── validations/auth.ts          # Zod schemas
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Session signing secret (min 32 chars). Generate: `openssl rand -base64 32` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |

## Auth Flow

1. **Register** — validates input, hashes password (bcrypt, 12 rounds), creates user with `CUSTOMER` role, signs in
2. **Login** — credentials provider verifies email/password against `password_hash`
3. **Session** — JWT includes `roles[]` loaded from `user_roles` on each token refresh
4. **Middleware** — `/account` requires login; `/admin` requires `ADMIN` or `MANAGER`

## Test Accounts (after seed)

| Email | Password | Roles |
|-------|----------|-------|
| `admin@techvault.co.ke` | `Admin123!` | ADMIN |

New registrations receive the `CUSTOMER` role automatically.

## Setup

```bash
cp .env.example .env
# Set AUTH_SECRET to a random 32+ character string

pnpm docker:up
pnpm db:push      # or db:migrate
pnpm db:seed
pnpm dev
```

Visit:
- http://localhost:3000/login
- http://localhost:3000/register
- http://localhost:3000/account (requires login)
- http://localhost:3000/admin (requires ADMIN or MANAGER)

## Manual Testing Checklist

- [ ] Register a new customer account
- [ ] Log in with registered credentials
- [ ] `/account` shows user details when logged in
- [ ] `/account` redirects to login when logged out
- [ ] `/admin` accessible with admin seed user
- [ ] `/admin` blocked for customer accounts
- [ ] Sign out clears session and updates header

## Security Considerations

- Passwords hashed with bcrypt (12 rounds); never stored in plain text
- `AUTH_SECRET` validated at startup via Zod
- Admin routes protected at middleware and page level
- Credentials provider returns `null` on failure (no user enumeration via error messages)

## Next Module

**M4 — Catalog Storefront:** Product listing, category navigation, product detail pages wired to `ProductRepository`.
