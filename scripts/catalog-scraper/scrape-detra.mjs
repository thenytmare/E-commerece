// Scrapes categories and products from detraaccessories.com into a JSON file.
//
//   cd scripts/catalog-scraper
//   npm install && npx playwright install chromium
//   node scrape-detra.mjs --limit 5     # trial run on 5 products
//   node scrape-detra.mjs               # full run (about 5 to 8 minutes)
//
// Polite by design: one page at a time, a pause between pages, only the
// /product and /category pages that robots.txt allows. It never touches
// /api, /checkout, /search or /studio.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCategoryInPage, extractProductInPage, revealGalleryInPage } from './extract.mjs';

// Another shop can be scraped with:  --site https://www.example.com
const ORIGIN = (process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : 'https://www.detraaccessories.com').replace(/\/$/, '');
const UA = 'PrimeAccessoriesLoadTestSeeder/1.0 (owner-run catalogue import for a private test database)';
const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const LIMIT = Number(flag('limit', 0)) || Infinity;
const DELAY_MS = Number(flag('delay', 1500));
const OUT = resolve(flag('out', resolve(here, 'data/detra-catalog.json')));
const DEBUG_DIR = resolve(here, 'data/debug');
// Images are saved into the web app's public folder so the shop serves them itself.
const WEB_PUBLIC = resolve(flag('web-public', resolve(here, '../../apps/web/public')));
const IMAGE_SUBDIR = flag('image-dir', 'images/products/detra');
// --survey: read the sitemap and category pages only, print counts, download nothing.
const SURVEY = args.includes('--survey');
// --classify: save images in <image-dir>/<brand>/<category>/ and write a CSV manifest.
const CLASSIFY = args.includes('--classify');
const MAX_IMAGES = Number(flag('max-images', 30));
const IMAGE_WIDTH = Number(flag('width', 900)); // Sanity CDN resize width (px)
// --no-brand: with --classify, folders are <category>/ only, with no brand level.
const NO_BRAND = args.includes('--no-brand');
const DOWNLOAD_IMAGES = !args.includes('--no-images');

