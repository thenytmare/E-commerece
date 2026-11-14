# Prompt: audit remediation, round 2

Copy everything below the line into your coding assistant, from the repo root.

---

You are working on Prime Accessories Kenya. It is a pnpm and Turborepo monorepo. The stack is Next.js 15, React 19, TypeScript, Prisma 6, Postgres 16, NextAuth v5 beta, Stripe, M-Pesa and cash on delivery. Money is in KES. Stripe amounts are in cents.

A security and quality audit found 24 issues (F01 to F24). Round 1 fixed F01 to F12 (first half), F14, F17, F22 (test fixtures), F23 and the pagination bug. This round fixes what is left.

## Rules

- Use UK English, plain words and short sentences in code comments and docs. No em dashes.
- Work in small steps. After each task, run `pnpm --filter @repo/database test`, `pnpm --filter @repo/config test`, and `cd apps/web && npx tsc --noEmit`. Fix what you break.
- Verify each finding against the real code first. If it is already safe or the report is wrong, say so and skip it.
- Use compare-and-set updates (`updateMany` with a status condition, then check `count`) for any state change. Do not read, decide, then write.
- Add a regression test for every fix. Tests that mock Prisma must also cover the "lost the race" case.
- Never paste or print real secrets. Use test values only.
- Schema changes need a Prisma migration file. Do not edit old migrations. Make each migration safe to run on a live database with data (nullable or defaulted columns).
- Do not weaken production guards (payment simulation stays off in production).
- At the end, run a production build (`cd apps/web && npx next build`) and give me a table: finding, what was real, what you changed, tests added, what is left.

## Order of work

Do tasks 1 to 4 first. They are small. Stop and show me the plan for tasks 5 and 6 before you write the migrations.

### 1. F21: form labels (small)
- Four product-filter selects in the admin products list have no accessible name. The homepage hero inputs in admin use placeholders only.
- Add visible labels or `aria-label` with stable `id` and `htmlFor` pairs.
- Check keyboard use. Do not redesign the pages.

### 2. F24: media deletion check
- Find the media delete guard. It counts product images, categories and brands only.
- It must also check homepage hero and other settings (JSON values), and marketing banners. Search every place that stores an image URL.
- Put the checks in one function, `findMediaReferences(url)`, so new content types are added in one place.
- Block deletion and tell the admin where the file is used. Prefer a recoverable delete if one exists.
- Tests: one blocked case per reference type, and one successful delete when unused.

### 3. F20: payment UI messages
- The Stripe pay button awaits the server action but ignores its `{ error }` result. Show the error, keep the button usable, and allow a retry.
- The order page treats a non-COD `CONFIRMED` order as paid even without a completed payment. Derive the paid badge only from the payment record (`COMPLETED`).
- Treat `REFUNDED` as a final state in the payment status API and in the client poller, so it stops polling.
- Cover: provider unavailable, initiation rejected, admin-confirmed but unpaid order, failed payment, refunded payment.

### 4. User restore (small)
- `UserRepository.restore` and `bulkRestore` clear `deletedAt` but leave `isActive` false, because soft delete sets it false.
- Decide one clear rule and document it in a comment: restoring an archived user should also set `isActive` back to true, unless the user was deactivated on purpose before archiving. If you cannot tell the difference without a new column, restore to `isActive: true` and show a clear admin message.
- Fix the admin customer order links. They point to the owner-only storefront route. Link to the admin order page instead.
- Make the sitemap include all active products, not only the first 100. Page through the source.
- Tests for restore and bulkRestore.

### 5. F13: a real refund status (needs schema change)
Problem: cancelling or refunding a paid order sets the payment to `REFUNDED` straight away. But the admin still has to send the money back with Stripe or M-Pesa. Reports and customers can see "refunded" when no money has moved.

Build this:
- A `Refund` table: id, paymentId, orderId, amount, currency, status (`REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`), method (`STRIPE`, `MPESA_MANUAL`, `CASH`, `OTHER`), providerReference (nullable), reason, requestedBy, completedBy, timestamps, failureReason.
- The original `Payment` row stays as it was. Never change its amount. Add a derived "refunded amount" instead.
- Cancelling or refunding a paid order creates a `REQUESTED` refund. It does not mark the money as returned.
- A refund moves to `COMPLETED` only when: (a) Stripe confirms it through the API or webhook, or (b) an admin with `orders.delete` confirms a manual refund and enters a provider reference. Log every change in the audit log.
- Support partial refunds. The sum of refunds must never exceed the payment amount. Enforce this with a conditional update or a lock.
- Update admin order pages, customer order pages and analytics so they say "refund requested" or "refunded" correctly.
- Write a migration that turns existing `REFUNDED` payments into `COMPLETED` refunds with method `OTHER` and a note "migrated". Do not lose data.
- Tests: request, complete, fail, retry, partial, over-refund blocked, double confirm blocked.

