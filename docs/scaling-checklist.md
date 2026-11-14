# Scaling checklist

Read this before you run a second copy of the app. One server is fine until the numbers below say otherwise.

## When to add a second instance

Add one only if one of these is true for a normal busy week, not a one-off spike:

- App CPU stays above 70 percent for long periods (see the `cpuPercent` line in the logs).
- The p95 response time of shop pages is above the target the owner sets. A fair starting target is 1 second.
- You need the site to stay up while you deploy or while one server restarts.

If the database is the slow part (connections near the limit, slow queries), a second app instance makes it worse. Fix the queries first.

## Before you start the second instance

Tick each one.

- [ ] **Same build.** Both instances run the same image or the same `next build` output.
- [ ] **Same secrets.** `AUTH_SECRET` is identical on every instance.
- [ ] **Same Server Action key.** `next build` creates this key and stores it in the build. Instances started from the same Docker image already share it. If you build on each server, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the same value for every build and every instance. Set `APP_INSTANCES=2` (or more); the app then refuses to start without the key.
- [ ] **Shared uploads.** Set `STORAGE_DRIVER=s3` and the `S3_*` values, and copy the old files across (see below). With local disk, a file uploaded on server A does not exist on server B.
- [ ] **Shared rate limits.** Done: counts live in the `rate_limit_buckets` table. Check `RATE_LIMIT_STORE` is not set to `memory`, or each instance counts on its own and the real limit doubles.
- [ ] **Cache clearing.** Read the cache section below and pick one option.
- [ ] **Connection budget.** The sum in `docs/connection-budget.md` is under the Postgres `max_connections` with two instances.
- [ ] **Background jobs.** Every instance runs a worker and that is safe: jobs use `FOR UPDATE SKIP LOCKED`, so two workers cannot take the same job, and reconciliation keeps its lease. To keep jobs on one instance, set `JOBS_WORKER=false` on the others. See `docs/background-jobs.md`.
- [ ] **Health check.** The load balancer uses `/api/health`.
- [ ] **Sticky sessions are not needed.** Logins use JWT cookies, so any instance can serve any user.

## Moving existing uploads to S3

1. Create the bucket and set the `S3_*` variables.
2. Copy the folder as it is. Example with the AWS CLI: `aws s3 sync /data/uploads s3://YOUR_BUCKET/uploads/`. Keep the file names the same.
3. Switch `STORAGE_DRIVER=s3` and restart. Public URLs (`/uploads/<name>`) do not change, so nothing in the database needs editing.
4. Keep the old folder for a week, then delete it.

## Cache clearing with more than one instance

The shop caches categories, brands and settings for 60 seconds and clears them with `revalidateTag` when an admin saves. In Next.js 15, a default self-hosted setup keeps that cache on each instance's own disk and memory. `revalidateTag` clears it only on the instance that ran the admin action.

Pick one:

1. **Accept up to 60 seconds of delay on the other instance.** The cache expires by itself. This is the simplest and is fine for category, brand and setting changes. Products are not cached across requests, so product changes (including hiding a product) show at once on every instance.
2. **Shared cache handler.** Configure `cacheHandler` in `next.config.ts` with a shared store. Do this only if option 1 is not acceptable. It needs a shared store (Redis or similar), which we do not run today.

Check the Next.js self-hosting guide for the exact version you run before changing this: https://nextjs.org/docs/app/guides/self-hosting

## Reverse proxy

Use `least_conn` or round robin. Pass `X-Forwarded-For` and keep the real client address, because rate limits key on it. Keep body size limits at least as large as the upload limit.
