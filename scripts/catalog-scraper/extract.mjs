// Page-side extraction helpers. These functions run inside the browser
// (page.evaluate), so they must not use anything from Node.

/**
 * Runs on a product page BEFORE extractProductInPage. Clicks each gallery
 * thumbnail so lazy-loaded images are in the page. Returns how many it clicked.
 */
export async function revealGalleryInPage() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const h1 = document.querySelector('h1');
  const addBtn = [...document.querySelectorAll('button, a')].find((b) => /add to cart/i.test(b.textContent || ''));
  const anchor = h1 || addBtn;
  if (!anchor) return 0;
  let scope = anchor;
  for (let i = 0; i < 8 && scope.parentElement && scope.parentElement !== document.body; i++) {
    if (scope.querySelectorAll('img').length > 0 && /(?:ksh|kes)\.?\s*\d/i.test(scope.innerText || '')) break;
    scope = scope.parentElement;
  }
  const targets = [...scope.querySelectorAll('button img, [role="tab"] img, [class*="thumb" i] img')]
    .map((img) => img.closest('button, [role="tab"]') || img)
    .filter((el) => !/add to cart|buy|wishlist|share/i.test(el.textContent || ''))
    .slice(0, 30);
  let clicked = 0;
  for (const el of targets) {
    try {
      el.click();
      clicked++;
      await wait(250);
    } catch {
      /* ignore */
    }
  }
  return clicked;
}

/** Runs on a product page. Returns the raw product facts, or null if no h1. */
export function extractProductInPage() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const PRICE_RE = /(?:ksh|kes)\.?\s*([\d][\d,]*(?:\.\d+)?)/gi;

  const h1 = document.querySelector('h1');
  // Some shops (qualityaccessories.store) have no <h1>. Anchor on "Add to Cart" instead.
  const addBtn = [...document.querySelectorAll('button, a')].find((b) => /add to cart/i.test(b.textContent || ''));
  const anchor = h1 || addBtn;
  if (!anchor) return null;

  // Climb from the anchor to the smallest block that holds a price (and, with no h1, an image).
  const hasPrice = (el) => /(?:ksh|kes)\.?\s*\d/i.test(el.innerText || '');
  let scope = anchor;
  while (scope.parentElement && scope.parentElement !== document.body) {
    if (hasPrice(scope) && (h1 || scope.querySelector('img'))) break;
    scope = scope.parentElement;
  }
  if (!hasPrice(scope) && scope.parentElement) {
    scope = scope.parentElement;
  }

  const metaTitle = () => {
    const raw = document.querySelector('meta[property="og:title"]')?.content || document.title || '';
    return clean(raw.replace(/\s*[|–—]\s*.*$/, '').replace(/\s+-\s+quality accessories.*$/i, ''));
  };
  const name = h1 ? clean(h1.textContent) : metaTitle() || clean(scope.querySelector('img[alt]')?.alt);

  // Ignore the "You may also like" block and anything after it.
  let text = scope.innerText || '';
  const cut = text.search(/you may also like|related products|similar products/i);
  if (cut > 0) text = text.slice(0, cut);

  const prices = [];
  let m;
  while ((m = PRICE_RE.exec(text)) !== null) {
    prices.push(Number(m[1].replace(/,/g, '')));
  }
  const price = prices.length ? prices[0] : null;
  const compare = prices.find((p) => price !== null && p > price) ?? null;

  const features = [];
  // Both shops show bullets as <span>s under a "Key Features" heading.
  const featureHeading = [...scope.querySelectorAll('h2, h3, h4')].find((h) => /key features|features|highlights/i.test(h.textContent || ''));
  if (featureHeading && featureHeading.parentElement) {
    featureHeading.parentElement.querySelectorAll('span, li, p').forEach((el) => {
      if (el.querySelector('span, li, p')) return; // innermost only
      if (el === featureHeading || featureHeading.contains(el)) return;
      const t = clean(el.textContent);
      if (t.length >= 3 && t.length <= 200 && !features.includes(t)) features.push(t);
    });
  }
  if (!features.length) scope.querySelectorAll('li').forEach((li) => {
    if (li.closest('nav, footer, header')) return;
    const t = clean(li.textContent);
    if (t.length < 3 || t.length > 160) return;
    if (/ksh|add to cart|^home$|wishlist|share/i.test(t)) return;
    if (!features.includes(t)) features.push(t);
  });

  const toSrc = (img) => {
    let src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
    try {
      const u = new URL(src, location.href);
      if (u.pathname.startsWith('/_next/image') && u.searchParams.get('url')) {
        src = decodeURIComponent(u.searchParams.get('url'));
      }
    } catch {
      /* keep src as is */
    }
    return src.split('?')[0];
  };
  const images = [];
  const seen = new Set();
  const og = document.querySelector('meta[property="og:image"]')?.content;
  const candidates = [...(og ? [og.split('?')[0]] : []), ...[...scope.querySelectorAll('img')]
      .filter((i) => !i.closest('nav, header, footer, a[href^="/product/"]') && !(i.naturalWidth && i.naturalWidth < 120))
      .map(toSrc)];
  for (const src of candidates) {
    // Any real photo host is fine (not only Sanity); skip logos, icons and inline data.
    if (!/^https?:/.test(src) || /\.svg$|logo|favicon|sprite|placeholder/i.test(src)) continue;
    const key = src.split('/').pop().replace(/-\d+x\d+\.\w+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(src);
  }

  // Longer prose blocks inside the product area (the on-page description).
  const paragraphs = [];
  scope.querySelectorAll('p, div, section').forEach((el) => {
    if (el.children.length > 0 && !el.matches('p')) return; // leaf blocks only
    if (el.closest('li, nav, footer, header, button, a')) return;
    const t = clean(el.textContent);
    if (t.length < 60 || t.length > 1500) return;
    if (/ksh|add to cart|you may also like/i.test(t)) return;
    if (!paragraphs.includes(t)) paragraphs.push(t);
  });

  const crumbLinks =[...document.querySelectorAll('nav[aria-label*="readcrumb" i] a, [class*="breadcrumb" i] a')]
    .map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href') || '' }))
    .filter((c) => c.text && !/^home$/i.test(c.text));
  const crumbCategory = crumbLinks.length ? crumbLinks[crumbLinks.length - 1] : null;

  // The paragraph right under the title is the on-page description.
  const detailsHeading = [...scope.querySelectorAll('h2, h3, h4')].find((h) => /^(details|description|product details)$/i.test(clean(h.textContent)));
  const lead = h1 ? clean(h1.parentElement?.querySelector('p')?.textContent) : clean(detailsHeading?.nextElementSibling?.textContent);
  const description =
    lead ||
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    '';

  return {
    name,
    price,
    compareAtPrice: compare,
    inStock: !/out of stock|sold out/i.test(text),
    description: clean(description),
    fullDescription: paragraphs.join('\n\n'),
    features: features.slice(0, 12),
    images,
    breadcrumbCategory: crumbCategory,
  };
}

/** Runs on a category page. Returns the title and every product link found. */
export function extractCategoryInPage() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const links = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const path = href.replace(/^https?:\/\/[^/]+/i, '').split('?')[0].split('#')[0];
    if (/^\/product\/[^/]+\/?$/.test(path)) links.add(path.replace(/\/$/, ''));
  });
  return {
    title: clean(document.querySelector('h1')?.textContent),
    productPaths: [...links],
    noProducts: /no products found/i.test(document.body.innerText || ''),
  };
}
