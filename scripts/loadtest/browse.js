// k6 browsing test. Run against a production build (next build, next start).
//   k6 run -e BASE_URL=http://localhost:3000 -e VUS=50 -e DURATION=5m scripts/loadtest/browse.js
// Covers the pages a shopper sees. Add to cart and checkout are server actions
// that need a session and an action id, so they are not covered here.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const PRODUCTS = Number(__ENV.PRODUCT_COUNT || 500);
const CATEGORIES = (__ENV.CATEGORIES || '').split(',').filter(Boolean);
const SEARCHES = ['accessory', 'charger', 'cable', 'watch', 'power'];

export const options = {
  scenarios: {
    shoppers: { executor: 'constant-vus', vus: Number(__ENV.VUS || 50), duration: __ENV.DURATION || '5m' },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: { http_req_failed: ['rate<0.01'] },
};

const routes = ['home', 'list', 'product', 'search', 'category', 'cart', 'health'];
const trends = {};
routes.forEach((r) => (trends[r] = new Trend('route_' + r, true)));

function hit(name, url) {
  const res = http.get(BASE + url, { tags: { route: name } });
  trends[name].add(res.timings.duration);
  check(res, { [name + ' status 200']: (r) => r.status === 200 });
  return res;
}

export default function () {
  const r = Math.random();
  if (r < 0.25) hit('home', '/');
  else if (r < 0.45) hit('list', '/products?page=' + (1 + Math.floor(Math.random() * 10)));
  else if (r < 0.75) hit('product', '/products/loadtest-accessory-' + (1 + Math.floor(Math.random() * PRODUCTS)));
  else if (r < 0.85) hit('search', '/products?search=' + SEARCHES[Math.floor(Math.random() * SEARCHES.length)]);
  else if (r < 0.92 && CATEGORIES.length) hit('category', '/categories/' + CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
  else if (r < 0.97) hit('cart', '/cart');
  else hit('health', '/api/health');
  if (!__ENV.NO_THINK) sleep(1 + Math.random() * 2);
}
