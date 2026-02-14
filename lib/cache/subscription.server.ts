/**
 * Subscription Cache Invalidation
 *
 * [KAN-594 FIX PHASE 3]
 * Provides cache invalidation functions for subscription changes.
 * When an admin updates a subscription, we need to invalidate cached
 * org context so tenants immediately see premium features.
 */

import { getRedisConnection } from "../redis.server";
import { redisLogger } from "../logger";

/**
 * Invalidate all subscription-related cache for an organization
 * Call this after any subscription change (plan upgrade/downgrade, status change)
 *
 * @param organizationId - The organization ID whose cache should be cleared
 */
export async function invalidateSubscriptionCache(organizationId: string): Promise<void> {
  const redis = getRedisConnection();

  try {
    // Clear various cache keys that might store subscription data
    const cacheKeys = [
      `session:${organizationId}:subscription`,
      `session:${organizationId}:plan`,
      `org:${organizationId}:context`,
      `org:${organizationId}:limits`,
    ];

    await redis.del(...cacheKeys);

    redisLogger.info({ organizationId }, "Invalidated subscription cache");
  } catch (error) {
    // Don't throw - cache invalidation failure shouldn't break the subscription update
    redisLogger.error({ err: error, organizationId }, "Failed to invalidate subscription cache");
  }
}

/**
 * Invalidate cache for multiple organizations at once
 * Useful for bulk operations or migrations
 *
 * @param organizationIds - Array of organization IDs
 */
export async function invalidateSubscriptionCacheBulk(organizationIds: string[]): Promise<void> {
  const redis = getRedisConnection();

  try {
    const allKeys: string[] = [];

    for (const orgId of organizationIds) {
      allKeys.push(
        `session:${orgId}:subscription`,
        `session:${orgId}:plan`,
        `org:${orgId}:context`,
        `org:${orgId}:limits`
      );
    }

    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }

    redisLogger.info({ count: organizationIds.length }, "Bulk invalidated subscription cache");
  } catch (error) {
    redisLogger.error({ err: error, count: organizationIds.length }, "Failed to bulk invalidate subscription cache");
  }
}
