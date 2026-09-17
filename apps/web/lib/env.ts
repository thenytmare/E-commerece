import { z } from 'zod';

/**
 * Startup environment validation.
 *
 * Called once from `instrumentation.ts` (Next.js 15's server-startup hook) so
 * a misconfigured deployment fails immediately at boot with one clear,
 * aggregated error instead of crashing deep inside a random request the
 * first time it happens to touch the missing var (e.g. the first login, or
 * the first checkout).
 *
 * Vars are split into two tiers:
 *
 * - REQUIRED: the app cannot serve any request without these (the database
 *   connection and the Auth.js session-signing secret). Missing/invalid ones
 *   throw and stop the process.
 * - OPTIONAL / feature-gated: payments (Stripe, M-Pesa), outbound email
 *   (SMTP), the scheduled reconciliation endpoint, and error reporting
 *   (Sentry) all already degrade gracefully at the call site when unset —
 *   see `@repo/config`'s `isStripeConfigured`/`isMpesaConfigured`,
 *   `lib/mail.ts`'s `isConfigured`, and the 404-if-unset check in
 *   `app/api/cron/reconcile/route.ts`. These must NOT hard-fail boot; we
 *   only log so a partial/typo'd configuration is easy to notice.
 */

const requiredEnvSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is not set.' })
    .min(1, 'DATABASE_URL is not set.')
    .startsWith('postgresql://', 'DATABASE_URL must be a postgresql:// connection string.'),
});

const MIN_AUTH_SECRET_LENGTH = 32;

interface OptionalFeatureGroup {
  /** Human-readable feature name used in the log line. */
  label: string;
  /** Env vars that together configure this feature. */
  vars: readonly string[];
}

/**
 * Each entry mirrors a feature that already checks its own env vars at the
 * call site and disables itself gracefully when they're absent (see file
 * header). Listed here purely so an operator gets one startup log line
 * instead of discovering the gap when a customer hits checkout/email/etc.
 */
const OPTIONAL_FEATURE_GROUPS: readonly OptionalFeatureGroup[] = [
  {
    label: 'Stripe payments',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
  },
  {
    label: 'M-Pesa payments',
    vars: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_SECRET'],
  },
  {
    label: 'Outbound email (SMTP)',
    vars: ['SMTP_URL'],
  },
  {
    label: 'Scheduled payment reconciliation (POST /api/cron/reconcile)',
    vars: ['CRON_SECRET'],
  },
  {
    label: 'Error reporting (Sentry)',
    vars: ['SENTRY_DSN'],
  },
];

function checkRequiredVars(): string[] {
  const errors: string[] = [];

  const dbResult = requiredEnvSchema.safeParse({ DATABASE_URL: process.env.DATABASE_URL });
  if (!dbResult.success) {
    for (const issue of dbResult.error.issues) {
      errors.push(issue.message);
    }
  }

  // Auth.js accepts either name (see auth.config.ts); either is acceptable
  // here as long as one of them is set and long enough to be a real secret.
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    errors.push('AUTH_SECRET (or NEXTAUTH_SECRET) is not set.');
  } else if (authSecret.length < MIN_AUTH_SECRET_LENGTH) {
    errors.push(`AUTH_SECRET (or NEXTAUTH_SECRET) must be at least ${MIN_AUTH_SECRET_LENGTH} characters.`);
  }

  return errors;
}

function warnOnOptionalFeatureGaps(): void {
  for (const group of OPTIONAL_FEATURE_GROUPS) {
    const missing = group.vars.filter((name) => !process.env[name]);

    if (missing.length === 0) {
      continue;
    }

    if (missing.length === group.vars.length) {
      // Nothing set at all — a normal, intentional "feature disabled" state
      // (e.g. local dev without Stripe keys). Informational only.
      console.info(`[env] ${group.label} is not configured; that feature is disabled.`);
      continue;
    }

    // Some but not all vars set — almost certainly a mistake (a copy/paste
    // that missed one key), since the feature can't work half-configured.
    console.warn(
      `[env] ${group.label} is partially configured — missing: ${missing.join(', ')}. ` +
        'This feature will not work correctly until all of its variables are set.'
    );
  }
}

/**
 * Validates process.env. Throws a single aggregated error if any required
 * var is missing or invalid; logs (but never throws) for optional,
 * feature-gated vars.
 */
export function validateEnv(): void {
  const errors = checkRequiredVars();

  if (errors.length > 0) {
    throw new Error(
      'Invalid or missing required environment variable(s):\n' +
        errors.map((message) => `  - ${message}`).join('\n') +
        '\nSee .env.example for the full list of variables.'
    );
  }

  warnOnOptionalFeatureGaps();
}
