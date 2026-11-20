import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { reconcileStalePayments } from '@/lib/payments/reconcile';

/**
 * Scheduled reconciliation entry point.
 *
 * Re-checks payments whose provider callback never arrived, and releases stock
 * held by orders that were never paid for. Point any scheduler at this — Vercel
 * Cron, a systemd timer, GitHub Actions — with the shared secret:
 *
 *   Authorization: Bearer $CRON_SECRET
 *
 * Running it roughly every 15 minutes keeps abandoned stock from accumulating.
 * The endpoint is disabled entirely when CRON_SECRET is unset.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so length-check first.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error('Reconciliation endpoint called but CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secretMatches(provided, expected)) {
    // Deliberately a 404 — don't confirm that this endpoint exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const summary = await reconcileStalePayments();
    console.info('Payment reconciliation complete', summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('Payment reconciliation failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
