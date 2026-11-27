import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { createRepositories } from '@repo/database';

/**
 * Fixed-window rate limiter.
 *
 * By default the counts live in Postgres (`rate_limit_buckets`), so every app
 * instance shares them. Two servers no longer each allow the full limit.
 * Set RATE_LIMIT_STORE=memory to keep counts in this process only (the old
 * behaviour, fine for a single server).
 *
 * If the database cannot be reached, the limiter falls back to the in-memory
 * counts for that request, so a database blip never locks everyone out of
 * signing in, and the limit still applies on this server.
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

/** Process-local counts. Used when RATE_LIMIT_STORE=memory and as the fallback. */
export function rateLimitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    // Keep the map from growing without bound under a spray of unique keys.
    if (buckets.size >= MAX_TRACKED_KEYS) {
      pruneExpired(now);
      // Still full of live keys: drop the oldest, so the map has a hard cap.
      // Map keeps insertion order, so the first key is the oldest.
      while (buckets.size >= MAX_TRACKED_KEYS) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
    }
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
 * Keys can hold an email address or an IP. The shared table stores a hash
 * instead, keeping only the readable prefix ("login", "auth-account"), so the
 * table holds no personal data and every key has the same small size.
 */
export function storedKey(key: string): string {
  const colon = key.indexOf(':');
  const prefix = colon > 0 && colon <= 40 ? key.slice(0, colon) : 'key';
  return `${prefix}:${createHash('sha256').update(key).digest('base64url')}`;
}

let repos: ReturnType<typeof createRepositories> | null = null;
let lastFallbackLog = 0;
/** Clear finished windows on about 1 in 200 calls, on top of the worker's hourly clean-up. */
const PRUNE_CHANCE = 1 / 200;

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_STORE === 'memory') {
    return rateLimitInMemory(key, limit, windowMs);
  }
  try {
    repos ??= createRepositories();
    const result = await repos.rateLimit.hit(storedKey(key), limit, windowMs);
    if (Math.random() < PRUNE_CHANCE) {
      void repos.rateLimit.pruneExpired().catch(() => undefined);
    }
    return result;
  } catch (error) {
    const now = Date.now();
    if (now - lastFallbackLog > 60_000) {
      lastFallbackLog = now;
      console.warn(
        JSON.stringify({
          type: 'rate-limit.fallback',
          at: new Date(now).toISOString(),
          message: 'Shared rate limit store unavailable; using this server\'s own counts.',
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
    return rateLimitInMemory(key, limit, windowMs);
  }
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
