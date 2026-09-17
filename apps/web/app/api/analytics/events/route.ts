import { NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { clientIdentifier, rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // visitorId is generated in the browser and freely re-rollable, so the limit
  // is keyed on the client address instead. Without it a trivial loop could
  // grow analytics_events without bound and skew the traffic figures the store
  // owner relies on.
  const limit = rateLimit(`analytics:${await clientIdentifier()}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many events' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const { visitorId, path } = await request.json();
    if (
      typeof visitorId !== 'string' ||
      visitorId.length < 8 ||
      visitorId.length > 100 ||
      typeof path !== 'string' ||
      !path.startsWith('/') ||
      path.length > 500
    ) {
      return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
    }

    await createRepositories().analytics.recordPageView(visitorId, path);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Unable to record analytics event' }, { status: 400 });
  }
}
