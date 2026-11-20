# Database connection budget

Each running process (the web app, a backup or admin script) has its own pool of database connections. Adding a process adds its pool. The total must stay under the Postgres limit.

## The rule

```text
app pools + any separate script pools + 5 (admin, backups, migrations) < max_connections
```

Postgres 16 ships with `max_connections = 100`. Check yours with `SHOW max_connections;`. A managed database may set a lower number.

## How to set the pool size

Prisma reads the pool size from the `DATABASE_URL` query string. No code change is needed.

```text
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10
```

- `connection_limit`: connections for one process. If you leave it out, Prisma uses (number of CPU cores x 2) + 1. On a 2-core server that is 5. On an 8-core server it is 17, which is easy to forget when you move to a bigger server.
- `pool_timeout`: seconds a request waits for a free connection before it fails. 10 is the Prisma default. Keep it, so a stuck database shows as errors instead of requests hanging forever.

Set the number on purpose so it does not change when the server size changes.

## What the load test showed

At 100 users and at full saturation, the app used 5 connections and they were idle at every 30-second sample. No lock waits. The slowest query averaged under 1 ms. The pool was not the limit. CPU was. See `docs/performance-baseline.md`.

So a bigger pool would not make the site faster today.

## Suggested settings

| Process | connection_limit | Why |
|---|---|---|
| Web app | 10 | Twice what the test needed at full load. Room for slow moments. |
| Job worker | 0 extra | It runs inside the app and shares the app's pool. Up to 5 jobs at a time. |
| Reserve | 5 | psql, backups, migrations, the admin seed script. |

| Setup | Total | Under 100? |
|---|---|---|
| 1 app | 10 + 5 = 15 | Yes |
| 2 apps | 20 + 5 = 25 | Yes |
| 4 apps | 40 + 5 = 45 | Yes |

## When to think about PgBouncer

Only when the total above gets close to `max_connections`, for example many app instances or serverless functions. A pooler limits connections. It does not make slow queries faster.
