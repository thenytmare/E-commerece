# Load test report

Prime Accessories Kenya, production build, 5 November 2026. Scripts in this folder.

## Environment (read this first)

- 2 vCPU / 7 GB cloud container. The app, Postgres 16 and k6 all ran on the same machine,
  so k6 competed with the app for CPU. Numbers are a floor, not your VPS's real ceiling.
- Catalogue: the normal seed plus `seed-large.sql` (504 products, 14 categories, 22 brands).
- `PAYMENT_DEV_MODE=true`; no Stripe or M-Pesa calls; no webhooks or cron routes touched.
- In this test copy only, Prisma ran in its npm-only client mode (`@prisma/adapter-pg`,
  pool of 5 connections) because the native engine could not be downloaded here.
  Your server will use the native engine, so query overhead there may differ slightly.
- Each virtual user sent its own `X-Forwarded-For` address (see "Rate limiting" below).

## Results

| Run | Users | Duration | Requests | Req/s | Browse p95 | Cart p95 | Checkout p95 | Errors | Orders |
|---|---|---|---|---|---|---|---|---|---|
| Smoke | 1 | 1 min | 93 | 1.4 | 46 ms | n/a* | 66 ms | 0% | 1 |
| Baseline | 25 | 5 min (+ ramps) | 4,537 | 12.8 | 102 ms | 134 ms | 146 ms | 0% | 85 |

\* The single smoke user happened not to roll the cart flow in that minute.

All thresholds passed: browse p95 under 800 ms, cart and checkout p95 under 1,500 ms,
unexpected errors 0%, `/api/health` returned 200 on all 345 checks during the baseline.
A full checkout journey (product page, add to cart, checkout page, place order,
including 2 s of "thinking" time) took 2.2 s at p50 and 2.4 s at p95.

### Resources during the baseline

| Measure | Value |
|---|---|
| Postgres connections | 11 at most (of 100 allowed); never more than 2 busy at once |
| Total database time | about 1.5 s across the whole 6-minute run |
| Node server memory (RSS) | grew from 408 MB to 808 MB over 6 minutes |
| Slowest query | product list with count, 0.6 ms on average |

The database was nowhere near its limits at 25 users. Most of each request's time is
spent rendering the page in Node, not waiting for Postgres.

## Correctness under load

| Check | Result |
|---|---|
| Overselling: 50 shoppers order the last 5 units at the same moment | **Pass.** 5 orders succeeded, 45 got "Insufficient stock", stock ended at 5 reserved / 0 available |
| Cart isolation: two shoppers, separate cart cookies | **Pass.** Each saw only their own item |
| Order rate limit (10 per 5 minutes per IP) | Not reached; each user had its own IP |

## Top findings

1. **Every page view re-runs all its queries.** Nothing is cached (see `tests/cache/REPORT.md`).
   In the 6-minute baseline the categories query alone ran 6,876 times, about 19 times a second
   for 25 users. Cheap now, but it grows in step with traffic.
2. **Memory grew from 408 MB to 808 MB in 6 minutes.** This may just be Next.js warming its
   caches, or it may be a leak. Only the 60-minute soak test can tell. It matters on a 4 GB
   server that also runs Postgres.
3. **The rate limits can be bypassed.** `lib/rate-limit.ts` keys on the first address in
   `X-Forwarded-For`, which any client can set. This test used exactly that to give each user
   its own bucket. On the VPS, nginx must **replace** the header, not append to it:

   ```nginx
   proxy_set_header X-Forwarded-For $remote_addr;
   proxy_set_header X-Real-IP       $remote_addr;
   ```

   With the common `$proxy_add_x_forwarded_for`, the client's own fake value stays first,
   and login and checkout limits can be bypassed by rotating it. Also make sure port 3000 is
   not reachable from the internet directly (only through nginx).

## Ranked fixes

1. Set the nginx headers above before going live (security, five minutes).
2. Cache catalogue data with `unstable_cache` + `revalidateTag` (see the cache report).
3. Dedupe the repeated category queries with React `cache()`.
4. Run the soak test on the real VPS to check the memory growth.
5. Set `connection_limit` in `DATABASE_URL` explicitly (10 is plenty at this traffic level).

## Not run yet

Load (100 users), stress, spike and soak were not run, as planned: they should run on the
real VPS (or a copy of it), with k6 on a separate machine, to give numbers you can rely on.
