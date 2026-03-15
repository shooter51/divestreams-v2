/**
 * Subscription Cache Invalidation
 *
 * [KAN-594 FIX PHASE 3]
 * Provides cache invalidation functions for subscription changes.
 * When an admin updates a subscription, we need to invalidate cached
 * org context so tenants immediately see premium features.
 */

import { redisLogger } from "../logger";
import { invalidateOrgContextCache } from "./org-context.server";

/**
 * Invalidate all subscription-related cache for an organization.
 * Delegates to invalidateOrgContextCache which handles the org-context:* key pattern.
 * Call this after any subscription change (plan upgrade/downgrade, status change).
 *
 * @param organizationId - The organization ID whose cache should be cleared
 */
export async function invalidateSubscriptionCache(organizationId: string): Promise<void> {
  try {
    await invalidateOrgContextCache(organizationId);
    redisLogger.info({ organizationId }, "Invalidated subscription cache");
  } catch (error) {
    // Don't throw - cache invalidation failure shouldn't break the subscription update
    redisLogger.error({ err: error, organizationId }, "Failed to invalidate subscription cache");
  }
}

/**
 * Invalidate cache for multiple organizations at once.
 * Useful for bulk operations or migrations.
 *
 * @param organizationIds - Array of organization IDs
 */
export async function invalidateSubscriptionCacheBulk(organizationIds: string[]): Promise<void> {
  try {
    await Promise.all(organizationIds.map((orgId) => invalidateOrgContextCache(orgId)));
    redisLogger.info({ count: organizationIds.length }, "Bulk invalidated subscription cache");
  } catch (error) {
    redisLogger.error({ err: error, count: organizationIds.length }, "Failed to bulk invalidate subscription cache");
  }
}

/**
 * Invalidate cache after a membership change (invite accepted, member removed, role changed).
 * Aliased to invalidateOrgContextCache since membership is part of the cached context.
 *
 * @param organizationId - The organization ID whose cache should be cleared
 */
export async function invalidateMembershipCache(organizationId: string): Promise<void> {
  try {
    await invalidateOrgContextCache(organizationId);
    redisLogger.info({ organizationId }, "Invalidated membership cache");
  } catch (error) {
    redisLogger.error({ err: error, organizationId }, "Failed to invalidate membership cache");
  }
}
