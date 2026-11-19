export interface PaymentConfig {
  appUrl: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePublishableKey?: string;
  mpesaConsumerKey?: string;
  mpesaConsumerSecret?: string;
  mpesaShortcode?: string;
  mpesaPasskey?: string;
  /** Shared secret embedded in the Daraja callback URL path. */
  mpesaCallbackSecret?: string;
  /** Public HTTPS origin, independent of local storefront/auth URLs. */
  mpesaCallbackBaseUrl?: string;
  mpesaEnv: 'sandbox' | 'production';
  /** IntaSend keys. The publishable key is sent with each request; the secret key never leaves the server. */
  intasendPublishableKey?: string;
  intasendSecretKey?: string;
  /** The "challenge" text set in the IntaSend dashboard. Every webhook carries it back. */
  intasendWebhookChallenge?: string;
  /** 'sandbox' uses IntaSend's test system. Anything else but 'live' is treated as sandbox. */
  intasendEnv: 'sandbox' | 'live';
  paymentDevMode: boolean;
}

/** Read payment provider configuration from environment */
export function getPaymentConfig(): PaymentConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY,
    mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET,
    mpesaShortcode: process.env.MPESA_SHORTCODE,
    mpesaPasskey: process.env.MPESA_PASSKEY,
    mpesaCallbackSecret: process.env.MPESA_CALLBACK_SECRET,
    mpesaCallbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL,
    mpesaEnv: process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
    intasendPublishableKey: process.env.INTASEND_PUBLISHABLE_KEY,
    intasendSecretKey: process.env.INTASEND_SECRET_KEY,
    intasendWebhookChallenge: process.env.INTASEND_WEBHOOK_CHALLENGE,
    intasendEnv: process.env.INTASEND_ENV === 'live' ? 'live' : 'sandbox',
    paymentDevMode: process.env.PAYMENT_DEV_MODE === 'true',
  };
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isMpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      // Without the callback secret there is no authenticated way for
      // Safaricom to report the result, so M-Pesa is not usable.
      process.env.MPESA_CALLBACK_SECRET
  );
}

/**
 * IntaSend M-Pesa prompts. All three values are needed. Without the webhook
 * challenge there is no safe way to hear back from IntaSend quickly, so the
 * option stays off rather than half working.
 */
export function isIntasendConfigured(): boolean {
  return Boolean(
    process.env.INTASEND_PUBLISHABLE_KEY &&
      process.env.INTASEND_SECRET_KEY &&
      process.env.INTASEND_WEBHOOK_CHALLENGE
  );
}

/** Dev-only simulated payments when provider keys are not set */
export function isPaymentDevMode(): boolean {
  return (
    process.env.PAYMENT_DEV_MODE === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}
