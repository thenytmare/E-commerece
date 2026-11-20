# Background jobs

Slow work runs in the background, so a customer never waits for it. Today that is:

| Job | Queued when | Retries | Admin can retry |
|---|---|---|---|
| Password reset email | A customer asks for a reset link | 5 tries over about 8 minutes | No. The link is a secret and is cleared. The customer asks again. |
| Order confirmation email | An order is placed (same transaction as the order) | 5 tries | Yes |
| Back in stock email | Stock is added to a product people are waiting for (same transaction as marking them notified) | 5 tries | Yes |
| Payment check | Every N minutes, if `JOBS_RECONCILE_EVERY_MINUTES` is set | 1 try per period | Yes |

## How it works

- Jobs are rows in the `jobs` table. A job is saved in the same database transaction as the change that needs it (the outbox pattern). An order and its confirmation email exist together or not at all.
- The worker runs inside the app. Nothing extra to deploy. It looks for work every 3 seconds and runs up to 5 jobs at a time.
- Each job is taken with `FOR UPDATE SKIP LOCKED`, so two servers never take the same job.
- A failed job waits and tries again: 30 seconds, 1 minute, 2, 4 and so on, up to 1 hour, with a little random spread.
- If a server stops while running a job, another worker puts the job back after 5 minutes.
- Finished jobs are deleted after 14 days. Failed jobs stay until you look at them.
- Payloads hold only ids, except the password reset link. That link is cleared from the row as soon as the email is sent or gives up.

## Where to look

- **Admin > Settings > Background Jobs** (`/admin/settings/jobs`, admins only): counts, the oldest waiting job, the last 20 failures with their error, and a Retry button.
- **`/api/health`** returns `"jobs": "delayed"` when a job has waited more than 10 minutes. Point your uptime monitor at that field.
- **Logs**: lines with `"type":"jobs.failed"`, `"jobs.delayed"` and `"jobs.error"`. They never contain the payload.

## Without a mail server

If the SMTP settings are empty in production, order and back in stock emails are skipped (marked done), and the jobs page says so. To set up Brevo, see `docs/email-brevo.md`. Password reset emails fail and show in the failed list, because a customer is waiting for that one. In development, emails are printed to the console as before.

## Repeats

A job can run twice if a server stops after sending but before recording "done". For email that means a rare duplicate email. No job charges, refunds or changes stock, so a repeat can never do that. The `unique_key` column stops the same job being queued twice (one confirmation per order, one back in stock email per subscriber per restock).

## Shutting down

On `SIGTERM` the worker stops taking new jobs. Jobs already running are not waited for. Anything cut off is put back after 5 minutes, so nothing is lost.

## More than one server

Every server runs a worker by default, and that is safe. To keep jobs on one server, set `JOBS_WORKER=false` on the others. The worker uses the app's own database pool, so it adds no connections of its own.

## Tests against a real database

The queue and rate limit tests that need Postgres are skipped in CI. Run them against a throwaway database:

```bash
DB_INTEGRATION=1 pnpm --filter @repo/database test
```