### 6. F12 second half: sign out old sessions after a password change (needs schema change)
- Add `sessionVersion Int @default(0)` to `User`.
- Put the version in the JWT when it is issued. In the `jwt` callback, compare it with the database. If it differs, mark the token as disabled (the same path used for deactivated accounts).
- Increase `sessionVersion` in the same transaction as: password reset, password change, and admin deactivate or role change.
- Tests: a token with an old version is rejected after a reset, and a new login works.

### 7. F16: product saves in one step
- `updateProductAction` writes the parent product before it parses nested variants. Images and features are replaced in separate writes.
- Parse and validate the whole payload first (use Zod). Reject bad JSON, negative prices, duplicate SKUs and variants that belong to another product.
- Nested variant prices must use the same price rules as the base price.
- Do all writes in one `prisma.$transaction`. If any step fails, nothing changes.
- New variants must not get a hidden default stock of 10. Require an explicit initial stock value in the form, defaulting to 0.
- Tests: bad nested JSON, negative price, duplicate SKU, an injected failure part way, and a cross-product variant id. The original product must be unchanged in each case.

### 8. F18: M-Pesa polling limits
- A status GET older than ten seconds triggers a provider query. Many tabs or pollers can multiply provider calls. Each query also fetches a fresh OAuth token.
- Add a per-payment cooldown, stored on the payment (for example `lastProviderQueryAt`), claimed with a conditional update so only one caller proceeds.
- Cache the OAuth token in memory until shortly before it expires.
- Reconciliation job: process stale payments in bounded batches (for example 25) with limited concurrency (for example 3). Add a job lease (a row or an advisory lock) so two overlapping runs cannot both process the same payments.
- Settlement stays server-authoritative. The client never decides.
- Tests: 20 parallel status calls cause one provider query. Two overlapping job runs do not double-process.

### 9. F19: dashboard arithmetic (separate decision, ask me first)
Before you code, write a short note that defines each metric: which order and payment statuses count, the date range, how discounts and refunds are treated, and which cost is used. Wait for my yes. Then:
- Only count orders with a completed payment (or delivered COD) and subtract completed refunds.
- Subtract order discounts from profit.
- Store a cost snapshot on each order item (`costPriceAtSale`) so old profit does not change when product cost changes. Migration: backfill from the current cost.
- Aggregate in SQL. Remove the silent 5,000 order cap.
- Conversion rate: use the same period for orders and visitors.
- Customer lifetime value must sum all their paid orders, not the latest ten.
- Tests with cancelled, refunded and discounted orders.

### 10. F15: backup and restore script
- The fallback `docker compose exec postgres pg_restore ...` ignores the host and port you pass in. A restore to a remote database can hit the local one instead.
- Parse the target URL. If the target is not the local compose database, refuse the docker fallback with a clear message, or connect explicitly with host and port.
- Print the resolved target (host, port, database, never the password) and ask for a typed confirmation before any destructive step. Add a `--yes` flag for automation.
- Pass passwords through `PGPASSWORD`, not command-line arguments.
- Include the uploads folder (`UPLOAD_DIR`, default `/data/uploads`) in backup and restore.
- Test with a stubbed child process: check the arguments for local and remote targets.
- Document a restore drill into a throwaway database in `docs/`.

### 11. F22: CI gate
- Add `.github/workflows/ci.yml`: install with a frozen lockfile, `prisma generate`, typecheck, unit tests, `next build`, and `pnpm audit --prod` (fail on high or critical).
- Run on pull requests and pushes to main.
- Keep the existing backup and reconciliation workflows as they are.
- Add an E2E job later. Use a disposable Postgres service and provider stubs. Do not turn on payment simulation in production builds.

## Done means

- Every task above has code, tests and a note in your final table.
- Typecheck, tests and the production build pass.
- No migration edits old migrations.
- You list anything you skipped and why.
