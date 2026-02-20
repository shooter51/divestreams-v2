/**
 * Redis-based rate limiter for spam prevention
 * Uses a fixed window approach with atomic INCR + EXPIRE via Redis MULTI/EXEC.
 *
 * Falls open (allows request) if Redis is unavailable to avoid blocking users.
 */

import { getRedisConnection } from "../redis.server";
import { redisLogger } from "../logger";

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed based on rate limiting.
 *
 * Uses Redis MULTI/EXEC for atomic increment + expire.
 * Key format: `ratelimit:{identifier}` with TTL = max(1000, windowMs).
 *
 * Fail-open: if Redis is unavailable, the request is allowed with a warning.
 *
 * @param identifier - Unique identifier (IP address, email, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
): Promise<RateLimitResult> {
  // Skip rate limiting during E2E/Playwright tests to avoid false failures
  // from parallel workers all sharing the same IP.
  // PLAYWRIGHT_TEST_BASE_URL: set by local Playwright webServer config
  // DISABLE_RATE_LIMIT: set on test VPS for remote E2E tests
  // APP_URL containing "test.": auto-detect test environment
  if (
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.DISABLE_RATE_LIMIT === "true" ||
    (process.env.APP_URL && process.env.APP_URL.includes("test."))
  ) {
    return { allowed: true, remaining: config.maxAttempts, resetAt: Date.now() + config.windowMs };
  }

  // Handle edge case: negative maxAttempts always blocks
  if (config.maxAttempts < 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + config.windowMs,
    };
  }

  const key = `ratelimit:${identifier}`;
  // Minimum TTL of 1 second to avoid degenerate cases
  const windowMs = Math.max(1000, config.windowMs);

  try {
    const redis = getRedisConnection();

    // Atomic MULTI/EXEC: INCR the counter, then check TTL.
    // If no TTL is set (new key), set PEXPIRE after the transaction.
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.pttl(key);

    const results = await pipeline.exec();

    if (!results || results.length < 2) {
      // Unexpected Redis response - fail open
      redisLogger.warn("Rate limiter: unexpected Redis MULTI/EXEC response, allowing request");
      return failOpen(config);
    }

    // results[0] = [error, count], results[1] = [error, pttl]
    const [incrErr, count] = results[0] as [Error | null, number];
    const [pttlErr, pttl] = results[1] as [Error | null, number];

    if (incrErr || pttlErr) {
      redisLogger.warn({ err: incrErr || pttlErr }, "Rate limiter: Redis command error, allowing request");
      return failOpen(config);
    }

    // If the key has no TTL yet (pttl == -1, meaning INCR just created it), set the expiry.
    // This ensures the window starts from the first request.
    if (pttl === -1) {
      await redis.pexpire(key, windowMs);
    }

    const currentCount = count as number;
    const allowed = currentCount <= config.maxAttempts;
    const remaining = Math.max(0, config.maxAttempts - currentCount);

    // Calculate resetAt from the remaining TTL.
    // pttl is in milliseconds; if key was just created, use the full window.
    const ttlMs = pttl > 0 ? pttl : windowMs;
    const resetAt = Date.now() + ttlMs;

    return { allowed, remaining, resetAt };
  } catch (error) {
    // Redis unavailable - fail open
    redisLogger.warn({ err: error }, "Rate limiter: Redis unavailable, allowing request");
    return failOpen(config);
  }
}

/**
 * Fail-open response when Redis is unavailable.
 * Allows the request to proceed to avoid blocking users.
 */
function failOpen(config: RateLimitConfig): RateLimitResult {
  return {
    allowed: true,
    remaining: config.maxAttempts - 1,
    resetAt: Date.now() + config.windowMs,
  };
}

/**
 * Reset rate limit for an identifier.
 * Useful for testing or manual intervention.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.del(`ratelimit:${identifier}`);
  } catch {
    // Fail silently - reset is best-effort
  }
}

/**
 * Get client IP address from request headers.
 * Handles proxies and load balancers.
 *
 * For X-Forwarded-For, uses the RIGHTMOST IP - this is the one appended by
 * the trusted reverse proxy (Caddy) and cannot be spoofed by the client.
 * The leftmost IP can be set to anything by the client.
 */
export function getClientIp(request: Request): string {
  // Cloudflare sets this header and it is trustworthy
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // X-Real-IP is typically set by the reverse proxy (Caddy/nginx) to the connecting IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // X-Forwarded-For: use the RIGHTMOST IP (added by trusted proxy).
  // Format: "client, proxy1, proxy2" - rightmost is from the trusted proxy.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  // Fallback to a default value (won't be accurate but prevents crashes)
  return "unknown";
}
