# Prompt: measure first, then scale safely

Copy everything below the line into your coding assistant, from the repo root.

---

You are working on Prime Accessories Kenya. It is a pnpm and Turborepo monorepo. The stack is Next.js 15 App Router, React 19, TypeScript, Prisma 6, Postgres 16, NextAuth v5 (JWT sessions), Stripe, M-Pesa and cash on delivery.

Use UK English, plain words and short sentences in comments, docs and UI text. No em dashes.

## Goal

Keep one Next.js app and one Postgres database for now. Do not add Redis, PgBouncer, read replicas or sharding unless a measurement in this task proves we need them. Make the smallest change that solves each problem. Work in four stages. Finish and report each stage before the next. Do not start stage 3 or 4 until stage 1 results are written down.

## Rules

- Do not change payment, stock or order logic except where a stage says so.
- Every change has a test or a measured before and after number.
- Never put secrets in code, logs or docs.
- No new paid service. Open source tools or plain Node and Postgres only.
- If a stage needs a database migration, show the SQL and wait for a yes.
- Do not commit. Do not touch `packages/database/src/client.ts` workspace-only changes.

## Stage 1: measure

1. Add light request timing. Log route, status and duration for each request as one JSON line. Do not log query strings, cookies or personal data.
2. Add a `/api/health` check if one does not exist. It must test the database with a cheap query and return fast.
3. Record app CPU, memory and event loop delay every 30 seconds in the same log (use `perf_hooks.monitorEventLoopDelay`).
4. Add database figures: active and idle connections, slow queries over 500 ms (Prisma query events or `pg_stat_statements` if enabled), and lock waits.
5. Write a load test script in `scripts/loadtest/` using a tool already available (autocannon or k6). Cover: home, product list, product page, search, add to cart, checkout page. Use 50 and 100 concurrent users for 5 minutes each, against a production build (`next build` then `next start`), not the dev server.
6. Run it. Write the results in `docs/performance-baseline.md`: requests per second, p50, p95, p99, error rate, CPU, memory, connection count, five slowest routes, five slowest queries.
7. State plainly where the bottleneck is: rendering, database, an outside service or lack of resources. Say what you did not measure.

Earlier local result for comparison only: about 24 requests per second at 50 users, p95 about 2 seconds. That test was short and is not a capacity estimate.

## Stage 2: connection budget

1. Read the pool settings Prisma uses now. Report them.
2. Add `DATABASE_POOL_SIZE` and `DATABASE_POOL_TIMEOUT` environment variables with safe defaults. Document them in `.env.example`.
3. Write `docs/connection-budget.md` with this rule: app pools plus worker pools plus 5 for admin and migrations must stay under the Postgres `max_connections`. Show the sum for one instance, and for two.
4. Fix the top three slow queries from stage 1 if they are simple (a missing index, an `N+1`, selecting too many columns). Show before and after timings. Migrations for indexes need approval first.
5. Check which expensive reads could be cached. Rules: product descriptions and rating summaries may be cached for 60 seconds. A stock count shown on a page may be slightly stale, but checkout must read live stock. Never cache cart, account, order or admin responses in a shared cache. Never use a cached value to charge, reserve stock or confirm payment. Only add caching where stage 1 shows a gain, and check that admin edits clear it (`revalidateTag`).

## Stage 3: durable background jobs (Postgres outbox)

Problem: the password-reset action waits for the email server (SMTP) before it answers. Order emails and other slow work should not block a customer.

1. Propose a `Job` table: id, type, payload (JSON), status (`PENDING`, `RUNNING`, `DONE`, `FAILED`), attempts, maxAttempts, runAt, lockedAt, lockedBy, lastError, uniqueKey (unique, optional), createdAt, updatedAt. Add an index on status and runAt. Show the migration SQL and wait for a yes.
2. Add a repository with: `enqueue` (accepts an optional transaction client, so a job can be saved in the same transaction as an order), `claim` (uses `FOR UPDATE SKIP LOCKED`, takes a small batch, sets lock fields), `complete`, `fail` (retry with exponential backoff and a little random jitter, then mark `FAILED` after `maxAttempts`), and `releaseStale` (jobs `RUNNING` for longer than 5 minutes go back to `PENDING`).
3. A uniqueKey stops duplicates. Example: `order-confirmation:<orderId>`.
4. Jobs can run more than once. Every handler must be safe to repeat. A repeated job must never duplicate a charge, a refund, a stock change or an email that already went out. Record sent emails by uniqueKey.
5. Add a worker entry point (`apps/web/scripts/worker.ts` or a separate small app) that polls every few seconds, runs handlers with a timeout, and stops cleanly on SIGTERM.
6. Move these to jobs: password-reset email, order confirmation email, back-in-stock emails. Keep the existing M-Pesa reconciliation lease and batches (25 per batch, concurrency 3). Add reconciliation as a scheduled job only if it stays safe with the lease.
7. Visibility: add an admin page or a section on an existing admin page that shows counts by status, the age of the oldest `PENDING` job, and the last 20 failures with their error text. Restrict it to admin permissions. Add a log line and a health check warning when the oldest pending job is older than 10 minutes.
8. Tests: enqueue in a transaction rolls back with the order; two workers never take the same job; retry and backoff; stale lock release; duplicate uniqueKey; handler repeat safety.
9. Do not change the response text of the password-reset form. It must still say the same thing whether or not the email exists.

## Stage 4: ready for a second instance (do not launch one)

List what still ties the app to one process, then fix each:

1. **Rate limiting** is held in process memory. Two instances would have separate counters. Move it to a Postgres table with an atomic upsert (a counter per key and time window), or to a shared store if one already exists. Keep the same limits and the same hard cap. Add a test with two simulated instances.
2. **Uploads** are saved in a local folder. Put the storage behind a small interface with a local driver and an S3-compatible driver (config chosen by env var). Default stays local. Do not migrate existing files. Document how to move them.
3. **Cache clearing**: check how `revalidateTag` and `unstable_cache` behave with more than one instance on a self-hosted setup. Document the limits and what to configure (a shared cache handler, or a short revalidate time). Do not guess. Read the Next.js 15 self-hosting guide first.
4. **Deployments**: all instances need the same build, the same `AUTH_SECRET`, and the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Add these to `.env.example` and to the deploy docs, and add a startup check that fails with a clear message if the key is missing in production.
5. **Jobs**: confirm that two workers cannot run the same job (stage 3 test).
6. Write `docs/scaling-checklist.md`: a short list to tick before adding a second instance, and the numbers from stage 1 that would justify it (for example CPU above 70 percent for long periods, or p95 above a target the owner sets).

## Not now

Read replicas: only after queries are tuned and caching is not enough. Sharding: no evidence we need it. Redis: only if the Postgres rate limiter or job queue shows a measured problem. If Redis is ever added, use separate instances for cache and for jobs, and set `noeviction` on the jobs one.

## Final report

Give, per stage: what changed (files), tests added and their results, before and after numbers, anything you could not do and why, risks, and the decisions you need from the owner (migrations, targets). Run typecheck, all tests and a production build at the end.
