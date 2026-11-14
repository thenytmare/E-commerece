# Coolify deployment

Use the repository root as the Docker build context, `/Dockerfile` as the
Dockerfile location, and `runner` as the application's build stage target.
The application listens on port `3000`. Mount a named volume at `/data/uploads`.
The root `.dockerignore` excludes environment files at every depth, local build
output, dependencies, backups, generated test reports, and local uploads.

## Environment variables

| Variable | Build | Runtime | Value |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes | `https://primeaccessorieskenya.store` |
| `DATABASE_URL` | No | Yes | Coolify's internal PostgreSQL URL, with a `postgresql://` prefix |
| `AUTH_SECRET` | No | Yes | A unique, cryptographically random secret of at least 32 characters |
| `AUTH_URL` | No | Yes | `https://primeaccessorieskenya.store` |
| `HOSTNAME` | No | Yes | `0.0.0.0` |
| `JOBS_WORKER` | No | Yes | `false` during the initial data transfer and review |

Use literal interpolation for these values. Keep provider credentials runtime
only too. Configure payments and outbound email separately before opening the
shop to customers. Do not enable `AUTH_INSECURE_COOKIES` on the VPS.

`NEXT_PUBLIC_APP_URL` is public configuration compiled into the image; changing
it requires a rebuild. The Docker build supplies a temporary random auth secret
and a nonfunctional database URL only to the build command, not to the runtime
image. Startup still requires the real runtime credentials. The sitemap reads
the live catalog at request time so it does not need a database during builds.

## Database initialization and upgrades

Use PostgreSQL 16 on the same private Docker network as the application. Keep
public database access and host port mappings disabled.

The `migrator` stage contains Prisma's migration CLI and migration files. It
does not depend on the web build and does not require the application's auth
secret or public URL. The minimal `runner` image is not a migration environment.

From a checkout of the intended release on the deployment server:

```sh
docker build --target migrator -t primeaccessories-migrate .
```

In a Bash terminal, read the internal connection string without putting it in
shell history, run migrations on Coolify's network, then clear the variable:

```bash
read -r -s -p 'Internal DATABASE_URL: ' DATABASE_URL
printf '\n'
export DATABASE_URL
docker run --rm --network coolify -e DATABASE_URL primeaccessories-migrate
unset DATABASE_URL
```

Use the actual destination network name if it differs from `coolify`. Continue
only after the command reports success. It uses `prisma migrate deploy`; never
use `migrate dev` or reset commands on the production database.

For an existing database, take a backup first. When transferring the local
database, restore the backup into the intended destination before applying new
migrations, and inspect its migration history. A database originally created
with `db push` may require baselining; do not mark migrations as applied without
verifying the schema. Copy local uploaded media separately into the uploads
volume. Do not seed sample data into a restored store.

Keep `JOBS_WORKER=false` while restoring and reviewing copied pending jobs.
Enable it after that review so queued mail, notifications, and housekeeping
resume deliberately. The new production auth secret means users must sign in
again; existing account passwords remain valid after a full database restore.

For a fresh database, migrations create tables only. Catalog data and an admin
account must be provisioned separately before launch.

## First deployment checks

Configure the HTTPS domains in Coolify and keep the application on its default
deployment server. Leave image registry, pre/post deployment commands, and
custom Docker options empty unless they are deliberately configured later.

After migrations succeed, deploy `runner`. Check `/api/health` for HTTP 200 with
`db: "ok"`, verify anonymous `/admin` access redirects to login, and test image
uploads with the mounted volume. Confirm `/robots.txt` and `/sitemap.xml` use
the public HTTPS domain. Set up off-server backups for PostgreSQL and uploads.
