/**
 * In-memory token-bucket rate limiter for auth endpoints (login/signup/reset).
 *
 * NOTE (production): this Map lives per-process, so on Cloudflare Pages /
 * any multi-instance deploy each worker has its own bucket. For a shared
 * limiter, swap the store for Upstash Redis (or similar) — the interface
 * below (`checkRateLimit`) stays the same; only the token store changes.
 */

type Bucket = { tokens: number; lastRefill: number };

const buckets = new Map<string, Bucket>();

// Sweep expired buckets periodically to avoid unbounded memory growth.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now - b.lastRefill > windowMs) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the bucket refills enough to allow one request. */
  retryAfterSec: number;
}

/**
 * Token bucket: `maxRequests` tokens per `windowMs`.
 * Call with a key like `signup:${ip}` before handling the request.
 */
export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60_000): RateLimitResult {
  sweep(windowMs);
  const now = Date.now();
  const refillPerMs = maxRequests / windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxRequests, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxRequests, bucket.tokens + elapsed * refillPerMs);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  const retryAfterSec = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000);
  return { allowed: false, retryAfterSec };
}
