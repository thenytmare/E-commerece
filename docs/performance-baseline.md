# Performance baseline

Measured on 12 November 2026 in a test workspace, not on the live server. Treat the numbers as a guide to where the limit is, not as the live site's capacity.

## Setup

- Production build (`next build`, then `next start`), one Node process.
- 2 CPU cores, 8 GB memory. The load tool (k6) ran on the same machine and took part of the CPU, so a dedicated server of the same size would do a little better.
- Postgres 16 on the same machine, `max_connections = 100`, pool of 5.
- 503 active products (500 test products added for the run, then removed).
- Script: `scripts/loadtest/browse.js`. Mix: 25% home, 20% product list, 30% product page, 10% search, 7% category, 5% cart, 3% health check.
- "Users" wait 1 to 3 seconds between pages, like a real shopper. The stress run has no wait.

Not covered: add to cart, checkout and payment. These are Server Actions that need a session and an action id. Payment provider latency was not measured, because Stripe and M-Pesa are not configured in the workspace.

## Results

| Run | Requests/s | p50 | p95 | p99 | Errors | App CPU | Memory (RSS) |
|---|---|---|---|---|---|---|---|
| 50 users, 5 min | 24.0 | 42 ms | 160 ms | 347 ms | 0% | about 60% of one core | about 790 MB |
| 100 users, 5 min | 40.1 | 330 ms | 1.52 s | 2.13 s | 0% | 100% of one core | about 800 MB |
| Stress, 50 users no wait, 2 min | 42.9 | 801 ms | 2.58 s | 2.84 s | 0% | 100% of one core | about 840 MB |

Note on the old figure: the earlier "24 requests per second at 50 users" was set by the 1 to 3 second wait, not by the server. At 50 users the server was not busy (p95 160 ms now).

### p95 by route

| Route | 50 users | 100 users | Stress |
|---|---|---|---|
| Product page | 225 ms | 1.98 s | 2.80 s |
| Home | 142 ms | 878 ms | 984 ms |
| Category | 120 ms | 872 ms | 949 ms |
| Product list | 111 ms | 823 ms | 961 ms |
| Search | 123 ms | 814 ms | 960 ms |
| Health check | 36 ms | 280 ms | 335 ms |
| Cart | 71 ms | 191 ms | 137 ms |

The five slowest routes are the product page, home, category, list and search. The product page is about 2 to 3 times slower than the others when the server is busy.

### Database

- Connections: 5 in the pool, all idle at every sample, even at full load.
- Lock waits: none.
- No query over 500 ms. The slowest queries by total time:

| Query | Calls | Average | Max |
|---|---|---|---|
| Product rows for lists and home | 13,746 | 0.34 ms | 10.8 ms |
| Product count for paging | 13,746 | 0.14 ms | 4.7 ms |
| Variants for listed products | 19,525 | 0.08 ms | 4.4 ms |
| Images for listed products | 19,525 | 0.07 ms | 3.9 ms |
| Product detail rows | 7,163 | 0.20 ms | 6.0 ms |

All database work added up to about 1 ms per request. The app spent about 23 ms of CPU per request.

## Where the bottleneck is

**Page rendering in the single Node process.** CPU reached 100% of one core at about 40 to 43 requests per second, and response times then grew. The database was nearly idle, the pool was never full, and nothing waited on locks.

Why rendering costs so much: the root layout reads `headers()` so that each page gets a fresh CSP nonce. That makes every page render on every request. Next.js cannot serve a stored copy of the home page or a product page. This was a deliberate security choice and it is a sound one. It has a CPU price.

What this means:

1. A bigger database, a bigger pool, PgBouncer, Redis or read replicas would not help today.
2. Caching more database reads would save little, because database time is about 1 ms of each request.
3. The levers that would help, smallest first:
   - Fix work done one step after another on busy pages (done for the product page, see below).
   - Use the second CPU core. Node uses one core for rendering. Running two app processes on the same 2-core server roughly doubles capacity. That counts as two instances, so the items in `docs/scaling-checklist.md` come first.
   - A bigger server (more cores) with one process per core. Same checklist.
   - Owner decision: let some public pages be served from a stored copy. That means a different CSP approach for those pages (hashes instead of a nonce). It would cut CPU a lot, but it is a security trade-off and needs care. Not done.

## Change made and its effect

The product page fetched the flash sale, related products, rating summary and login one after another. Each wait queued again behind other requests when the server was busy. They now run together.

| Product page | Before | After |
|---|---|---|
| 100 users, average | 831 ms | 667 ms |
| 100 users, p95 | 1.98 s | 1.79 s |
| Stress, average | 2.33 s | 2.07 s |
| Stress, p95 | 2.80 s | 2.55 s |

All routes at 100 users: p95 1.52 s before, 1.37 s after. Requests per second stayed about the same (40 to 41), because CPU is still the limit.

## Monitoring now in the app

- One JSON log line every 30 seconds (`type: "metrics"`): CPU, memory, event loop delay, database connections by state, lock waits. Turn off with `METRICS_LOG=false`.
- `/api/health` checks the database and now reports `dbMs`.

### Request time per route on the live server

Next.js has no hook that sees the finished response time, so take it from nginx. Add this to the `http` block:

```nginx
log_format timed '$remote_addr [$time_local] "$request" $status $body_bytes_sent '
                 'rt=$request_time urt=$upstream_response_time';
access_log /var/log/nginx/access.log timed;
```

`rt` is the full time, `urt` is the time the app took. To list the slowest pages:

```bash
awk '{for(i=1;i<=NF;i++) if($i ~ /^urt=/){split($i,a,"="); print a[2], $7}}' /var/log/nginx/access.log | sort -rn | head -20
```

### Slow queries on the live server

`pg_stat_statements` is the best source. Enable it once (needs a restart):

```text
shared_preload_libraries = 'pg_stat_statements'
```

then `CREATE EXTENSION pg_stat_statements;` and:

```sql
SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms, round(max_exec_time::numeric, 1) AS max_ms, left(query, 120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

Or log any query over 500 ms with `log_min_duration_statement = 500`.

## How to run the test again

```bash
pnpm --filter web build
pnpm --filter web start
k6 run -e BASE_URL=http://localhost:3000 -e VUS=50 -e DURATION=5m -e CATEGORIES=earbuds,smart-watches,chargers scripts/loadtest/browse.js
```

The script expects products with slugs `loadtest-accessory-1` to `loadtest-accessory-500`. Point it at a copy of the database, never the live one. Or change the product slugs in the script to real ones.

## Not measured

- Add to cart, checkout, payment, and Stripe or M-Pesa response times.
- Background job failures and queue age (there is no queue yet).
- The live server's hardware, network and nginx.
- Logged-in shoppers (all test traffic was guests).
