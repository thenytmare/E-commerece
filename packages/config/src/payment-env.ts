export interface PaymentConfig {
  appUrl: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePublishableKey?: string;
  mpesaConsumerKey?: string;
  mpesaConsumerSecret?: string;
  mpesaShortcode?: string;
  mpesaPasskey?: string;
  mpesaEnv: 'sandbox' | 'production';
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
    mpesaEnv: process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
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
      process.env.MPESA_PASSKEY
  );
}

/** Dev-only simulated payments when provider keys are not set */
export function isPaymentDevMode(): boolean {
  return (
    process.env.PAYMENT_DEV_MODE === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}
