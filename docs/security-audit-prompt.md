# Security audit prompt: payments focus

Paste everything inside the box below into GPT 6 Astra, and give it the source code
(upload the repository as a zip, or connect the repo). Remove the `.env` files first.
Never give it real keys.

---

````text
ROLE
You are a senior application security engineer and payments fraud specialist. You are
reviewing my own e-commerce application before launch. I own the code and I authorise
this review. Your goal is to find real, exploitable weaknesses, mainly in the payment
and order flows, and to tell me exactly how to fix each one.

THE APP
Prime Accessories Kenya, an online shop for the Kenyan market.
- Stack: Next.js 15 (App Router, server actions), React 19, TypeScript, Prisma 6,
  PostgreSQL 16, NextAuth v5 (beta) with bcryptjs, Zod, Nodemailer, Sentry.
- Monorepo (pnpm and Turborepo): apps/web plus packages/config, database, ui, utils.
- Payments: Stripe (cards), M-Pesa (Safaricom Daraja STK push) and Cash on Delivery
  (Nairobi only). A PAYMENT_DEV_MODE simulator exists for development only.
- Guests can check out without an account. Customers can register. Staff roles are
  ADMIN, MANAGER, SUPPORT. CUSTOMER cannot enter /admin.
- Deployment target: one Linux VPS, nginx in front, Node app on 127.0.0.1:3000,
  Postgres on the same server, optional Cloudflare in front.
- Rate limiting is in the app's memory, keyed on the first X-Forwarded-For value when
  TRUST_PROXY_HEADERS=true. nginx is meant to replace that header with $remote_addr.
- Every HTML page is dynamic. A per-request CSP nonce is created in middleware.ts.

WHERE TO LOOK FIRST (paths from the repo root)
Payments and orders
- apps/web/lib/actions/checkout.ts          place order, delivery zone and location
- apps/web/lib/actions/payment.ts           start Stripe or M-Pesa, chooseCashOnDeliveryAction
- apps/web/lib/payments/stripe.ts, stripe-settlement.ts
- apps/web/lib/payments/mpesa.ts, mpesa-settlement.ts
- apps/web/lib/payments/order-payment.ts, reconcile.ts
- apps/web/app/api/webhooks/stripe/route.ts
- apps/web/app/api/webhooks/mpesa/route.ts and mpesa/[secret]/route.ts
- apps/web/app/api/payments/[id]/status/route.ts
- apps/web/app/api/cron/reconcile/route.ts  (Bearer CRON_SECRET)
- apps/web/app/(storefront)/orders/[orderNumber]/ and .../pay/
- packages/database/src/repositories/order.repository.ts   createFromCart, updateStatus,
  cancelOrder, placeCashOnDelivery, stock reservation
