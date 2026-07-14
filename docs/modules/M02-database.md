# Module 2 — Database & Core Domain Models

## Purpose

Establish the PostgreSQL data layer with Prisma ORM, core domain models for catalog and commerce, and a repository pattern for clean data access across all future modules.

## Deliverables

- [x] `@repo/config` — Zod environment validation & shared constants
- [x] `@repo/database` — Prisma schema, client singleton, repositories
- [x] Docker Compose for local PostgreSQL 16
- [x] Seed script with sample brands, categories, products
- [x] Repository unit tests
- [x] Migration-ready schema

## Folder Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma      # Full core domain schema
│   └── seed.ts            # Sample data seeder
└── src/
    ├── client.ts          # Prisma singleton
    ├── repositories/
    │   ├── base.repository.ts
    │   ├── user.repository.ts
    │   ├── brand.repository.ts
    │   ├── category.repository.ts
    │   ├── product.repository.ts
    │   └── inventory.repository.ts
    └── index.ts           # Public exports

packages/config/
└── src/
    ├── env.ts             # Validated environment
    └── constants.ts       # Pagination, currency defaults
```

## Schema Overview

| Domain | Models |
|--------|--------|
| **Auth** | User, Role, UserRole, Account, Session, VerificationToken, AuditLog |
| **Catalog** | Brand, Category, Product, ProductVariant, ProductImage, ProductSpec, ProductFeature, ProductBoxContent |
| **Inventory** | Inventory, InventoryLog |
| **Commerce** | Cart, CartItem, Order, OrderItem, Payment, Coupon, Shipment, Address, WishlistItem |
| **Reviews** | Review, ReviewImage |
| **Settings** | SiteSetting, MediaLibrary, FlashSale |

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Repository pattern | Keeps business logic out of Prisma calls; testable via mocks |
| `cuid()` IDs | URL-safe, sortable, no UUID verbosity |
| `Decimal` for money | Avoids floating-point errors on prices |
| JSON for variant attributes | Flexible for electronics (color, storage, size) |
| Auth.js-compatible models | Account/Session/VerificationToken ready for Module 3 |
| Snake_case DB columns | PostgreSQL convention; camelCase in Prisma client |

## Repository API

```typescript
import { createRepositories } from '@repo/database';

const repos = createRepositories();

// Catalog
await repos.product.findBySlug('anker-soundcore-liberty-4-nc');
await repos.product.findMany({ categoryId, page: 1, limit: 24 });
await repos.category.findRootCategories();
await repos.brand.findAllActive();

// Inventory
await repos.inventory.checkAvailability(variantId, quantity);
await repos.inventory.adjustStock(variantId, -1, 'order', orderId);

// Users
await repos.user.findByEmail('user@example.com');
```

## Setup Commands

```bash
pnpm docker:up          # Start PostgreSQL
cp .env.example .env    # Configure DATABASE_URL
pnpm db:migrate         # Apply migrations
pnpm db:seed            # Insert sample data
pnpm db:studio          # Visual DB browser
```

## Manual Testing Checklist

- [ ] `docker compose up -d` starts PostgreSQL
- [ ] `pnpm db:migrate` applies schema without errors
- [ ] `pnpm db:seed` creates roles, brands, categories, products
- [ ] `pnpm db:studio` shows all tables with seed data
- [ ] Product variants have inventory records
- [ ] Category hierarchy (parent/child) works

## Automated Tests

```bash
pnpm test
```

Covers: environment validation, inventory repository logic.

## Security Considerations

- `DATABASE_URL` validated at startup via Zod
- Password hashes stored separately (`password_hash` column)
- Audit log table ready for admin action tracking
- No raw SQL in repositories (except removed in favor of Prisma)

## Next Module

**M3 — Authentication & RBAC:** Auth.js integration, login/register, role middleware.
