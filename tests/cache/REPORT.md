# Cache test report

Prime Accessories Kenya, production build (`next build` + `next start`), 5 November 2026.
Script: `tests/cache/cache-test.mjs`. Raw data: `results.json`. Route table: `build-routes.txt`.

## Test environment

- 2 vCPU / 7 GB cloud container, Postgres 16 on the same machine, requests from localhost.
- The standard seed plus one cheap test product (4 products, 4 categories).
- Two changes made only in the test copy, because this environment could not download them:
  Prisma ran in its npm-only client mode (`engineType = "client"` with `@prisma/adapter-pg`)
  instead of the native engine, and the three Google fonts were loaded from local files.
  Neither changes what is cached. Absolute timings will differ on your server.

## Short answer

Nothing that reads the database is cached. Every page view runs all its queries again.

- The build marks **54 of 56 routes as dynamic**. Only `robots.txt` and `sitemap.xml` are static.
- Every HTML page returns `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- A **guest viewing a product page costs 33 database queries**. The home page costs 27.
- Warm requests are no faster than cold ones (product page 33 / 34 / 34 ms).

## Header matrix (guest; signed-in results were the same)

| URL | Status | Cache-Control | Who can store it | Expected | Result |
|---|---|---|---|---|---|
| `/` | 200 | private, no-store | nobody | short shared cache | Miss |
| `/products`, `?q=`, `?page=` | 200 | private, no-store | nobody | short shared cache | Miss |
| `/categories/[slug]` | 200 | private, no-store | nobody | short shared cache | Miss |
| `/products/[slug]` | 200 | private, no-store | nobody | short shared cache | Miss |
| `/cart` | 200 | private, no-store | nobody | private, no-store | Pass |
| `/checkout` | 307 to `/cart` (empty cart) | private, no-store | nobody | private, no-store | Pass |
| `/account`, `/admin` (guest) | 307 to `/login` | none | browser heuristic | no-store | Minor |
| `/account`, `/admin` (signed in) | 200 | private, no-store | nobody | private, no-store | Pass |
| `/privacy`, `/terms` | 200 | private, no-store | nobody | long shared cache | Miss |
| `/sitemap.xml`, `/robots.txt` | 200 | public, max-age=0 + **Set-Cookie** | revalidate | public, no cookie | Fail |
| `/api/health` | 200 | none | heuristic | no-store | Minor |
| `/_next/static/*` | 200 | public, max-age=31536000, immutable | browser + CDN | same | Pass |
| `/_next/image` | 200 | public, max-age=60; MISS 295 ms, then HIT 3 ms | browser + CDN | longer | Pass (short) |
| `/uploads/*` | 200 | public, max-age=0 | revalidate | long | Miss |

## Correctness checks

| Check | Result |
|---|---|
| CSP nonce differs on every request | Pass, on every page |
| Signed-in details leaking to a guest | Pass. The guest product page never contained the admin's name or email |
| Cart isolation | Pass. Two shoppers with separate cart cookies each saw only their own item (`tests/load/cart-isolation.js`) |
| Price or stock change visible | Immediate, because nothing is cached |
| Conditional requests (`If-None-Match`) | Not possible: pages send no `ETag` |
| Image optimiser cache | Works: first call MISS 295 ms, second HIT 3 ms |

## Database work per page view (100 views each)

| Page | Queries per view | p50 | p95 |
|---|---|---|---|
| `/` | 27 | 30 ms | 43 ms |
| `/products` | 13 | 24 ms | 28 ms |
| `/products/[slug]` | 33 | 35 ms | 52 ms |
| `/categories/[slug]` | 15 | 25 ms | 37 ms |

Category queries ran 6 times for every category page view. The code confirms why:
`findBySlug` runs twice (once in `generateMetadata`, once in the page), and
`findRootCategories` runs in both the page and `site-footer.tsx`.

## Root causes

1. **Per-request CSP nonce.** `middleware.ts` creates a new nonce for every request and
   `app/layout.tsx` reads it with `headers()`. Reading `headers()` in the root layout makes
   every page dynamic. This is deliberate for security, so the HTML itself cannot be
   shared-cached.
2. **No data caching.** No query uses `unstable_cache`, `"use cache"` or `revalidateTag`, so
   dynamic pages hit the database every time. This is the part that can be fixed without
   weakening security.
3. **`auth()` on the product page** also forces it to be dynamic, even for guests.
4. **The middleware runs Auth.js on every route**, including `robots.txt` and `sitemap.xml`,
   and sets `authjs.csrf-token` and `authjs.callback-url` cookies for new visitors.
   A public response that sets a cookie should never be shared-cached.

## Fixes, most useful first

1. **Cache catalogue data (biggest win).** Wrap the catalogue reads (product by slug, product
   lists, categories, brands, banners, homepage sections, store settings) in
   `unstable_cache` with tags such as `products`, `categories`, `settings`. Call
   `revalidateTag(...)` in the matching admin actions after each save. Pages stay dynamic
   and secure, but most views stop touching the database.
   *Trade-off:* a few lines in each admin action; forgetting a `revalidateTag` shows stale
   data until the cache expires, so also set a safety `revalidate` of a few minutes.
   Keep stock levels uncached, or cache them for only a few seconds.
2. **Load each category query once per request.** Wrap `findBySlug` and
   `findRootCategories` in React `cache()`, the same way `getStoreSettings` already is.
   That removes the duplicate calls from `generateMetadata` and the footer.
3. **Exclude `robots.txt`, `sitemap.xml` and `/api/health` from the middleware matcher.**
   They need no CSP nonce and no auth cookie. Add `Cache-Control: no-store` to `/api/health`.
4. **Serve static files from nginx on the VPS** with long caching: `/_next/static/` for one
   year (immutable), `/uploads/` and `/images/` for 30 days. Raise
   `images.minimumCacheTTL` in `next.config.ts` (for example to 86400) so optimised images
   are not re-checked every 60 seconds.
5. **Leave HTML pages private.** With a per-request nonce, caching HTML at a CDN would serve
   the same nonce to everyone and break the security policy. If you later want CDN caching
   for catalogue pages, you would need a hash-based CSP for those pages instead of a nonce.

## After the fixes (5 November 2026, same machine and data)

| Page | Queries per view before | After |
|---|---|---|
| `/` | 27 | 15 |
| `/products` | 13 | 7 |
| `/products/[slug]` | 33 | 20 |
| `/categories/[slug]` | 15 | 7 |

What changed:
- Categories, brands and site settings (store, homepage, banners) are cached for up to 60 seconds with
  `unstable_cache` (`lib/catalog-cache.ts`). Admin saves call `revalidateTag('catalog')` or
  `revalidateTag('settings')`, so edits show at once.
- The product and its rating summary are read once per request (`lib/request-cache.ts`), not twice.
- `robots.txt` and `sitemap.xml` no longer pass through the auth middleware, so they set no cookies.
- `/api/health` sends `Cache-Control: no-store`. `/uploads/*` is cached for 30 days. Optimised images are
  re-checked after a day instead of a minute.

Not changed, on purpose:
- Products are not cached across requests. Prices are Decimal values that a JSON cache would turn into
  strings, and stock must stay live. The remaining 20 queries on a product page are mostly the product
  itself (variants, images, specs, features, box contents, inventory), related products and reviews.
- HTML pages stay private, because of the per-request CSP nonce.
