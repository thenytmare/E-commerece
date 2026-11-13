// Two shoppers with separate cart cookies must never see each other's items.
//   k6 run tests/load/cart-isolation.js
import http from 'k6/http';
import { check } from 'k6';
import { ACTIONS, BASE, SLUGS, callAction, params } from './lib/helpers.js';

export const options = { scenarios: { pair: { executor: 'per-vu-iterations', vus: 2, iterations: 1 } } };

export default function () {
  // VU 1 takes product 10, VU 2 takes product 20.
  const mine = SLUGS.products.find((p) => p.slug === `load-test-gadget-${__VU * 10}`);
  const theirs = SLUGS.products.find((p) => p.slug === `load-test-gadget-${(3 - __VU) * 10}`);
  callAction(`/products/${mine.slug}`, ACTIONS.addToCartAction, { variantId: mine.variant, quantity: 1 }, 'iso:add');
  const cart = http.get(`${BASE}/cart`, params('iso:cart')).body;
  check(cart, {
    'my item is in my cart': (b) => b.includes(`Load Test Gadget ${__VU * 10} `),
    "the other shopper's item is not": (b) => !b.includes(`Load Test Gadget ${(3 - __VU) * 10} `),
  });
}
