// k6 browsing test for the LIVE shop. Read-only: it only opens pages, so it
// never creates orders, carts, accounts or reviews.
//
//   k6 run -e BASE_URL=https://primeaccessorieskenya.store -e VUS=20 -e DURATION=3m scripts/loadtest/live-browse.js
//
// It reads the real product and category addresses from the sitemap first, so
// every request is a page a customer could actually open.
//
// VUS is the number of pretend shoppers at once. Each one opens a page, reads
// for 1 to 3 seconds, then opens another, like a real visitor. Start small.
// The test stops by itself if more than 10% of requests fail.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'https://primeaccessorieskenya.store').replace(/\/+$/, '');
const VUS = Number(__ENV.VUS || 20);
const SEARCHES = ['earbuds', 'charger', 'power bank', 'watch', 'speaker', 'oraimo', 'cable'];
const HEADERS = { 'User-Agent': 'PrimeLoadTest/1.0 (k6)' };

export const options = {
  scenarios: {
    shoppers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS }, // build up gently
        { duration: __ENV.DURATION || '3m', target: VUS }, // hold
        { duration: '30s', target: 0 }, // wind down
      ],
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
  thresholds: {
    // Safety brake for a live site: stop early if the shop starts failing.
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
    // What we aim for: 95% of pages in under 1.5 seconds.
    http_req_duration: ['p(95)<1500'],
  },
};

const ROUTES = ['home', 'list', 'product', 'search', 'category', 'health'];
const trends = {};
ROUTES.forEach((route) => (trends[route] = new Trend(`page_${route}`, true)));

export function setup() {
  const res = http.get(`${BASE}/sitemap.xml`, { headers: HEADERS });
  if (res.status !== 200) throw new Error(`Could not read ${BASE}/sitemap.xml (status ${res.status}).`);
  const urls = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
  const products = urls.filter((u) => /^\/products\/[^/?#]+$/.test(u));
  const categories = urls.filter((u) => /^\/categories\/[^/?#]+$/.test(u));
  if (products.length === 0) throw new Error('The sitemap lists no products.');
  console.log(`Testing ${BASE} with ${products.length} products and ${categories.length} categories, up to ${VUS} shoppers at once.`);
  return { products, categories, pages: Math.max(1, Math.ceil(products.length / 24)) };
}

function open(route, path) {
  const res = http.get(BASE + path, { headers: HEADERS, tags: { route } });
  trends[route].add(res.timings.duration);
  check(res, { [`${route} loads`]: (r) => r.status === 200 });
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function (data) {
  const roll = Math.random();
  if (roll < 0.25) open('home', '/');
  else if (roll < 0.45) open('list', `/products?page=${1 + Math.floor(Math.random() * data.pages)}`);
  else if (roll < 0.75) open('product', pick(data.products));
  else if (roll < 0.85) open('search', `/products?q=${encodeURIComponent(pick(SEARCHES))}`);
  else if (roll < 0.97 && data.categories.length) open('category', pick(data.categories));
  else open('health', '/api/health');
  sleep(1 + Math.random() * 2);
}
