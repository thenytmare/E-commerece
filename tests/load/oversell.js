// Overselling check: 50 shoppers try to buy the last 5 units of one product
// at the same moment. Exactly 5 orders must succeed and stock must never go
// below zero. Run AFTER preparing the product:
//   psql "$DATABASE_URL" -f tests/load/oversell-prepare.sql
//   k6 run tests/load/oversell.js
//   psql "$DATABASE_URL" -f tests/load/oversell-verify.sql
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { ACTIONS, callAction } from './lib/helpers.js';

const SLUG = 'load-test-last-five';
const VARIANT = 'lt-last5-v';
const succeeded = new Counter('orders_succeeded');
const soldOut = new Counter('orders_rejected_out_of_stock');
const other = new Counter('orders_other_outcome');

export const options = {
  scenarios: { race: { executor: 'per-vu-iterations', vus: 50, iterations: 1, maxDuration: '2m' } },
  thresholds: { orders_succeeded: ['count==5'], orders_other_outcome: ['count==0'] },
};

// Everyone fires the order at the same moment, agreed once in setup().
export function setup() {
  return { fireAt: Date.now() + 15_000 };
}

export default function ({ fireAt }) {
  const add = callAction(`/products/${SLUG}`, ACTIONS.addToCartAction, { variantId: VARIANT, quantity: 1 }, 'race:add');
  if (!/"success":true/.test(add.body)) {
    other.add(1);
    console.warn('add failed', add.status, String(add.body).slice(-200));
    return;
  }
  sleep(Math.max(0, (fireAt - Date.now()) / 1000));
  const res = callAction('/checkout', ACTIONS.placeOrderAction, {
    guestEmail: `race-${__VU}@example.com`,
    deliveryZone: 'PICKUP',
    name: 'Race Tester',
    phone: '0712345678',
  }, 'race:order', {});
  if (res.status === 303) succeeded.add(1);
  else if (/Insufficient stock/.test(res.body)) soldOut.add(1);
  else {
    other.add(1);
    console.warn('unexpected', res.status, String(res.body).slice(-200));
  }
}
