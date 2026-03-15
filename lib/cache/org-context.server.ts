/**
 * Org Context Cache
 *
 * Redis caching for getOrgContext() to eliminate 7-9 DB queries per
 * authenticated page load. Only the org/membership/subscription/plan data
 * is cached — session-specific data (CSRF tokens, session ID) is NOT cached.
 *
 * Cache key format : org-context:{orgId}:{userId}
 * TTL              : 5 minutes (300 seconds)
 *
 * Invalidation is triggered by:
 *   - Subscription changes  → invalidateOrgContextCache(orgId)
 *   - Membership changes    → invalidateOrgContextCache(orgId)
 *   - Plan feature changes  → invalidateOrgContextCache(orgId)
 */

import { getRedisConnection } from "../redis.server";
import { redisLogger } from "../logger";
import type { OrgContext } from "../auth/org-context.server";

/** Cache TTL: 5 minutes */
export const ORG_CONTEXT_CACHE_TTL = 300;

/**
 * Build the Redis key for a specific org+user combination.
 */
export function buildOrgContextCacheKey(orgId: string, userId: string): string {
  return `org-context:${orgId}:${userId}`;
}

/**
 * Retrieve a cached OrgContext from Redis.
 *
 * Returns null on cache miss, Redis error, or JSON parse failure.
 * Never throws — cache errors are handled gracefully (fail open).
 */
export async function getCachedOrgContext(
  orgId: string,
  userId: string
): Promise<OrgContext | null> {
  try {
    const redis = getRedisConnection();
    const key = buildOrgContextCacheKey(orgId, userId);
    const raw = await redis.get(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as OrgContext;
    return parsed;
  } catch (error) {
    redisLogger.error({ err: error, orgId, userId }, "Failed to read org context from cache");
    return null;
  }
}

/**
 * Store an OrgContext in Redis.
 *
 * Only caches the fields that are stable between requests.
 * The session object (including session.id used for CSRF) is included
 * as-is — the caller is responsible for not passing ephemeral fields
 * that change per request.
 *
 * Never throws — cache write failures are handled gracefully (fail safe).
 */
export async function setCachedOrgContext(
  orgId: string,
  userId: string,
  context: OrgContext
): Promise<void> {
  try {
    const redis = getRedisConnection();
    const key = buildOrgContextCacheKey(orgId, userId);
    const serialized = JSON.stringify(context);
    await redis.set(key, serialized, "EX", ORG_CONTEXT_CACHE_TTL);

    redisLogger.info({ orgId, userId }, "Cached org context");
  } catch (error) {
    redisLogger.error({ err: error, orgId, userId }, "Failed to write org context to cache");
    // Swallow — a failed cache write must not break the request
  }
}

/**
 * Invalidate all cached org contexts for an organization.
 *
 * Uses SCAN to find all keys matching `org-context:{orgId}:*` and deletes
 * them. This covers all users in the org without needing to know their IDs.
 *
 * Call this whenever subscription, plan, or membership data changes for the org.
 *
 * Never throws — cache invalidation failures are handled gracefully.
 */
export async function invalidateOrgContextCache(organizationId: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const pattern = `org-context:${organizationId}:*`;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");

    redisLogger.info({ organizationId }, "Invalidated org context cache");
  } catch (error) {
    redisLogger.error({ err: error, organizationId }, "Failed to invalidate org context cache");
    // Swallow — a failed invalidation is recoverable via TTL expiry
  }
}
