/**
 * Imports the scraped catalogue (scripts/catalog-scraper/data/detra-catalog.json)
 * into the database, optionally multiplying it for load tests.
 *
 *   pnpm --filter @repo/database exec tsx prisma/import-catalog.ts [options]
 *
 * Options
 *   --file <path>      JSON file; repeat it to import several (default: detra-catalog.json)
 *   --multiply <n>     Also create n extra "load test" clones of the real products
 *   --remote-images    Link the original image URLs instead of the downloaded copies
 *   --placeholder-images  Ignore scraped images; use the two local placeholders
 *   --dry-run          Print what would happen; touch nothing
 *   --clean            Remove everything this script created, then exit
 *   --include-orders   With --clean: also delete test orders that contain those products
 *   --allow-production Needed when NODE_ENV=production
 *
 * Every row it creates has an id starting with "det-" (real) or "lt-det-"
 * (clones). The clones also match the "lt-%" clean-up in tests/load/seed-large.sql.
 * Run it on a TEST database only.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ScrapedProduct {
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  shortDescription: string;
  description?: string;
  features: string[];
  images: string[];
  localImages?: string[];
}
interface ScrapedFile {
  categories: { slug: string; name: string; sortOrder: number }[];
  products: ScrapedProduct[];
}

const args = process.argv.slice(2);
const has = (n: string) => args.includes(`--${n}`);
const val = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : (args[i + 1] ?? d);
};

// --file can be repeated to import several catalogues in one run.
const FILES = args.flatMap((a, i) => {
  const next = args[i + 1];
  return a === '--file' && next ? [resolve(process.cwd(), next)] : [];
});
if (!FILES.length) FILES.push(resolve(process.cwd(), '../../scripts/catalog-scraper/data/detra-catalog.json'));
const MULTIPLY = Math.max(0, Number(val('multiply', '0')) || 0);
const REMOTE_IMAGES = has('remote-images');
const PLACEHOLDER_ONLY = has('placeholder-images');
const DRY = has('dry-run');
const PLACEHOLDERS = [
  '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp',
  '/images/products/oraimo-Power-Bank-PowerNova-Q31-OPB-7300Q-mainimage.webp',
];

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');
const chunks = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

// Small deterministic random generator so re-runs give the same data.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CLONE_SUFFIXES = ['Black', 'White', 'Blue', 'Pro', 'Lite', 'Plus', 'Max', 'Mini', 'Gen 2', 'Special Edition'];

async function main() {
  if (process.env.NODE_ENV === 'production' && !has('allow-production')) {
    throw new Error('NODE_ENV is production. Use a test database, or pass --allow-production if you really mean it.');
  }

  // tsx does not read .env files. Load DATABASE_URL from the usual places so the
  // host shown below is the one that will really be used.
  if (!process.env.DATABASE_URL) {
    for (const p of ['.env', '../../.env']) {
      try {
        const line = readFileSync(resolve(process.cwd(), p), 'utf8')
          .split(/\r?\n/)
          .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
        if (line) {
          process.env.DATABASE_URL = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^["']|["']\s*$/g, '').trim();
          break;
        }
      } catch {
        /* file not there; try the next one */
      }
    }
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  const host = dbUrl.replace(/^[a-z]+:\/\/[^@]*@/i, '').split(/[/?]/)[0] || '(DATABASE_URL not set)';

  if (has('clean')) {
    console.log(`Cleaning det-* and lt-det-* rows from ${host}`);
    if (DRY) return console.log('dry run: nothing deleted');
    const { PrismaClient } = await import('@prisma/client');
    const db = new PrismaClient();
    try {
      const ours = [{ productId: { startsWith: 'det-' } }, { productId: { startsWith: 'lt-det-' } }];

      // Carts and orders that point at these products would block the delete.
      const cartRows = await db.cartItem.deleteMany({ where: { variant: { OR: ours } } });
      if (cartRows.count) console.log(`  removed ${cartRows.count} cart items that held these products`);
      const orderItems = await db.orderItem.count({ where: { OR: ours } });
      if (orderItems > 0) {
        if (!has('include-orders')) {
          throw new Error(
            `${orderItems} order lines (from test orders) use these products, so they cannot be deleted. ` +
              'If those are only load-test orders, run again with --include-orders to delete those orders too.',
          );
        }
        const ids = (await db.orderItem.findMany({ where: { OR: ours }, select: { orderId: true }, distinct: ['orderId'] })).map((o) => o.orderId);
        for (const batch of chunks(ids, 500)) {
          await db.payment.deleteMany({ where: { orderId: { in: batch } } });
          await db.orderStatusHistory.deleteMany({ where: { orderId: { in: batch } } });
          await db.shipment.deleteMany({ where: { orderId: { in: batch } } });
          await db.order.deleteMany({ where: { id: { in: batch } } });
        }
        console.log(`  removed ${ids.length} test orders`);
      }

      await db.productImage.deleteMany({ where: { OR: ours } });
      await db.productFeature.deleteMany({ where: { OR: ours } });
      await db.inventory.deleteMany({ where: { OR: [{ variantId: { startsWith: 'det-' } }, { variantId: { startsWith: 'lt-det-' } }] } });
      await db.productVariant.deleteMany({ where: { OR: [{ productId: { startsWith: 'det-' } }, { productId: { startsWith: 'lt-det-' } }] } });
      const p = await db.product.deleteMany({ where: { OR: [{ id: { startsWith: 'det-' } }, { id: { startsWith: 'lt-det-' } }] } });
      await db.brand.deleteMany({ where: { id: { startsWith: 'det-' } } });
      await db.category.deleteMany({ where: { id: { startsWith: 'det-' } } });
      console.log(`Removed ${p.count} products (and their variants, stock, images, brands, categories).`);
    } finally {
      await db.$disconnect();
    }
    return;
  }

  // Merge all files. A product slug seen twice keeps its first version.
  const data: ScrapedFile = { categories: [], products: [] };
  const seenCats = new Set<string>();
  const seenProducts = new Set<string>();
  for (const f of FILES) {
    const part = JSON.parse(readFileSync(f, 'utf8')) as ScrapedFile;
    let added = 0;
    for (const c of part.categories) {
      if (!seenCats.has(c.slug)) {
        seenCats.add(c.slug);
        data.categories.push({ ...c, sortOrder: data.categories.length + 1 });
      }
    }
    for (const p of part.products) {
      if (!seenProducts.has(p.slug)) {
        seenProducts.add(p.slug);
        data.products.push(p);
        added++;
      }
    }
    console.log(`Read ${part.products.length} products from ${f} (${added} new)`);
  }
  console.log(`Total: ${data.products.length} products, ${data.categories.length} categories`);
  console.log(`Target database host: ${host}`);

  // ── Build rows ──────────────────────────────────────────────────────────────
  const brandNames = [...new Set(data.products.map((p) => p.brand))];
  const brands = brandNames.map((name) => ({
    id: `det-b-${slugify(name)}`,
    name,
    slug: `det-${slugify(name)}`.replace(/^det-/, ''),
    isActive: true,
  }));
  const brandId = new Map(brands.map((b) => [b.name, b.id]));

  const categories = data.categories.map((c) => ({
    id: `det-c-${c.slug}`,
    name: c.name,
    slug: c.slug,
    sortOrder: 200 + c.sortOrder,
    isActive: true,
  }));
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

  type Row = {
    product: Record<string, unknown>;
    variant: Record<string, unknown>;
    stock: Record<string, unknown>;
    images: Record<string, unknown>[];
    features: Record<string, unknown>[];
  };
  const makeRow = (src: ScrapedProduct, id: string, name: string, slug: string, price: number, compare: number | null, n: number): Row => {
    const rand = rng(n + 1);
    // Order of preference: --remote-images, then downloaded local files, then a placeholder.
    const urls = PLACEHOLDER_ONLY
      ? [PLACEHOLDERS[n % PLACEHOLDERS.length]]
      : REMOTE_IMAGES && src.images.length
        ? src.images
        : src.localImages?.length
          ? src.localImages
          : [PLACEHOLDERS[n % PLACEHOLDERS.length]];
    const images = urls.map((url, i) => ({
      id: `${id}-img-${i}`,
      productId: id,
      url,
      alt: name,
      sortOrder: i,
      isFeatured: i === 0,
    }));
    return {
      product: {
        id,
        brandId: brandId.get(src.brand)!,
        categoryId: categoryId.get(src.categorySlug)!,
        name,
        slug,
        shortDescription: src.shortDescription || null,
        description: src.description || src.shortDescription || `${name}. Imported for load testing.`,
        basePrice: price,
        compareAtPrice: compare,
        status: 'active',
        isFeatured: n % 12 === 0,
        isActive: true,
      },
      variant: {
        id: `${id}-v`,
        productId: id,
        sku: `${id.startsWith('lt-') ? 'LT' : 'DET'}-${hash(slug).toUpperCase()}`,
        price,
        compareAtPrice: compare,
        attributes: {},
        isDefault: true,
      },
      stock: {
        id: `${id}-i`,
        variantId: `${id}-v`,
        quantity: src.inStock ? 20 + Math.floor(rand() * 180) : 0,
        reserved: 0,
        lowStockThreshold: 5,
      },
      images,
      features: src.features.map((text, i) => ({ id: `${id}-f-${i}`, productId: id, text, sortOrder: i })),
    };
  };

  const rows: Row[] = data.products.map((p, n) => makeRow(p, `det-p-${hash(p.slug)}`, p.name, p.slug, p.price, p.compareAtPrice, n));

  const usedSlugs = new Set(rows.map((r) => r.product.slug as string));
  for (let i = 1; i <= MULTIPLY; i++) {
    const src = data.products[(i - 1) % data.products.length];
    if (!src) break; // empty catalogue: nothing to clone
    const rand = rng(i * 7919);
    const suffix = CLONE_SUFFIXES[Math.floor(rand() * CLONE_SUFFIXES.length)];
    const factor = 0.8 + rand() * 0.4;
    const price = Math.max(100, Math.round((src.price * factor) / 10) * 10);
    const compare = src.compareAtPrice ? Math.round((price * (src.compareAtPrice / src.price)) / 10) * 10 : null;
    const slug = `${src.slug}-lt${i}`;
    if (usedSlugs.has(slug)) continue;
    usedSlugs.add(slug);
    rows.push(makeRow(src, `lt-det-p-${i}`, `${src.name} ${suffix} ${i}`, slug, price, compare, data.products.length + i));
  }
  console.log(`Plan: ${brands.length} brands, ${categories.length} categories, ${rows.length} products (${data.products.length} real + ${rows.length - data.products.length} clones)`);

  if (DRY) {
    console.log('Dry run: nothing written. Sample product:');
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    const t0 = Date.now();
    await db.brand.createMany({ data: brands as never, skipDuplicates: true });
    await db.category.createMany({ data: categories as never, skipDuplicates: true });
    // Brand/category slugs may already exist from the normal seed (e.g. "power-banks").
    // Re-point rows at whichever record owns the slug.
    const existingBrands = await db.brand.findMany({ select: { id: true, slug: true, name: true } });
    const existingCats = await db.category.findMany({ select: { id: true, slug: true } });
    const bySlugBrand = new Map(existingBrands.map((b) => [b.slug, b.id]));
    const bySlugCat = new Map(existingCats.map((c) => [c.slug, c.id]));
    const brandIdFix = new Map(brands.map((b) => [b.id, bySlugBrand.get(b.slug) ?? b.id]));
    const catIdFix = new Map(categories.map((c) => [c.id, bySlugCat.get(c.slug) ?? c.id]));
    for (const r of rows) {
      r.product.brandId = brandIdFix.get(r.product.brandId as string) ?? r.product.brandId;
      r.product.categoryId = catIdFix.get(r.product.categoryId as string) ?? r.product.categoryId;
    }

    for (const batch of chunks(rows, 500)) {
      await db.product.createMany({ data: batch.map((r) => r.product) as never, skipDuplicates: true });
      await db.productVariant.createMany({ data: batch.map((r) => r.variant) as never, skipDuplicates: true });
      await db.inventory.createMany({ data: batch.map((r) => r.stock) as never, skipDuplicates: true });
      await db.productImage.createMany({ data: batch.flatMap((r) => r.images) as never, skipDuplicates: true });
      await db.productFeature.createMany({ data: batch.flatMap((r) => r.features) as never, skipDuplicates: true });
      process.stdout.write('.');
    }
    const total = await db.product.count({ where: { isActive: true, deletedAt: null } });
    console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Active products in database: ${total}`);
    console.log('Next: node tests/load/lib/slugs.mjs   (refresh slugs for k6)');
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
