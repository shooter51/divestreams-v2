/**
 * Public Site Cache
 *
 * Redis-based caching for public site pages. These pages rarely change
 * and are the hottest path under load, so a short TTL cache eliminates
 * redundant DB queries across concurrent visitors to the same tenant.
 */

import { getRedisConnection } from "../redis.server";

const CACHE_TTL_SECONDS = 60; // 1 minute
const KEY_PREFIX = "public-site";

function cacheKey(orgId: string, resource: string): string {
  return `${KEY_PREFIX}:${orgId}:${resource}`;
}

export async function getCached<T>(orgId: string, resource: string): Promise<T | null> {
  try {
    const redis = getRedisConnection();
    const data = await redis.get(cacheKey(orgId, resource));
    if (data) {
      return JSON.parse(data) as T;
    }
  } catch {
    // Cache miss or Redis error — fall through to DB
  }
  return null;
}

export async function setCache(orgId: string, resource: string, data: unknown): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.set(cacheKey(orgId, resource), JSON.stringify(data), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Non-fatal — next request will just hit DB
  }
}

/**
 * Invalidate all public site cache for a tenant.
 * Call when tenant updates their trips, courses, equipment, gallery, or settings.
 */
export async function invalidatePublicSiteCache(orgId: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const keys = await redis.keys(`${KEY_PREFIX}:${orgId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal
  }
}