// Categories that overlap with every other one; never pick them as "home".
const GENERIC = new Set(['deals', 'clearance', 'others']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugOf = (s) => s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');
const titleCase = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const BRANDS = [
  'Oraimo', 'Soundcore', 'Anker', 'JBL', 'Xiaomi', 'Redmi', 'Havit', 'Infinix', 'Itel', 'SanDisk',
  'Joyroom', 'Joy Room', 'Samsung', 'Budi', 'Utarudi', 'Baseus', 'Ugreen', 'Tecno', 'Oppo', 'Apple',
  'Huawei', 'Realme', 'Philips', 'Kemei', 'Vention', 'Hoco', 'Remax', 'Tp-Link', 'Tenda', 'Awei', 'Amaya', 'Hollyland', 'Harman Kardon', 'Ecoflow', 'DJI', 'Moxom', 'CMF', 'Richripple', 'Rich Ripple',
];
// Fallback product type from the name, used with --no-brand when a product
// is listed only on a brand page.
const TYPE_RULES = [
  [/power\s?station|river\s?\d|delta\s?\d|jump\s?start/i, 'powerstations-and-powerstation-accessories', 'Power Stations'],
  [/power\s?bank|powerbank|mah/i, 'powerbanks', 'Power Banks'],
  [/neck\s?band|necklace/i, 'neckbands', 'Neckbands'],
  [/smart\s?watch|watch|\bband\b/i, 'smart-watches', 'Smart Watches'],
  [/speaker|boombox|soundbar/i, 'bluetooth-speakers', 'Bluetooth Speakers'],
  [/headphone|headset/i, 'headphones', 'Headphones'],
  [/earbud|earphone|buds|pods|airbuds|tws/i, 'earphones', 'Earphones'],
  [/microphone|mic\b/i, 'microphones', 'Microphones'],
  [/trimmer|clipper|shaver/i, 'trimmers-and-clippers', 'Trimmers and Clippers'],
  [/flash\s?drive|usb drive|sd card|memory card|ssd|hard drive|storage/i, 'storage', 'Storage'],
  [/charger|cable|adapter|gan\b|wireless charg/i, 'charging-solutions', 'Charging Solutions'],
  [/holder|stand|mount/i, 'phone-holder', 'Phone Holders'],
  [/controller|gamepad|gaming/i, 'gaming', 'Gaming'],
  [/mifi|hotspot|router/i, 'mifi', 'MiFi'],
  [/blender|kettle|fryer|iron|steamer|coffee|vacuum/i, 'home-appliances', 'Home Appliances'],
  [/keyboard|mouse|laptop|webcam/i, 'computer-accessories', 'Computer Accessories'],
];
function typeFromName(name) {
  const hit = TYPE_RULES.find(([re]) => re.test(name));
  return hit ? { slug: hit[1], name: hit[2] } : null;
}

function detectBrand(name, categorySlug) {
  const lower = name.toLowerCase();
  const hit = BRANDS.find((b) => new RegExp(`(^|\\W)${b.toLowerCase().replace(/[-\s]/g, '[-\\s]?')}(\\W|$)`).test(lower));
  if (hit) return hit === 'Joy Room' ? 'Joyroom' : hit;
  const fromCat = BRANDS.find((b) => slugOf(b) === categorySlug);
  return fromCat ?? 'Generic';
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(45000);

  // 1. Sitemap
  console.log('Reading sitemap...');
  const res = await context.request.get(`${ORIGIN}/sitemap.xml`);
  if (!res.ok()) throw new Error(`sitemap.xml returned ${res.status()}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
  const categoryPaths = [...new Set(locs.filter((p) => /^\/category\/[^/]+$/.test(p)))];
  const productPaths = [...new Set(locs.filter((p) => /^\/product\/[^/]+$/.test(p)))];
  console.log(`  ${categoryPaths.length} category URLs, ${productPaths.length} product URLs`);

  // 2. Categories (client-rendered, so use the browser). Merge /Oraimo and /oraimo.
  const categories = new Map(); // slug -> { slug, name, productPaths: Set }
  for (const path of categoryPaths) {
    const slug = slugOf(decodeURIComponent(path.split('/').pop()));
    try {
      await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href^="/product/"], :text("No products found")', { timeout: 12000 }).catch(() => {});
      // Scroll to trigger any lazy loading.
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 2500);
        await sleep(400);
      }
      const data = await page.evaluate(extractCategoryInPage);
      const entry = categories.get(slug) ?? { slug, name: data.title || titleCase(slug), productPaths: new Set() };
      if (data.title && !entry.name) entry.name = data.title;
      data.productPaths.forEach((p) => entry.productPaths.add(p));
      categories.set(slug, entry);
      console.log(`  category ${slug}: ${data.productPaths.length} products${data.noProducts ? ' (page says none)' : ''}`);
    } catch (err) {
      console.warn(`  category ${slug} failed: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  // Product -> best category: the most specific one (fewest products), ignoring generic ones.
  const memberships = new Map();
  for (const c of categories.values()) {
    for (const p of c.productPaths) {
      if (!memberships.has(p)) memberships.set(p, []);
      memberships.get(p).push(c);
    }
  }
  // Brand-named categories (itel, havit, oraimo...) say who made it, not what it is.
  const BRAND_CATS = new Set([
    'xiamoi-redmi-mi', 'xiaomi-redmi-mi', 'sandisc-external-storage', 'joy-room', 'soundcore-anker',
    // qualityaccessories.store brand pages
    'mi', 'cmf-by-nothing', 'richripple', 'oraimo-home', 'harman-kardon', 'hollyland', 'ecoflow', 'dji', 'moxom',
  ]);
  const isBrandCat = (slug) => BRAND_CATS.has(slug) || BRANDS.some((b) => slug.startsWith(slugOf(b)));
  const pickCategory = (path) => {
    const all = (memberships.get(path) ?? []).filter((c) => !GENERIC.has(c.slug));
    // Prefer a product-type category; fall back to a brand category.
    const list = all.some((c) => !isBrandCat(c.slug)) ? all.filter((c) => !isBrandCat(c.slug)) : all;
    if (!list.length) return null;
    return list.sort((a, b) => a.productPaths.size - b.productPaths.size)[0];
  };

  if (SURVEY) {
    const rows = [...categories.values()]
      .map((c) => ({ slug: c.slug, name: c.name, products: c.productPaths.size, kind: GENERIC.has(c.slug) ? 'generic' : isBrandCat(c.slug) ? 'brand' : 'type' }))
      .sort((a, b) => b.products - a.products);
    console.log('\nCategory survey (a product can appear in more than one category):');
    console.table(rows);
    const listed = new Set([...memberships.keys()]);
    console.log(`Sitemap products: ${productPaths.length}. Products found on category pages: ${listed.size}.`);
    console.log(`Not on any category page: ${productPaths.filter((p) => !listed.has(p)).length}`);
    const outFile = resolve(here, 'data/survey.json');
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify({ site: ORIGIN, sitemapProducts: productPaths.length, categories: rows }, null, 2));
    console.log(`Saved ${outFile}`);
    await browser.close();
    return;
  }

  // 3. Products
  const targets = productPaths.slice(0, LIMIT);
  const products = [];
  const manifest = []; // one row per saved image
  let debugSaved = 0;
  mkdirSync(DEBUG_DIR, { recursive: true });
  for (const [i, path] of targets.entries()) {
    let data = null;
    for (let attempt = 1; attempt <= 2 && !data; attempt++) {
      try {
        await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded' });
        // Most shops have an <h1>; qualityaccessories.store does not, so also accept "Add to Cart".
        await page.waitForFunction(() => document.querySelector('h1') || /add to cart/i.test(document.body.innerText), null, { timeout: 20000 });
        await sleep(600); // let prices and images hydrate
        await page.evaluate(revealGalleryInPage).catch(() => {}); // click thumbnails so every image loads
        await sleep(400);
        data = await page.evaluate(extractProductInPage);
      } catch (err) {
        if (attempt === 2) console.warn(`  ! ${path}: ${err.message}`);
        await sleep(2000);
      }
    }
    if (!data && debugSaved < 3) {
      // Save the page we could not read, so the reader can be fixed from real HTML.
      writeFileSync(resolve(DEBUG_DIR, `failed-${debugSaved + 1}.html`), await page.content());
      debugSaved++;
    } else if (debugSaved < 3 && data) {
      writeFileSync(resolve(DEBUG_DIR, `product-${debugSaved + 1}.html`), await page.content());
      debugSaved++;
    }
    if (!data || !data.name) {
      console.warn(`  skip ${path}: no title`);
    } else if (data.price === null) {
      console.warn(`  skip ${path}: no price found`);
    } else {
      const slug = decodeURIComponent(path.split('/').pop());
      const cat = pickCategory(path);
      let catSlug = cat?.slug ?? (data.breadcrumbCategory ? slugOf(data.breadcrumbCategory.text) : 'others');
      let catName = cat?.name ?? data.breadcrumbCategory?.text ?? 'Others';
      const brand = detectBrand(data.name, catSlug);
      if (NO_BRAND && (!cat || isBrandCat(catSlug) || catSlug === 'others')) {
        const t = typeFromName(data.name);
        if (t) {
          catSlug = t.slug;
          catName = t.name;
        }
      }
      // With --classify, images go to <image-dir>/<brand>/<category>/
      const folder = CLASSIFY
        ? NO_BRAND
          ? `${IMAGE_SUBDIR}/${catSlug}`
          : `${IMAGE_SUBDIR}/${slugOf(brand) || 'generic'}/${catSlug}`
        : IMAGE_SUBDIR;
      const localImages = [];
      if (DOWNLOAD_IMAGES) {
        mkdirSync(resolve(WEB_PUBLIC, folder), { recursive: true });
        for (const [n, url] of data.images.slice(0, MAX_IMAGES).entries()) {
          try {
            // Sanity's CDN resizes on request: 900px wide WebP keeps files small.
            const isSanity = /cdn\.sanity\.io/.test(url);
            // Re-runs reuse images that are already on disk.
            const existing = `${slug}-${n + 1}.webp`.slice(-120);
            if (isSanity && existsSync(resolve(WEB_PUBLIC, folder, existing))) {
              localImages.push(`/${folder}/${existing}`);
              manifest.push([brand, catName, data.name, slug, `/${folder}/${existing}`, url]);
              continue;
            }
            const r = await context.request.get(isSanity ? `${url}?w=${IMAGE_WIDTH}&fm=webp&q=80` : url);
            if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
            const ct = r.headers()['content-type'] || '';
            const ext = isSanity || ct.includes('webp') ? 'webp' : ct.includes('png') ? 'png' : 'jpg';
            const file = `${slug}-${n + 1}.${ext}`.slice(-120);
            writeFileSync(resolve(WEB_PUBLIC, folder, file), await r.body());
            localImages.push(`/${folder}/${file}`);
            manifest.push([brand, catName, data.name, slug, `/${folder}/${file}`, url]);
          } catch (err) {
            console.warn(`  ! image ${n + 1} of ${slug}: ${err.message}`);
          }
          await sleep(300);
        }
      }
      products.push({
        sourceUrl: ORIGIN + path,
        slug,
        name: data.name,
        brand,
        categorySlug: catSlug,
        categoryName: catName,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        inStock: data.inStock,
        shortDescription: data.description,
        description: data.fullDescription || data.description,
        features: data.features,
        images: data.images,
        localImages,
      });
    }
    if ((i + 1) % 10 === 0 || i === targets.length - 1) console.log(`  products ${i + 1}/${targets.length}`);
    await sleep(DELAY_MS);
  }

  await browser.close();

  // 4. Write the file
  const usedCats = new Map();
  for (const p of products) usedCats.set(p.categorySlug, p.categoryName);
  const output = {
    scrapedAt: new Date().toISOString(),
    source: ORIGIN,
    categories: [...usedCats].map(([slug, name], i) => ({ slug, name, sortOrder: i + 1 })),
    products,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  if (manifest.length) {
    const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['brand', 'category', 'product', 'slug', 'image_path', 'source_url'].join(',');
    const file = OUT.replace(/\.json$/, '') + '-image-manifest.csv';
    writeFileSync(file, [header, ...manifest.map((r) => r.map(csv).join(','))].join('\n'));
    console.log(`Image manifest (${manifest.length} images): ${file}`);
    const perBrand = {};
    for (const [b, c] of manifest) perBrand[`${b} / ${c}`] = (perBrand[`${b} / ${c}`] || 0) + 1;
    console.log('Images per brand / category:');
    console.table(perBrand);
  }
  console.log(`\nDone: ${products.length} products in ${output.categories.length} categories -> ${OUT}`);
  console.log(`Images are in: ${resolve(WEB_PUBLIC, IMAGE_SUBDIR)}`);
  if (products.length < targets.length) console.log(`(${targets.length - products.length} pages were skipped, see warnings above)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
