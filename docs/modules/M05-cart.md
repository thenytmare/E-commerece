# Module 5 — Cart

## Purpose

Enable shoppers to add products to a persistent cart — for both guests (session-based) and logged-in users — with quantity management and cart merge on login.

## Deliverables

- [x] `CartRepository` — add, update, remove, merge guest→user
- [x] Guest cart via `cart_session_id` HTTP-only cookie (30-day TTL)
- [x] User cart tied to authenticated account
- [x] Cart merge on login and registration
- [x] Add to cart on product detail page
- [x] Cart page (`/cart`) with quantity controls and order summary
- [x] Cart item count badge in site header
- [x] Stock validation on add/update

## Folder Structure

```
packages/database/src/repositories/
└── cart.repository.ts

apps/web/
├── app/cart/page.tsx
├── components/cart/
│   ├── add-to-cart-button.tsx
│   ├── cart-item-row.tsx
│   └── cart-summary.tsx
└── lib/
    ├── cart.ts                  # Cart resolution & subtotal helpers
    ├── cart-session.ts          # Guest session cookie
    └── actions/cart.ts          # Server actions
```

## Cart Flow

1. **Guest** — first add-to-cart creates `cart_session_id` cookie and guest `Cart` record
2. **Authenticated** — cart linked to `userId`; guest cookie ignored for reads
3. **Login/register** — guest cart items merged into user cart; guest cookie cleared
4. **Stock** — add/update validates against `quantity - reserved` from inventory

## Server Actions

| Action | Description |
|--------|-------------|
| `addToCartAction` | Add variant (default qty 1) |
| `updateCartItemAction` | Change quantity; removes at 0 |
| `removeCartItemAction` | Delete line item |

## Manual Testing Checklist

- [ ] Add product to cart as guest — header badge updates
- [ ] Cart page shows correct items, prices, and subtotal
- [ ] Increase/decrease quantity respects stock limits
- [ ] Remove item works
- [ ] Login merges guest cart into account cart
- [ ] Logged-in user cart persists across sessions

## Next Module

**M6 — Checkout & Orders:** Address management, order creation, inventory reservation, order confirmation.
