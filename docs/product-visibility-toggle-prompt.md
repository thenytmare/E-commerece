# Prompt: product list with a visibility toggle

Copy everything below the line into your coding assistant, from the repo root.

---

You are working on Prime Accessories Kenya. It is a pnpm and Turborepo monorepo. The stack is Next.js 15 App Router, React 19, TypeScript, Prisma 6, Postgres 16 and NextAuth v5. The admin area is under `apps/web/app/admin`. The admin product list is `apps/web/app/admin/catalog/products/ProductListClient.tsx`. Repositories are in `packages/database/src/repositories`.

## Goal

The admin needs a clear list of products with a switch on each row. Turning the switch OFF hides the product from customers. The product stays in the system, with its stock, orders, images and history. Turning it back ON shows it again. The change must be fast, safe and visible to customers soon after.

Use UK English, plain words and short sentences in comments and UI text. No em dashes.

## What "hidden" means

A hidden product has `isActive = false` (and is not deleted, so `deletedAt` is null). The existing code already uses `isActive: true` and `deletedAt: null` as the rule for what customers can see. Keep that rule. Do not add a new column unless you find a real need.

Before you write code, check these and report what you find:
1. The `Product` model has both `isActive` and `status` (`active` or `draft`). `updateProductAction` sets `status` from `isActive`. Make the toggle keep both in step, the same way. If other code reads `status`, make sure it agrees.
2. The existing status filter has values `active`, `inactive`, `draft`, `archived`. Check what each one means in the repository query and keep the filter working.

## Part 1: the admin list

Improve the product list page. Do not rebuild it from scratch. Keep the existing search, filters, pagination, bulk actions and trash.

- Show every product in one table that is easy to scan. Columns: image thumbnail, name (link to edit), brand, category, price, stock (available quantity, with a low-stock mark), status, and the toggle.
- Default view: all non-deleted products, newest first. Add a quick filter group above the table: **All**, **Visible** (on), **Hidden** (off). Show the count on each. Keep the existing brand, category and featured filters. Keep filter state in the URL, so a page refresh or a shared link keeps it.
- The toggle is a real switch (`role="switch"`, `aria-checked`, an accessible name such as "Show Anker cable on the storefront"). It works with the keyboard (Space and Enter). Do not rely on colour alone. Show the words "Visible" or "Hidden" beside it.
- Hidden rows look different: muted text and a "Hidden from customers" label. Visible rows look normal.
- Toggling uses an optimistic update: the switch moves at once, then the server confirms. If the server fails, move it back and show a clear error message. Disable only that row's switch while its request runs. Two quick clicks must not send two conflicting requests.
- A row shows a small "Why can't customers see this?" hint when a product is visible but still cannot be bought, for example when stock is 0 or it has no active variant. Keep this simple and do not block the toggle.
- Bulk actions: select several rows, then "Show selected" or "Hide selected". Show a confirmation with the number of products. Report how many changed.
- The list is fast with 500 or more products. Use server pagination, which already exists. Do not load all rows into the browser.
- Works on a phone. On small screens, switch the table to stacked cards. The toggle stays easy to tap (44px target).
- Empty states: no products, no results for this filter.
- Only users with `products.write` can toggle. Users with read-only access (for example SUPPORT) see the status but the switch is disabled, with a tooltip that explains why. The server must enforce this too.

## Part 2: the server action

Create `setProductVisibilityAction(productId, isActive)` and `bulkSetProductVisibilityAction(ids, isActive)` in `apps/web/lib/actions/admin-products.ts` (or a nearby file).

- Call `requirePermission('products.write')` first.
- Validate the input with Zod. Limit bulk size (for example 200 ids).
- Do the write with one `updateMany` or `update` that sets `isActive` and `status` together, and only for products where `deletedAt` is null. Return how many rows changed. Do not read, decide, then write.
- Write one audit log entry per call: action `product.visibility_change`, with the ids, the new value, and the actor. For bulk, one entry with the list of ids is fine.
- Call `revalidateTag('catalog')` and `revalidatePath` for the admin list so customers and admins see the change soon. Read how `catalog-cache.ts` and the storefront pages use tags before you do this. Note that product data is not cached across requests, but categories, brands and settings are.
- Return a clear result: `{ success, changed, error? }`.
- Do not allow a toggle on a deleted product. Return a helpful error.

## Part 3: the customer side must really hide it

This is the most important part. A hidden product must not appear or be buyable anywhere. Search the code and check every place. Report each one as "already safe" or "fixed".

- Product page `/products/[slug]`: return 404 for a hidden product. Do not show a cached copy.
- Product lists and search: category pages, brand pages, `/products`, search, featured and best-selling, related products, "you may also like", new arrivals.
- Homepage sections that pick products (featured, flash sales, banners that link to a product).
- Sitemap and `robots`: a hidden product must not be in the sitemap. Its URL returns 404, so search engines drop it.
- Structured data (JSON-LD) and Open Graph tags: not produced for a hidden product.
- Cart: a hidden product already in someone's cart. Show it as "No longer available" and block checkout until the customer removes it. Checkout already refuses hidden products (see `createFromCart` in `order.repository.ts`). Make the cart page tell the customer clearly, so they are not surprised at the last step.
- Add to cart and wishlist: refuse to add a hidden product, server side.
- Flash sales and coupons that target a hidden product: they must not make it visible or buyable.
- Existing orders and order history: customers and admins still see the product name and image on past orders. Hiding a product must never change past orders.
- Back-in-stock emails: do not send a "back in stock" email for a hidden product.
- Image URLs: if the file is public, hiding the product does not hide the file. That is fine, but note it in your report.
- Admin can still open and edit a hidden product, and can preview it. Add a "Preview as customer" link only if it is simple and safe.

## Part 4: tests

Add tests for every rule. The repo uses Vitest. Repository tests mock Prisma. Test the "lost the race" case too.

- Repository: setting visibility updates `isActive` and `status` together, skips deleted products, and returns the changed count.
- Server action: rejects users without `products.write`, rejects bad input and oversized bulk lists, writes an audit entry, calls revalidation.
- Storefront queries: a hidden product is missing from list, search, featured and related queries (test the repository filters).
- Product page: hidden returns not found.
- Cart and checkout: a hidden product in the cart is flagged and checkout is refused.
- Sitemap: hidden products are missing.
- Component behaviour (if you add a test setup for the web app): optimistic switch, rollback on error, disabled for read-only users.
- Also do a real manual check. Start the app, hide a product, and confirm it vanishes from the storefront within a few seconds, then show it again. Use `curl` or a headless browser. Report what you saw.

## Part 5: safety and quality rules

- Never hard-delete here. Hiding is the safe alternative to deleting.
- Do not weaken any existing guard.
- Do not change old Prisma migrations. Avoid schema changes. If you truly need one, stop and ask first.
- Keep files small and readable. Match the existing code style.
- Run after each step: `pnpm --filter @repo/database test`, `pnpm --filter @repo/config test`, `cd apps/web && npx tsc --noEmit`. At the end run `cd apps/web && npx next build`.

## Final report

Give me:
1. A table: each place on the customer side, "already safe" or "fixed", and how you checked.
2. What you changed (files) and which tests you added.
3. What you saw in the manual check.
4. Anything you did not do, and why.
5. Any risks. For example: a customer with a hidden product in the cart, or a product shown in a cached page for a short time.