- packages/database/src/repositories/payment.repository.ts
- packages/config/src/delivery.ts           delivery fees and the free-delivery threshold
- packages/config/src/payment-env.ts, env.ts   production guards for the dev simulator
- packages/utils/src/mpesa.ts               phone and callback helpers
Access control and platform
- apps/web/middleware.ts, apps/web/lib/auth/*, apps/web/auth.ts, auth.config.ts
- apps/web/lib/actions/admin-*.ts           every admin server action
- apps/web/lib/rate-limit.ts
- apps/web/app/api/admin/*, apps/web/app/uploads/[...path]/route.ts, lib/media/*
- apps/web/next.config.ts (headers), Dockerfile, docker-compose.yml, docs/deploy/nginx.conf
- packages/database/prisma/schema.prisma and migrations, prisma/seed.ts

WHAT TO TEST FOR (payments first, then everything else)
1. Amount and price tampering
   - Is every price, discount, coupon, delivery fee and total recomputed on the server
     from the database, never taken from the browser?
   - Delivery zone and location: can a shopper submit a cheaper fee, a fee for another
     zone, an unknown location, or pickup with a delivery address?
   - Quantity: zero, negative, fractional, huge, or integer overflow. Rounding and
     Decimal handling. Currency assumptions (KES only). Free-delivery threshold abuse.
   - Coupon abuse: reuse, stacking, race conditions on usage limits, expired codes.
   - Does the amount sent to Stripe or M-Pesa always equal the order total stored in
     the database at the time of payment?
2. Fake or replayed payment confirmations
   - Stripe webhook: raw-body signature check, tolerance window, replay, event type
     filtering, idempotency, handling of amount or currency mismatch, partial payments,
     refunds, disputes, and trusting metadata.
   - M-Pesa callbacks: two routes exist, one with a secret in the URL. Can anyone forge
     a "paid" callback? Is the secret compared in constant time? Does the secret leak
     through logs, referrers or error pages? Is the amount, phone number, receipt number
     and CheckoutRequestID checked against our own record? Duplicate receipts. Is there
     an IP allowlist, and should there be one? Failed or cancelled result codes.
   - Can the status endpoint (/api/payments/[id]/status) or the simulator be used to mark
     something paid? Is PAYMENT_DEV_MODE impossible to enable in production, even by a
     wrong environment variable?
3. Order and payment state machine
   - Illegal transitions (cancelled to paid, delivered to pending, paid twice, paid by two
     providers). Settlement idempotency. Database transactions, isolation level, row
     locks, double-click and parallel-request races, time-of-check to time-of-use.
   - Stock: reservation, release on cancel or expiry, and overselling under concurrency.
   - Cash on Delivery: the Nairobi-only rule enforced on the server, fake-order abuse that
     locks stock, the 24-hour unpaid sweep, the COD payment completing on DELIVERED, and
     who is allowed to set DELIVERED or CANCELLED.
4. Access control on orders and payments
   - IDOR: can one user or guest read, pay or cancel another person's order by guessing
     an order number, payment id or URL? How guessable are order numbers? Is the guest
     email or a token checked?
   - Do all server actions check the session and permission on the server, not only in
     the UI? Can a CUSTOMER call an admin action directly? Can staff mark an order paid
     or refund without an audit trail?
5. Secrets and data exposure
   - Keys in the client bundle (NEXT_PUBLIC_ variables), in logs, in Sentry events, in
     error messages, in git history, or in the Docker image. Webhook secret handling.
   - Logging of card data, phone numbers, emails or full payloads. Confirm card numbers
     never touch our server (PCI scope should be SAQ A). Kenya Data Protection Act 2019
     concerns for customer data.
6. Authentication and sessions
   - Login, register, reset-password flows: enumeration, token strength and expiry,
     brute force, session fixation, cookie flags, the NextAuth beta version risks.
   - Seed admin account and default passwords. Cart cookie security.
7. Injection and browser attacks
   - Raw SQL, Prisma raw queries, XSS (order notes, names and addresses shown in the
     admin screens), CSRF on server actions and API routes, open redirects (for example
     the redirect to /orders/{n}?cod=1), SSRF, header injection, CSP gaps.
   - File upload: type checks, size limits, path traversal, stored file execution.
8. Abuse and availability
   - Rate limiting on login, register, order placement, payment start, webhooks and the
     STK push (SMS spam to a victim's phone). Bypass through a spoofed X-Forwarded-For
     or through Cloudflare. In-memory limits resetting on restart.
   - Card testing (many small payments to test stolen cards), enumeration, and expensive
     queries that could be used for denial of service.
9. Infrastructure and dependencies
   - nginx config, exposed ports, Docker user and volumes, Postgres exposure, backups,
     cron endpoint protection, known-vulnerable dependencies (check lockfile versions
     against public advisories), and security headers.

RULES
- This is a read-and-reason review of the source I give you. Do not attack any live
  system. Do not run exploits against third-party services. Any proof of concept must be
  something I can run on my own local copy with Stripe test keys, the M-Pesa sandbox,
  and fake data.
- Only report what you can support with code. For each finding, quote the file path and
  line numbers and the relevant lines. If you are guessing, say so and mark the
  confidence as low. Do not invent files, functions or line numbers. If something is
  missing from what I gave you, list it under "Needs more information" instead of
  assuming.
- Do not pad the report with generic advice or low-value items. I prefer five real
  findings to fifty maybes. Check first whether an existing guard already stops the
  attack before you report it.
- Never output real secrets. If you find one in the code, say where it is and redact it.

OUTPUT FORMAT
1. A one-paragraph summary: overall payment security posture and the three things I must
   fix before launch.
2. A findings table, most severe first: ID, severity (Critical, High, Medium, Low), area,
   one-line title, file and lines, confidence (High, Medium, Low).
3. For each finding:
   - What is wrong, in plain English.
   - Attack scenario: who the attacker is, the exact steps, and what they gain, for
     example "pays KSh 1, receives a KSh 8,000 order".
   - Evidence: the code excerpt.
   - Fix: a concrete code change (a short diff or snippet) in this stack, and why it works.
   - How to test the fix, including a test I can add (Vitest or Playwright).
4. "Checked and found safe": the important controls you verified are correct, with file
   references, so I know what was covered.
5. "Needs more information": anything you could not judge.
6. A fix order: what to change first, second and third, with a rough effort for each
   (small, medium, large).

Write in UK English, plain words and short sentences. Do not use em dashes.
````

---

## Tips for getting a better review

- Run it in two passes. First send the prompt as it is. Then ask: "Now attack only the
  M-Pesa callback and Stripe webhook code again. Try to forge a paid order. Show the
  exact request."
- Ask for the report as a file you can keep, then give me the findings and I will check
  each one against the code and fix the real ones.
- Treat every finding as a lead, not a fact. Models sometimes report problems that an
  existing guard already blocks. Confirm each one before you change code.
- Repeat the review after each big change to payments, and before every launch.
