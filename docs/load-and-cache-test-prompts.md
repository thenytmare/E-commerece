# Load test and cache test prompts

Prime Accessories Kenya (Next.js 15, Prisma, Postgres, NextAuth v5, Turborepo)

Paste each prompt into Claude Code, opened in the repo root. Run them one at a time.

What the prompts already know about your site:

- Cart, checkout and payment use server actions, not REST routes. They are harder to script.
- `middleware.ts` makes a fresh CSP nonce on every page request. That can stop pages from being cached.
- `lib/rate-limit.ts` is an in-memory Map keyed by `X-Forwarded-For`. One test machine will hit the limit fast.
- Stock is held in `quantity - reserved`. Concurrency can oversell the last item.
- Prisma uses the default pool size unless `connection_limit` is set in `DATABASE_URL`.

---

## Prompt 1: Load test

```
You are a performance engineer. Write and run a load test for this repo (Prime Accessories Kenya, a Next.js 15 storefront with Prisma and Postgres). Do not guess. Read the code first.

READ FIRST
- README.md, setup.md, docs/modules/M04 to M07
- apps/web/middleware.ts, next.config.ts, lib/rate-limit.ts, lib/actions/cart.ts, lib/actions/checkout.ts
- .env.example (note PAYMENT_DEV_MODE, TRUST_PROXY_HEADERS, DATABASE_URL pool settings)

RULES
- Test a production build only (pnpm --filter @repo/web build, then start). Never test "next dev".
- Use a local or staging database with seed data. Never touch a live database.
- Set PAYMENT_DEV_MODE so no real Stripe or M-Pesa call is made. Never hit /api/webhooks/* or /api/cron/reconcile.
- Use k6. Put everything in a new folder: tests/load/. Do not change app code. If you think app code must change, list it at the end instead.
- Use UK English in all comments and reports.

STEP 1: PREPARE
1. Write tests/load/seed-large.ts that adds at least 500 products across 10 categories and 20 brands, so listing, search and pagination are realistic. The seed has only 3 products now.
2. Start Postgres with pnpm docker:up, migrate, seed, build, start.
3. Rate limiting: all k6 traffic comes from one IP. Run the app with TRUST_PROXY_HEADERS=true and send a different X-Forwarded-For per virtual user, in the test environment only. Explain this choice in the README.

STEP 2: SCENARIOS (one k6 file each, shared helpers in tests/load/lib/)
A. Browse (70% of traffic): home, /products, /products?q=, /products?brand=, /categories/[slug], /products/[slug], with pagination. Pull real slugs from the seed.
B. Cart (20%): guest adds to cart, updates quantity, views /cart. Server actions need a Next-Action ID. Capture the real ID and request body from a Playwright run (apps/web/e2e), then replay it in k6. Show how you got it.
C. Checkout (8%): guest or logged-in checkout up to order creation, with PAYMENT_DEV_MODE on.
D. Auth (2%): login and register. Expect the rate limiter to answer 429. Count 429s separately. Do not count them as failures.
E. Health: poll /api/health every second during all runs.

STEP 3: LOAD SHAPES
- Smoke: 1 user, 1 minute.
- Baseline: 25 virtual users, 5 minutes.
- Load: ramp to 100 virtual users, hold 10 minutes.
- Stress: ramp until p95 passes 2 seconds or errors pass 2%. Record the breaking point.
- Spike: 10 to 300 users in 30 seconds, then back down.
- Soak: 30 users for 60 minutes. Watch memory and the rate-limit Map size.

STEP 4: THRESHOLDS (put them in the k6 options)
- p95 under 800 ms for browse pages, under 1500 ms for cart and checkout
- Error rate under 1% (excluding expected 429s)
- /api/health always 200

STEP 5: WHILE RUNNING, CAPTURE
- Node process CPU and memory
- Postgres active connections (pg_stat_activity) against max_connections and the Prisma pool size
- Slow queries (pg_stat_statements if available)
- Any "too many clients" or Prisma timeout errors in the app log

STEP 6: CONCURRENCY CORRECTNESS
Write one extra test: 50 users buy the last 5 units of one variant at the same moment. Check that exactly 5 orders succeed, stock never goes below zero, and reserved matches the orders. Report any oversell as a bug.

STEP 7: REPORT
Write tests/load/REPORT.md with: environment used, a table of results per scenario and shape (rps, p50, p95, p99, error %), the breaking point, the top 3 bottlenecks with evidence, and a ranked fix list (pool size, missing indexes, query count per page, caching). Add npm scripts: pnpm test:load:smoke, :baseline, :load, :stress, :spike, :soak.

Run smoke and baseline yourself. Show me the numbers before running stress, spike or soak.
```

