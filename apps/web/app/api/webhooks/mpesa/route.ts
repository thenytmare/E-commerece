import { NextResponse } from 'next/server';

/**
 * Legacy unauthenticated M-Pesa callback path.
 *
 * Previously this endpoint completed payments straight from the request body,
 * which let anyone who knew a CheckoutRequestID mark an order as paid. It now
 * rejects everything; the real handler lives at
 * `/api/webhooks/mpesa/{MPESA_CALLBACK_SECRET}`.
 *
 * Kept (rather than deleted) so a misconfigured Daraja CallBackURL shows up
 * as a logged 404 instead of a silent Next.js route miss.
 */
export async function POST() {
  console.warn(
    'M-Pesa callback hit the legacy unauthenticated path. Update the Daraja CallBackURL to include the callback secret.'
  );
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
