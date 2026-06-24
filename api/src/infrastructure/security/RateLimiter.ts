export interface RateLimitCheckOptions {
  key: string;
  limit: number;
  now?: number;
  windowMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * @description Small in-memory fixed-window limiter for local auth and API guard rails.
 */
export class RateLimiter {
  readonly #buckets = new Map<string, RateLimitBucket>();

  check(options: RateLimitCheckOptions): RateLimitCheckResult {
    const now = options.now ?? Date.now();
    const bucket = this.#buckets.get(options.key);

    if (!bucket || bucket.resetAt <= now) {
      this.cleanup(now);
      this.#buckets.set(options.key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= options.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  reset(): void {
    this.#buckets.clear();
  }

  private cleanup(now: number): void {
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) {
        this.#buckets.delete(key);
      }
    }
  }
}
