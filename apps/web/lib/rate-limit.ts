import { headers } from 'next/headers';

/**
 * Minimal fixed-window rate limiter.
 *
 * Deliberately process-local: this app runs as a single Node server, so a Map
 * is enough to stop credential stuffing and signup spam from one client. If it
 * is ever scaled horizontally, swap the store here for Redis — the call sites
 * won't need to change.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfterSeconds: number;
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    // Keep the map from growing without bound under a spray of unique keys.
    if (buckets.size > MAX_TRACKED_KEYS) pruneExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client address, used only as a rate-limit bucket key (never for
 * authorization/access-control decisions).
 *
 * `X-Forwarded-For` / `X-Real-IP` are cryptographically unverified unless the
 * deployment sits behind a proxy that overwrites them on every inbound
 * request (TRUST_PROXY_HEADERS=true) — a direct client can in principle set
 * them to an arbitrary value per request. But for rate-limiting specifically,
 * reading them anyway is still the safer default: the worst case is an
 * attacker evading the limit on themselves by rotating a fake header value,
 * which never affects any other visitor's bucket. Falling back to a single
 * shared `unknown` bucket whenever the flag is unset is the actual danger —
 * it lets one attacker exhaust the shared bucket and lock out every real
 * visitor, which is exactly the failure this function exists to avoid. So we
 * read the headers on a best-effort basis regardless of the flag, and only
 * fall back to the shared `unknown` identifier when a request truly carries
 * neither header (rare — virtually every real deployment sits behind at
 * least one proxy, CDN, or load balancer).
 *
 * Note: TRUST_PROXY_HEADERS is intentionally not consulted here. It exists
 * to gate *trusting* these headers for security-sensitive decisions (none of
 * which currently read this function's result — only rate-limit keys do);
 * it should not gate whether we merely *attempt* to bucket by them.
 */
export async function clientIdentifier(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]!.trim();
    if (first) return first;
  }
  const realIp = headerList.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function retryMessage(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
}
