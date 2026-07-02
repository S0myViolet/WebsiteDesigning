// Minimal in-memory sliding-window rate limiter for the MVP (single-instance
// deployments). For multi-instance production use, back this with Redis or a
// platform rate-limiting layer instead.

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/** Occasional cleanup so long-running servers don't accumulate stale keys. */
function pruneOld(windowMs: number): void {
  if (buckets.size < 1000) return;
  const cutoff = Date.now() - windowMs;
  buckets.forEach((bucket, key) => {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  });
}

/**
 * Record an attempt for `key` and report whether it is allowed.
 * Allows `max` attempts per `windowMs` sliding window.
 */
export function rateLimit(
  key: string,
  { max = 5, windowMs = 60_000 }: { max?: number; windowMs?: number } = {}
): { allowed: boolean; retryAfterSeconds: number } {
  pruneOld(windowMs);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > now - windowMs);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client identifier for rate limiting behind common proxies. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
