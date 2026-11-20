// Storefront load test: browse 70%, cart 20%, checkout 8%, sign-in 2%,
// with /api/health polled once a second throughout.
//
//   SHAPE=smoke|baseline|load|stress|spike|soak k6 run tests/load/storefront.js
//
// Prepare first (see tests/load/README.md): production build, test database
// with tests/load/seed-large.sql, PAYMENT_DEV_MODE=true, then
// `node tests/load/lib/action-ids.mjs` and `node tests/load/lib/slugs.mjs`.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { ACTIONS, BASE, SLUGS, callAction, params, pick } from './lib/helpers.js';

const SHAPES = {
  smoke: [{ duration: '1m', target: 1 }],
  baseline: [
    { duration: '30s', target: 25 },
    { duration: '5m', target: 25 },
    { duration: '15s', target: 0 },
  ],
  load: [
    { duration: '2m', target: 100 },
    { duration: '10m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '1m', target: 0 },
  ],
  spike: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 300 },
    { duration: '1m', target: 300 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 0 },
  ],
  soak: [
    { duration: '2m', target: 30 },
    { duration: '60m', target: 30 },
    { duration: '1m', target: 0 },
  ],
};
const SHAPE = __ENV.SHAPE || 'smoke';

export const options = {
  scenarios: {
    shoppers: { executor: 'ramping-vus', stages: SHAPES[SHAPE], exec: 'shopper', gracefulRampDown: '20s' },
    health: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: SHAPES[SHAPE].reduce((s, st) => s + toSeconds(st.duration), 0) + 's',
      preAllocatedVUs: 2,
      exec: 'health',
    },
  },
  thresholds: {
    'http_req_duration{flow:browse}': ['p(95)<800'],
    'http_req_duration{flow:cart}': ['p(95)<1500'],
    'http_req_duration{flow:checkout}': ['p(95)<1500'],
    unexpected_errors: ['rate<0.01'],
    health_ok: ['rate==1'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function toSeconds(d) {
  const m = /^(\d+)(s|m|h)$/.exec(d);
  return Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2]];
}

const unexpectedErrors = new Rate('unexpected_errors');
const rateLimited = new Counter('rate_limited_429');
const healthOk = new Rate('health_ok');
const ordersPlaced = new Counter('orders_placed');
const flowTime = new Trend('flow_duration', true);

function ok(res, flow, extra = () => true) {
  const good = res.status >= 200 && res.status < 400 && extra(res);
  unexpectedErrors.add(!good, { flow });
  if (!good && __ENV.DEBUG) console.warn(flow, res.status, res.request.url, String(res.body).slice(0, 200));
  return good;
}

function page(path, flow) {
  const p = params(path.split('?')[0].replace(/\/[^/]*\d[^/]*$/, '/:id'));
  p.tags.flow = flow;
  return http.get(BASE + path, p);
}

function browse() {
  const steps = [
    () => '/',
    () => '/products',
    () => `/products?q=${encodeURIComponent(pick(['power', 'earbuds', 'charger', 'gadget 4']))}`,
    () => `/products?brand=${pick(SLUGS.brands)}`,
    () => `/products?page=${1 + Math.floor(Math.random() * 10)}`,
    () => `/categories/${pick(SLUGS.categories)}`,
    () => `/products/${pick(SLUGS.products).slug}`,
  ];
  for (let i = 0; i < 4; i++) {
    const res = page(pick(steps)(), 'browse');
    ok(res, 'browse', (r) => r.status === 200);
    sleep(1 + Math.random() * 2);
  }
}

function addToCart(product, flow) {
  const res = callAction(`/products/${product.slug}`, ACTIONS.addToCartAction, { variantId: product.variant, quantity: 1 }, 'action:addToCart', null, flow);
  return ok(res, flow, (r) => r.status === 200 && /"success":true/.test(r.body));
}

function cart() {
  const product = pick(SLUGS.products);
  ok(page(`/products/${product.slug}`, 'cart'), 'cart');
  sleep(1);
  addToCart(product, 'cart');
  sleep(1);
  ok(page('/cart', 'cart'), 'cart', (r) => r.status === 200);
}

function checkout() {
  const started = Date.now();
  // Cheap products only, so stock and free-delivery rules both get exercised.
  const product = pick(SLUGS.products);
  ok(page(`/products/${product.slug}`, 'checkout'), 'checkout');
  if (!addToCart(product, 'checkout')) return;
  ok(page('/checkout', 'checkout'), 'checkout', (r) => r.status === 200);
  sleep(2);
  const res = callAction('/checkout', ACTIONS.placeOrderAction, {
    guestEmail: `load-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    deliveryZone: 'NAIROBI',
    deliveryLocation: pick(['Westlands', 'Kilimani', 'Nairobi CBD', 'Embakasi', 'Rongai']),
    name: 'Load Tester',
    phone: '0712345678',
    street: 'Load Test House',
    notes: '',
    couponCode: '',
  }, 'action:placeOrder', {}, 'checkout');
  if (res.status === 429 || /Too many attempts/.test(res.body)) {
    rateLimited.add(1);
    return;
  }
  const placed = res.status === 303 || Boolean(res.headers['X-Action-Redirect']);
  unexpectedErrors.add(!placed, { flow: 'checkout' });
  if (placed) ordersPlaced.add(1);
  else if (__ENV.DEBUG) console.warn('checkout', res.status, String(res.body).slice(0, 300));
  flowTime.add(Date.now() - started, { flow: 'checkout' });
}

function signIn() {
  ok(page('/login', 'auth'), 'auth', (r) => r.status === 200);
  const res = callAction('/login', ACTIONS.loginAction, { email: 'nobody@example.com', password: 'wrong-password-123' }, 'action:login', {}, 'auth');
  if (res.status === 429 || /Too many attempts/.test(res.body)) rateLimited.add(1);
  // A wrong password is the expected answer here, not an error.
  unexpectedErrors.add(res.status >= 500, { flow: 'auth' });
}

export function shopper() {
  const roll = Math.random();
  if (roll < 0.7) browse();
  else if (roll < 0.9) cart();
  else if (roll < 0.98) checkout();
  else signIn();
  sleep(1);
}

export function health() {
  const res = http.get(`${BASE}/api/health`, { tags: { name: '/api/health' } });
  healthOk.add(res.status === 200);
}
