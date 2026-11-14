// Cache test for Prime Accessories Kenya.
//
// Finds out what is really cached, rather than assuming. Run against a
// production build (`pnpm --filter @repo/web build && pnpm --filter @repo/web start`)
// with the seeded database. Writes tests/cache/results.json.
//
//   BASE_URL=http://localhost:3000 DATABASE_URL=postgresql://... node tests/cache/cache-test.mjs
//
// Needs: Playwright (already a dev dependency) for the signed-in checks, and
// the pg_stat_statements extension for the query counts (skipped if missing).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@primeaccessorieskenya.co.ke';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';
const DATABASE_URL = process.env.DATABASE_URL;

const HEADERS = ['cache-control', 'etag', 'vary', 'age', 'x-nextjs-cache', 'x-nextjs-prerender', 'set-cookie'];

const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);
const nonceOf = (csp) => /nonce-([^']+)/.exec(csp ?? '')?.[1] ?? null;
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function get(path, cookie, extra = {}) {
  const started = performance.now();
  const res = await fetch(BASE + path, {
    headers: { ...(cookie ? { cookie } : {}), ...extra },
    redirect: 'manual',
  });
  const body = Buffer.from(await res.arrayBuffer());
  const ms = performance.now() - started;
  const headers = Object.fromEntries(HEADERS.map((h) => [h, res.headers.get(h)]));
  // Cache checks need only cookie presence; never save authentication tokens.
  if (headers['set-cookie'] !== null) headers['set-cookie'] = '[REDACTED]';
  return {
    status: res.status,
    ms,
    headers,
    nonce: nonceOf(res.headers.get('content-security-policy')),
    bodyHash: hash(body),
    body: body.toString('utf8'),
  };
}

/** Who may store this response, judged from Cache-Control and Set-Cookie. */
function cacheability(h) {
  const cc = (h['cache-control'] ?? '').toLowerCase();
  if (!cc) return { who: 'heuristic (no Cache-Control)', ttl: null };
  if (cc.includes('no-store')) return { who: 'nobody', ttl: 0 };
  if (cc.includes('private')) return { who: 'browser only', ttl: maxAge(cc) };
  if (cc.includes('no-cache')) return { who: 'revalidate every time', ttl: 0 };
  if (cc.includes('public') || cc.includes('s-maxage') || cc.includes('max-age'))
    return { who: h['set-cookie'] ? 'UNSAFE: public + Set-Cookie' : 'browser + CDN', ttl: maxAge(cc) };
  return { who: 'unclear', ttl: null };
}
function maxAge(cc) {
  const m = /s-maxage=(\d+)/.exec(cc) ?? /max-age=(\d+)/.exec(cc);
  return m ? Number(m[1]) : null;
}

async function signIn() {
  const { chromium } = require(require.resolve('playwright', { paths: [process.cwd() + '/apps/web'] }));
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  const cookies = await context.cookies();
  await browser.close();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

async function pg() {
  if (!DATABASE_URL) return null;
  try {
    // pg ships with the Prisma tooling; resolve it from the workspace.
    const pgPath = require.resolve('pg', {
      paths: [process.cwd() + '/packages/database', process.cwd() + '/node_modules/.pnpm/node_modules'],
    });
    const pgMod = require(pgPath);
    const client = new pgMod.Client({ connectionString: DATABASE_URL.replace(/\?.*$/, '') });
    await client.connect();
    await client.query('select pg_stat_statements_reset()');
    return client;
  } catch (error) {
    console.warn('Query counting skipped:', error.message);
    return null;
  }
}

async function main() {
  // Real paths from the running site.
  const productsHtml = (await get('/products')).body;
  const productSlug = /href="\/products\/([^"?#]+)"/.exec(productsHtml)?.[1];
  const categorySlug = /href="\/categories\/([^"?#]+)"/.exec(productsHtml)?.[1];
  const chunk = /\/_next\/static\/chunks\/[^"]+\.js/.exec(productsHtml)?.[0];
  const image = /\/(?:images|uploads)\/[^"?]+\.(?:webp|png|jpg|jpeg)/.exec(productsHtml)?.[0];

  const urls = [
    '/', '/products', '/products?q=anker', '/products?page=2',
    `/categories/${categorySlug}`, `/products/${productSlug}`,
    '/cart', '/checkout', '/account', '/admin', '/privacy', '/terms',
    '/sitemap.xml', '/robots.txt', '/api/health',
    chunk, image && `/_next/image?url=${encodeURIComponent(image)}&w=640&q=75`,
    '/uploads/1784539889829-hya9swgxnl.webp',
  ].filter(Boolean);

  const adminCookie = await signIn();
  const matrix = [];
  for (const who of ['guest', 'signed-in']) {
    const cookie = who === 'guest' ? undefined : adminCookie;
    for (const url of urls) {
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await get(url, cookie));
      const last = runs[2];
      matrix.push({
        who,
        url,
        status: last.status,
        ...last.headers,
        cacheability: cacheability(last.headers),
        noncesDiffer: runs[0].nonce ? new Set(runs.map((r) => r.nonce)).size === 3 : null,
        bodyStable: new Set(runs.map((r) => r.bodyHash)).size === 1,
        msColdWarmWarm: runs.map((r) => Math.round(r.ms)),
      });
    }
  }

  // Personalisation leak: a guest must never see the signed-in user's details.
  const productPath = `/products/${productSlug}`;
  const asAdmin = await get(productPath, adminCookie);
  const asGuest = await get(productPath);
  const leak = {
    adminPageMentionsAdmin: /Admin|admin@/.test(asAdmin.body),
    guestPageMentionsAdmin: asGuest.body.includes(ADMIN_EMAIL) || /Prime Accessories Kenya Admin/.test(asGuest.body),
  };

  // Conditional request.
  const first = await get(productPath);
  const conditional = first.headers.etag
    ? (await get(productPath, undefined, { 'if-none-match': first.headers.etag })).status
    : 'no ETag sent';

  // Image optimiser cache.
  const imageUrl = urls.find((u) => u.startsWith('/_next/image'));
  const imageRuns = [];
  if (imageUrl) {
    // A width not requested above, so the first call is a genuine cold hit.
    const coldUrl = imageUrl.replace('w=640', 'w=828');
    for (let i = 0; i < 2; i++) {
      const r = await get(coldUrl);
      imageRuns.push({ status: r.status, cache: r.headers['x-nextjs-cache'], ms: Math.round(r.ms) });
    }
  }

  // Database work per page view, and timings.
  const timing = {};
  const queries = {};
  const db = await pg();
  for (const path of ['/', '/products', productPath, `/categories/${categorySlug}`]) {
    if (db) await db.query('select pg_stat_statements_reset()');
    const times = [];
    for (let i = 0; i < 100; i++) times.push((await get(path)).ms);
    times.sort((a, b) => a - b);
    timing[path] = { n: 100, p50: Math.round(pct(times, 50)), p95: Math.round(pct(times, 95)), first: null };
    if (db) {
      const { rows } = await db.query(
        `select coalesce(sum(calls),0)::int as calls from pg_stat_statements
         where query not ilike '%pg_stat_statements%' and dbid = (select oid from pg_database where datname = current_database())`
      );
      queries[path] = { totalFor100Views: rows[0].calls, perView: +(rows[0].calls / 100).toFixed(1) };
    }
  }
  if (db) await db.end();

  const results = { base: BASE, at: new Date().toISOString(), matrix, leak, conditional, imageRuns, timing, queries };
  writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ leak, conditional, imageRuns, timing, queries }, null, 2));
  console.table(
    matrix.map((r) => ({
      who: r.who,
      url: r.url.length > 48 ? r.url.slice(0, 45) + '...' : r.url,
      status: r.status,
      cacheControl: r['cache-control'],
      cache: r['x-nextjs-cache'],
      storedBy: r.cacheability.who,
      cookie: r['set-cookie'] ? 'yes' : '',
      nonceFresh: r.noncesDiffer,
    }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
