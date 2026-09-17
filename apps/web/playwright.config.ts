import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Loads the monorepo-root `.env` (see ../../.env.example, and "Configure
 * environment variables" in setup.md — this app's env file lives at the
 * repo root, not here in apps/web).
 *
 * Next's own env loader (@next/env) only looks inside the directory `next
 * start` runs from, i.e. apps/web, which has no .env of its own — so
 * without this, the server this config spawns fails at startup with
 * "DATABASE_URL is not set" / "AUTH_SECRET is not set" (see lib/env.ts).
 * This is a minimal KEY=VALUE parser rather than a `dotenv` dependency,
 * since none is currently installed anywhere in the workspace.
 */
function loadRootEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../.env');
  const vars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return vars;

  for (const rawLine of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  // NODE_ENV=development in the root .env is right for `pnpm dev`, but
  // forwarding it here fights `next build`/`next start`, which need to set
  // NODE_ENV=production themselves — Next then warns about a "non-standard
  // NODE_ENV" and, worse, silently mis-prerenders the built-in error pages
  // (surfaced as a "<Html> should not be imported outside of
  // pages/_document" build failure). Leave it for Next's own scripts to set.
  delete vars.NODE_ENV;
  return vars;
}

const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A shared server + real Postgres means two checkout specs racing would
  // create/claim inventory concurrently — keep this single-worker until
  // there's more than one spec.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Comfortably above the sum of the e2e spec's per-navigation waits
  // (NAV_TIMEOUT there): this is a hard cap on the whole test, so it must
  // stay bigger than any single step's own timeout budget, not just the
  // happy-path duration.
  timeout: 150_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Runs against a production build (`next build` + `next start`), not
  // `next dev`. Dev mode was tried first for simplicity, but Turbopack's
  // on-demand per-route compilation made the flow this test drives
  // unreliable: a cold compile of /products/[slug] alone measured over 80s
  // on a dev machine, and on one run the extra load from compiling routes
  // and Server Actions concurrently with live requests pushed the order's
  // Prisma interactive transaction past its 5s timeout, and on another
  // exhausted the DB connection pool outright (Next also eagerly prefetches
  // every product card's RSC payload on the listing page, multiplying the
  // concurrent query load a cold compile is already competing with). A
  // production build compiles everything up front, so none of that
  // competes with the requests this test makes.
  webServer: {
    command: 'pnpm build && pnpm start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Generous: covers `next build` (observed ~2 minutes under normal load,
    // longer when the machine is under heavy concurrent load) plus `next
    // start` coming up.
    timeout: 480_000,
    env: {
      ...loadRootEnv(),
      // Force the dev-mode simulated-payment panel (see
      // PaymentMethodPicker / lib/actions/payment.ts) regardless of what
      // real provider keys the shared root .env happens to carry, so this
      // suite never depends on reaching Stripe or Safaricom's sandbox APIs.
      // `devMode` there is `isPaymentDevMode() && !stripeEnabled &&
      // !mpesaEnabled` — both provider "configured" checks must be false.
      // `command` runs both `build` and `start` under this same env; only
      // `start` actually needs these (checkout/pay are dynamically
      // rendered, so this is read per-request), but setting them for both
      // is simplest and harmless for the build step.
      PAYMENT_DEV_MODE: 'true',
      STRIPE_SECRET_KEY: '',
      MPESA_CONSUMER_KEY: '',
      MPESA_CONSUMER_SECRET: '',
      MPESA_SHORTCODE: '',
      MPESA_PASSKEY: '',
      MPESA_CALLBACK_SECRET: '',
    },
  },
});
