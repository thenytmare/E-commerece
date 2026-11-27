# Unpaid checkout recovery and local M-Pesa testing

Checkout snapshots the items into an unpaid order and reserves its stock. The cart page shows these saved orders for the owning account, signed guest order cookie, or original guest cart. **Resume payment** opens the same order without making another reservation.

**Return items to cart** cancels an unpaid order and merges its quantities back into the current cart in one transaction. It releases reservations once and records a recovery timestamp to prevent duplicate restoration. Completed/refunded payments and unresolved payment attempts block recovery. Existing cart items are preserved; unavailable stock causes the whole recovery to roll back. The next checkout recalculates prices and delivery.

M-Pesa callback configuration uses `MPESA_CALLBACK_BASE_URL` (a public HTTPS origin), falling back to `NEXT_PUBLIC_APP_URL`. Keep the public tunnel running during local testing; setting the callback to localhost cannot work. The callback secret stays server-side and is appended to the webhook path automatically.

For the configured development domain, start the existing ngrok installation with:

```powershell
ngrok http http://127.0.0.1:3000 --url=https://shallot-lantern-snowiness.ngrok-free.dev
```

Use the configured executable path if ngrok is not on PATH. `/api/health` on the public origin should return HTTP 200 JSON before testing a phone prompt. `MPESA_ENV=sandbox` remains the test environment; switching to production requires the matching Safaricom credentials.

An accepted STK request is not proof of payment. The app checks Daraja's authoritative status before settlement. Network timeouts and “transaction does not exist” responses remain unresolved; they must not be treated as payment success or permission to discard an order. Retry requests are limited per order, and a definite initiation rejection leaves items recoverable.
