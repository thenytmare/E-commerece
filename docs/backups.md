# Database Backups

## What this covers

`scripts/backup-db.js` / `scripts/restore-db.js` back up and restore the **Postgres database only** — every table in `packages/database/prisma/schema.prisma` (products, orders, users, coupons, audit log, etc).

**Not covered:** files uploaded to the Media Library, which are stored on local disk at `apps/web/public/uploads`. If you need those preserved too, back that directory up separately (e.g. `rsync`/`rclone` to off-host storage on the same schedule as the DB dump).

## Manual backup

```bash
pnpm db:backup
```

Produces `backups/<database>-<timestamp>.dump` in Postgres custom format (`pg_dump --format=custom`), which is compressed and restorable with `pg_restore`. Uses `pg_dump` directly if it's on `PATH`; otherwise falls back to running it inside the `postgres` container via `docker compose exec`, so this works whether Postgres is local, in Docker, or on the VPS.

Old dumps are pruned automatically after `BACKUP_RETENTION_DAYS` (default 14). Override with e.g. `BACKUP_RETENTION_DAYS=30 pnpm db:backup`.

`backups/` is git-ignored — dumps are never committed.

## Manual restore

```bash
pnpm db:restore -- backups/<file>.dump --yes
```

`--yes` is required — the script refuses to run without it, since restore is destructive (`pg_restore --clean --if-exists` drops existing objects in the target database before restoring).

To restore into a different database instead of the one in `.env` (e.g. to verify a backup without touching production data):

```bash
pnpm db:restore -- backups/<file>.dump --yes --target="postgresql://user:pass@host:5432/scratch_db"
```

## Scheduling automated backups (production VPS)

The README's production target is a Host Africa VPS running the app via Docker. Add a cron job on the VPS host (not inside the container, so it survives container restarts):

```cron
# Nightly backup at 02:00 server time
0 2 * * * cd /path/to/e-commerce && /usr/bin/pnpm db:backup >> /var/log/prime-accessories-backup.log 2>&1
```

**This alone is not sufficient for production.** A cron job writing dumps to the same disk as the live database protects against logical corruption and accidental data loss (bad migration, bad delete), but not against disk/VM failure — if the disk dies, the dumps die with it. For real production durability, also sync `backups/` to storage on a different physical host after each run, e.g.:

```cron
30 2 * * * rclone sync /path/to/e-commerce/backups remote:prime-accessories-backups
```

(`rclone` supports S3, Backblaze B2, and most other object storage — pick whichever your host offers, configure it once with `rclone config`, and add this line after the backup line above.)

## Verifying backups actually restore

A backup you've never restored is not a verified backup. Periodically (e.g. monthly) test a real restore into a scratch database:

```bash
# create a throwaway database first, then:
pnpm db:restore -- backups/<latest>.dump --yes --target="postgresql://user:pass@host:5432/restore_test"
```

If this fails, your backups are not protecting you — fix it before you need it for real.
