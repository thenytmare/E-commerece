# Module 8 — Admin & Polish

## Purpose

Finish the MVP with practical operations tooling and deployment scaffolding: admin order handling, low-stock visibility, and Docker packaging for production.

## Deliverables

- [x] Admin dashboard with operational summaries
- [x] Admin orders page with fulfillment status actions
- [x] Admin inventory page with low-stock alerts
- [x] `OrderRepository.updateStatus()` for admin workflows
- [x] `InventoryRepository.findLowStockDetailed()` for product-aware alerts
- [x] Production `Dockerfile` for standalone Next.js output
- [x] `.dockerignore` and updated deployment instructions

## Admin Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard summary for orders, stock, and paid orders |
| `/admin/orders` | Review orders, mark processing/shipped/delivered, cancel pending |
| `/admin/inventory` | View low-stock variants and thresholds |

## Operational Flow

1. Payment completes and order becomes `CONFIRMED`
2. Admin marks order `PROCESSING`
3. Admin marks order `SHIPPED`
4. Admin marks order `DELIVERED`

Pending or confirmed orders can also be cancelled from admin, which releases reserved inventory.

## Docker Deployment

The root `Dockerfile` builds the standalone Next.js server from `apps/web` and runs it in a slim Node 20 Alpine image.

Build and run:

```bash
docker build -t techvault .
docker run --env-file .env -p 3000:3000 techvault
```

With PostgreSQL from `docker-compose.yml`:

```bash
pnpm docker:up
docker build -t techvault .
docker run --env-file .env --network host techvault
```

## Manual Testing Checklist

- [ ] Admin user can open `/admin`
- [ ] `/admin/orders` shows recent orders and payment state
- [ ] Admin can move orders through processing, shipped, delivered
- [ ] Admin can cancel pending/confirmed orders
- [ ] `/admin/inventory` shows low-stock seeded variants when thresholds are hit
- [ ] `docker build -t techvault .` succeeds on Linux / CI

## Next Step

Live provider setup: configure Stripe webhooks and Safaricom Daraja credentials for production.
