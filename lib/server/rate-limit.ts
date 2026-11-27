type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 1000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/** Extract a stable client key from proxy headers for per-IP rate limiting. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return `${scope}:${ip}`;
}

/** In-memory sliding-window rate limiter for protecting live model endpoints. */
export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const now = options.now ?? Date.now();
  const cutoff = now - options.windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) pruneExpired(cutoff);
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  bucket.timestamps.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

function pruneExpired(cutoff: number): void {
  for (const [key, bucket] of buckets) {
    const recent = bucket.timestamps.filter((ts) => ts > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else bucket.timestamps = recent;
  }
}
