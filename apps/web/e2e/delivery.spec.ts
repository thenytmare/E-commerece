import { expect, test, type Page } from '@playwright/test';

const NAV_TIMEOUT = 45_000;

/** Adds the first listed product to the cart and opens checkout as a guest. */
async function startCheckout(page: Page) {
  // E2E_PRODUCT_SLUG lets a run pick a product under the free-delivery
  // threshold, so the location fee is actually charged.
  if (process.env.E2E_PRODUCT_SLUG) {
    await page.goto(`/products/${process.env.E2E_PRODUCT_SLUG}`);
  } else {
    await page.goto('/products');
    await page.locator('main a[href^="/products/"]').first().click();
    await page.waitForURL(/\/products\/[^/]+$/, { timeout: NAV_TIMEOUT });
  }
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Added to Cart' })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeVisible();
  await page.getByLabel('Email address').fill(`delivery-${Date.now()}@example.com`);
}

async function pickLocation(page: Page, option: string, location: string) {
  await page.getByLabel(option).check();
  await page.getByLabel('Select location *').fill(location);
  await page.getByRole('option', { name: new RegExp(`^${location}`) }).click();
}

test('Nairobi delivery charges the area fee and offers Cash on Delivery', async ({ page }) => {
  await startCheckout(page);

  // Continue stays disabled until a location is picked.
  await page.getByLabel('Nairobi Delivery').check();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();

  // Each location in the list shows its fee (Westlands is KSh 200).
  await page.getByLabel('Select location *').fill('Westlands');
  await expect(page.getByRole('option', { name: /^Westlands\s*Ksh\s?200$/ })).toBeVisible();
  await pickLocation(page, 'Nairobi Delivery', 'Westlands');

  await page.getByLabel('Full name').fill('COD Tester');
  await page.getByLabel('Phone').fill('0712345678');
  await page.getByLabel('Building, estate or landmark').fill('Sarit Centre, Gate B');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.waitForURL(/\/orders\/[^/]+\/pay$/, { timeout: NAV_TIMEOUT });

  await expect(page.getByText('Cash on Delivery', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pay on delivery' }).click();
  await page.waitForURL(/\/orders\/[^/]+\?cod=1$/, { timeout: NAV_TIMEOUT });
  await expect(page.getByText('Please have')).toBeVisible();
  await expect(page.getByText('Nairobi Delivery · Westlands')).toBeVisible();
});

test('Outside Nairobi uses the county fee and has no Cash on Delivery', async ({ page }) => {
  await startCheckout(page);
  await pickLocation(page, 'Outside Nairobi', 'Meru');

  await page.getByLabel('Full name').fill('County Tester');
  await page.getByLabel('Phone').fill('0712345678');
  await page.getByLabel('Town / City').fill('Meru Town');
  await page.getByLabel('Building, estate or landmark').fill('Near Meru Stadium');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.waitForURL(/\/orders\/[^/]+\/pay$/, { timeout: NAV_TIMEOUT });

  await expect(page.getByRole('button', { name: 'Pay on delivery' })).toHaveCount(0);
});

test('Shop pickup is free and only needs a name and phone', async ({ page }) => {
  await startCheckout(page);
  await page.getByLabel('Shop Pickup').check();
  await expect(page.getByText('Shop Pickup Information')).toBeVisible();
  await expect(page.getByLabel('Building, estate or landmark')).toHaveCount(0);

  await page.getByLabel('Full name').fill('Pickup Tester');
  await page.getByLabel('Phone').fill('0712345678');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.waitForURL(/\/orders\/[^/]+\/pay$/, { timeout: NAV_TIMEOUT });
  await expect(page.getByRole('button', { name: 'Pay on delivery' })).toHaveCount(0);
});
