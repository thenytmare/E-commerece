import { expect, test } from '@playwright/test';

// Explicit per-navigation waits (rather than relying on the default
// expect() timeout after each click) give a clear failure point — "the URL
// never changed" vs. "an element never appeared" — and enough headroom for
// real Postgres round-trips against the production build `webServer` runs
// (see playwright.config.ts).
const NAV_TIMEOUT = 45_000;

/**
 * Guest checkout happy path, end to end against a real (production-build)
 * server and database: browse -> product detail -> cart -> checkout -> pay
 * -> order confirmation.
 *
 * Payment: playwright.config.ts forces `PAYMENT_DEV_MODE=true` with no
 * Stripe/M-Pesa keys for the server this test runs against, so
 * PaymentMethodPicker renders only its "Development mode" panel (see
 * lib/actions/payment.ts `simulatePaymentAction`) — a real Stripe/M-Pesa
 * account is never required to reach the confirmation page.
 */
test('guest can add a product to cart and complete checkout with simulated payment', async ({
  page,
}) => {
  // A fresh address per run avoids any cross-run collisions (e.g. rerunning
  // locally against the same database).
  const runId = Date.now();
  const guestEmail = `playwright-${runId}@example.com`;

  await test.step('browse to a product and add it to the cart', async () => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products', level: 1 })).toBeVisible();

    // The first card in the grid — this seed data's products are all in
    // stock (see packages/database/prisma/seed.ts).
    const firstProduct = page.locator('main a[href^="/products/"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await page.waitForURL(/\/products\/[^/]+$/, { timeout: NAV_TIMEOUT });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
    // Confirms the add-to-cart server action actually completed, rather than
    // racing the header's cart count into the next navigation.
    await expect(page.getByRole('button', { name: 'Added to Cart' })).toBeVisible();
  });

  await test.step('go to cart and proceed to checkout', async () => {
    await page.locator('header a[href="/cart"]').click();
    await page.waitForURL(/\/cart$/, { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Shopping Cart', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await page.waitForURL(/\/checkout$/, { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeVisible();
  });

  await test.step('fill the guest checkout form and place the order', async () => {
    await page.getByLabel('Email address').fill(guestEmail);
    await page.getByLabel('Full name').fill('Playwright Test');
    await page.getByLabel('Phone').fill('0712345678');
    await page.getByLabel('County').fill('Nairobi');
    await page.getByLabel('City / Town').fill('Nairobi');
    await page.getByLabel('Street address').fill('123 Test Street');

    await page.getByRole('button', { name: 'Continue to payment' }).click();

    // placeOrderAction redirects to /orders/{orderNumber}/pay on success.
    await page.waitForURL(/\/orders\/[^/]+\/pay$/, { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Complete payment', level: 1 })).toBeVisible();
  });

  await test.step('complete payment via the dev-mode simulator', async () => {
    await expect(page.getByText('Development mode')).toBeVisible();
    await page.getByRole('button', { name: 'Simulate card payment' }).click();

    // simulatePaymentAction redirects to /orders/{orderNumber}?paid=1 once
    // the (simulated) payment is recorded as completed.
    await page.waitForURL(/\/orders\/[^/]+\?paid=1$/, { timeout: NAV_TIMEOUT });
    await expect(
      page.getByRole('heading', { name: 'Thank you for your order', level: 1 })
    ).toBeVisible();
    await expect(page.getByText('Payment received')).toBeVisible();
  });
});
