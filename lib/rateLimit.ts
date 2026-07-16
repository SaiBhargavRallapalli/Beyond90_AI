/**
 * In-process rate limiter — sliding window, LRU eviction.
 *
 * Two tiers:
 *   AI routes  (/api/assist, /api/ops POST) — 20 req / 60 s
 *   Data routes (/api/crowd, /api/venues)   — 60 req / 60 s
 *
 * In a multi-instance deployment swap the Map for Redis.
 */

const WINDOW_MS = 60_000;        // 1 minute sliding window
const MAX_BUCKETS = 500;         // LRU eviction threshold

export type RateLimitTier = 'ai' | 'data';

const LIMITS: Record<RateLimitTier, number> = {
  ai:   20,
  data: 60,
};

interface Bucket {
  count:   number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Evict expired entries; if still over capacity, remove the oldest key. */
function evict(): void {
  const now = Date.now();

  for (const [key, b] of store) {
    if (b.resetAt < now) store.delete(key);
    if (store.size < MAX_BUCKETS) return;
  }

  // Hard eviction: remove the first (oldest-inserted) key
  const oldest = store.keys().next().value;
  if (oldest !== undefined) store.delete(oldest);
}

/**
 * Check whether `ip` is within the rate limit for `tier`.
 *
 * Returns:
 *   { allowed: true }                         — request may proceed
 *   { allowed: false, retryAfter: <seconds> } — caller should return 429
 */
export function checkRateLimit(
  ip: string,
  tier: RateLimitTier = 'ai'
): { allowed: boolean; retryAfter?: number } {
  const key = `${tier}:${ip}`;
  const now = Date.now();
  const limit = LIMITS[tier];

  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    // New window
    evict();
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Visible for testing — number of live buckets currently tracked. */
export function bucketCount(): number {
  return store.size;
}

/** Visible for testing — flush all buckets. */
export function _resetStore(): void {
  store.clear();
}
