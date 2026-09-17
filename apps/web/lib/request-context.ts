import { headers } from 'next/headers';

/**
 * Best-effort client IP for audit logging. Behind a proxy/load balancer the
 * socket address is the proxy's, so prefer the standard forwarding headers.
 * Returns null rather than a bogus value when nothing usable is present.
 */
export async function getClientIp(): Promise<string | null> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    if (forwardedFor) {
      // Left-most entry is the original client.
      const first = forwardedFor.split(',')[0]?.trim();
      if (first) return first;
    }
    return headerList.get('x-real-ip') ?? null;
  } catch {
    // headers() throws outside a request scope — not fatal for an audit log.
    return null;
  }
}
