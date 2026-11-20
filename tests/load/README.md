# Load tests

k6 scripts for the storefront. Run them against a **test or staging copy** only, never
the live shop: they create real orders, and they send a fake `X-Forwarded-For` header
per virtual user so the app's per-IP rate limits behave as they would for many real shoppers.

## Setup (once per build)

```bash
# 1. Test database: migrations, normal seed, then the 500-product load catalogue
pnpm db:deploy && pnpm db:seed
psql "$DATABASE_URL" -f tests/load/seed-large.sql

# 2. Production build with simulated payments
#    .env: PAYMENT_DEV_MODE=true, no Stripe/M-Pesa keys
pnpm --filter @repo/web build && pnpm --filter @repo/web start

# 3. Server action IDs (they change every build) and real slugs
node tests/load/lib/action-ids.mjs
node tests/load/lib/slugs.mjs
```

Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/.

## Run

```bash
pnpm test:load:smoke       # 1 user, 1 minute
pnpm test:load:baseline    # 25 users, 5 minutes
pnpm test:load:load        # 100 users, 10 minutes
pnpm test:load:stress      # ramps to 400 users; watch for the breaking point
pnpm test:load:spike       # 10 to 300 users in 30 seconds
pnpm test:load:soak        # 30 users for 60 minutes
pnpm test:load:oversell    # 50 shoppers race for the last 5 units (run oversell-prepare.sql first)
pnpm test:load:isolation   # two shoppers must never see each other's cart
```

Set `BASE_URL` to test another host (default `http://localhost:3000`).
While a run is going, `tests/load/lib/monitor.sh results/<name>-monitor.csv &` samples the
app's CPU and memory and Postgres connections every 5 seconds.

## What the storefront script does

| Flow | Share | Steps |
|---|---|---|
| Browse | 70% | 4 pages from: home, all products, search, brand filter, page 1 to 10, category, product |
| Cart | 20% | product page, add to cart, cart page |
| Checkout | 8% | product, add to cart, checkout page, place a Nairobi delivery order |
| Sign-in | 2% | login page, wrong password (429 "too many attempts" is counted separately) |
| Health | 1/second | `/api/health` must always return 200 |

Thresholds: browse p95 under 800 ms, cart and checkout p95 under 1,500 ms,
unexpected errors under 1%, health always 200.

Server actions are called with the same multipart body a browser sends. The cart cookie
is `Secure` in production builds, and k6 won't send that over plain http, so the
helper copies it into the cookie jar itself when `BASE_URL` is http.

Results from the first run: see `REPORT.md`.
