# Module 7 — Payments

## Purpose

Integrate Stripe (cards) and M-Pesa (STK push) payment flows with webhook handlers, payment records, and order confirmation on successful payment.

## Deliverables

- [x] `PaymentRepository` — create, complete, fail payment records
- [x] Orders start as `PENDING`; confirmed on successful payment
- [x] Stripe Checkout Sessions with webhook handler
- [x] M-Pesa STK push (Daraja API) with callback webhook
- [x] Dev payment simulation when `PAYMENT_DEV_MODE=true`
- [x] Payment page (`/orders/[orderNumber]/pay`)
- [x] Updated order confirmation with payment status

## Folder Structure

```
packages/database/src/repositories/
└── payment.repository.ts

packages/config/src/
└── payment-env.ts

apps/web/
├── app/
│   ├── orders/[orderNumber]/pay/page.tsx
│   └── api/webhooks/
│       ├── stripe/route.ts
│       └── mpesa/route.ts
├── components/payment/
│   └── payment-method-picker.tsx
└── lib/
    ├── payments/
    │   ├── stripe.ts
    │   ├── mpesa.ts
    │   └── order-payment.ts
    └── actions/payment.ts
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYMENT_DEV_MODE` | Dev | `true` enables simulated payments without provider keys |
| `STRIPE_SECRET_KEY` | Stripe | Server-side Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Client-side key (future use) |
| `MPESA_CONSUMER_KEY` | M-Pesa | Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | M-Pesa | Daraja API consumer secret |
| `MPESA_SHORTCODE` | M-Pesa | Paybill/Till number |
| `MPESA_PASSKEY` | M-Pesa | Lipa na M-Pesa passkey |
| `MPESA_ENV` | M-Pesa | `sandbox` or `production` |

## Payment Flow

1. Checkout creates order with status `PENDING` (stock reserved)
2. Redirect to `/orders/[orderNumber]/pay`
3. Customer chooses **Stripe** or **M-Pesa**
4. Provider webhook / callback marks payment `COMPLETED`
5. Order status → `CONFIRMED`
6. Redirect to order confirmation page

## Dev Mode

With `PAYMENT_DEV_MODE=true` and no provider keys:

- Payment page shows **Simulate card payment** and **Simulate M-Pesa payment**
- Instantly completes payment for local testing

## Webhook Setup

**Stripe:** Point webhook to `https://your-domain/api/webhooks/stripe`  
Events: `checkout.session.completed`

**M-Pesa:** Set `CallBackURL` to `https://your-domain/api/webhooks/mpesa`  
(Configured automatically in STK push request)

For local Stripe webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Manual Testing Checklist

- [ ] Checkout redirects to payment page
- [ ] Dev simulation completes order
- [ ] Order shows "Awaiting payment" before pay
- [ ] Order shows "Payment received" after pay
- [ ] Stripe checkout works with test keys
- [ ] M-Pesa STK push works in sandbox (with Daraja credentials)

## Next Module

**M8 — Admin & Polish:** Order management UI, product images, deployment, E2E tests.
