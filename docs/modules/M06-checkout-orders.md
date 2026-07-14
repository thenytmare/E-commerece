# Module 6 — Checkout & Orders

## Purpose

Complete the purchase flow: shipping addresses, order creation from cart, inventory reservation, and order confirmation pages.

## Deliverables

- [x] `AddressRepository` — create and list user addresses
- [x] `OrderRepository` — create order from cart, reserve stock, clear cart
- [x] Checkout page (`/checkout`) — address selection/entry, order notes
- [x] Order confirmation (`/orders/[orderNumber]`)
- [x] Order history (`/account/orders`)
- [x] Flat-rate shipping with free shipping threshold
- [x] Stock reservation on order placement
- [x] Login required for checkout

## Folder Structure

```
packages/database/src/repositories/
├── address.repository.ts
└── order.repository.ts

apps/web/
├── app/
│   ├── checkout/page.tsx
│   ├── orders/[orderNumber]/page.tsx
│   └── account/orders/page.tsx
├── components/checkout/
│   ├── checkout-form.tsx
│   └── checkout-summary.tsx
└── lib/
    ├── checkout.ts              # Shipping & totals helpers
    ├── validations/checkout.ts
    └── actions/checkout.ts
```

## Shipping Rules

| Condition | Shipping cost |
|-----------|----------------|
| Subtotal ≥ KES 10,000 | Free |
| Otherwise | KES 500 flat rate |

Constants: `FREE_SHIPPING_THRESHOLD_KES`, `FLAT_SHIPPING_KES` in `@repo/config`.

## Order Flow

1. User proceeds from cart → `/checkout` (login required)
2. Select saved address or enter a new one
3. **Place order** → validates stock, creates `CONFIRMED` order
4. Inventory `reserved` incremented per line item
5. Cart cleared
6. Redirect to `/orders/[orderNumber]`

## Manual Testing Checklist

- [ ] Guest redirected to login from checkout
- [ ] Checkout shows cart summary with shipping
- [ ] New address saved on first order
- [ ] Saved address selectable on repeat orders
- [ ] Order confirmation shows items, address, totals
- [ ] Order appears in `/account/orders`
- [ ] Cart empty after successful order
- [ ] Stock reservation prevents overselling

## Next Module

**M7 — Payments:** Stripe and/or M-Pesa integration, payment records, webhooks.