---

## Prompt 2: Cache test

```
You are a web performance engineer. Write and run a cache test for this repo (Prime Accessories Kenya, Next.js 15 App Router, Prisma, Postgres). Find out what is really cached. Do not assume.

READ FIRST
- apps/web/middleware.ts (it makes a CSP nonce per request), app/layout.tsx (reads the nonce with headers()), next.config.ts
- app/(storefront)/page.tsx, products/page.tsx, products/[slug]/page.tsx (calls auth()), categories/[slug]/page.tsx
- app/sitemap.ts, app/robots.ts, app/api/health/route.ts (force-dynamic)
- Any use of revalidate, revalidatePath, revalidateTag, unstable_cache, cookies() or headers() in apps/web and lib/

My concern: a per-request nonce and auth() calls may make every page dynamic, so nothing is cached. Prove or disprove this with evidence.

RULES
- Production build only (build, then start). Dev mode does not cache like production.
- Put everything in tests/cache/. Do not change app code. List suggested changes at the end.
- Use Node 20 fetch plus a small test runner (vitest or node:test). Use UK English.

STEP 1: BUILD OUTPUT
Run the build and record, for every route, whether Next marks it static, SSG, or dynamic (the route table in the build output). Save it to tests/cache/build-routes.txt.

STEP 2: RESPONSE HEADER MATRIX
For each URL, send 3 requests in a row (cold, warm, warm) as a guest, and again as a logged-in user. Record Cache-Control, ETag, Vary, Age, x-nextjs-cache, x-nextjs-prerender, Set-Cookie and the content hash of the body.
URLs: /, /products, /products?q=anker, /products?page=2, /categories/[slug], /products/[slug], /cart, /privacy, /terms, /sitemap.xml, /robots.txt, /api/health, /_next/static/<a real chunk>, /_next/image?url=<a real product image>&w=640&q=75, /uploads/<a real file>.
Output a table in tests/cache/REPORT.md: URL, who can cache it (browser, CDN, nobody), TTL, and a pass or fail against the expectation below.

EXPECTATIONS (flag every miss)
- /_next/static/*: public, immutable, one year
- /_next/image and /uploads: long, public caching
- Public catalogue pages: ideally short shared caching with stale-while-revalidate, with no personal data
- /cart, /checkout, /account, /orders, /admin, /api/admin: private, no-store
- /api/health: no-store
- Any response that sets a cookie must never be publicly cacheable
- The CSP nonce must differ per request. If pages were cached by a CDN, a repeated nonce would break CSP, so check this is handled

STEP 3: CORRECTNESS CHECKS
1. Personalisation leak: fetch /products/[slug] as user A, then as a guest. The guest body must not contain A's name, email, wishlist state or review form state.
2. Cart isolation: two different cart_session_id cookies must never see each other's cart.
3. Invalidation: change a product price or stock as admin (use the real admin action or the database). Measure how long before the storefront shows the change. Pass if within the intended TTL. Also check that the homepage featured list, product page and category page all update.
4. Stock accuracy: after an order reserves stock, the product page must show the new availability within a few seconds.
5. Conditional requests: send If-None-Match with the ETag from before. Expect 304 where an ETag exists.
6. Image cache: first /_next/image call is a MISS, the second is a HIT. Record both timings.

STEP 4: DATABASE LOAD PROOF
Turn on query logging, or count queries with Prisma's query event. Load /products/[slug] 100 times. Report queries per request and total. If it is the same count on every request, nothing is cached at the data layer.

STEP 5: TIMING
Use k6 or autocannon for 200 requests to each key page. Report p50 and p95 for cold versus warm. If warm is not faster, the page cache is not working.

STEP 6: REPORT
Add to tests/cache/REPORT.md: what is cached and what is not, the root cause (nonce, auth(), cookies, missing revalidate), and a ranked list of fixes with the trade-off for each. Examples to evaluate: unstable_cache or "use cache" on catalogue queries with revalidateTag on admin writes, moving auth() out of public pages, a nonce-free CSP with hashes for static pages, and nginx or CDN caching rules for /_next/static, /_next/image and /uploads. Add pnpm test:cache.

Show me the header table and the root cause before suggesting fixes.
```

---

## Notes

- Run the cache test first. Its findings change the load test results.
- For a real server, run both against staging on the same VPS size as production, not your laptop.
- If you test through nginx or a CDN, repeat the cache test through it. Edge rules change everything.
