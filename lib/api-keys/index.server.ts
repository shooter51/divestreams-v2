/**
 * API Key Management Utilities
 *
 * Provides secure API key generation, hashing, and validation.
 * Keys follow the format: dk_live_<random> or dk_test_<random>
 */

import { createHash, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { apiKeys, type ApiKeyPermissions, type ApiKeyDisplay } from "../db/schema/api-keys";
import { organization } from "../db/schema/auth";

// Re-export types for consumers
export type { ApiKeyPermissions, ApiKeyDisplay };

// ============================================================================
// CONSTANTS
// ============================================================================

/** Prefix for live/production API keys */
const LIVE_KEY_PREFIX = "dk_live_";

/** Prefix for test/sandbox API keys */
const TEST_KEY_PREFIX = "dk_test_";

/** Length of the random portion of the key (32 chars = 128 bits of entropy) */
const RANDOM_KEY_LENGTH = 32;

/** Number of characters from the key to store as prefix for identification */
const KEY_PREFIX_LENGTH = 12;

// ============================================================================
// KEY GENERATION & HASHING
// ============================================================================

/**
 * Generate a new API key with the specified mode
 *
 * @param mode - "live" for production or "test" for sandbox
 * @returns The full API key (only returned once!)
 */
export function generateApiKey(mode: "live" | "test" = "live"): string {
  const prefix = mode === "live" ? LIVE_KEY_PREFIX : TEST_KEY_PREFIX;
  const randomPart = randomBytes(RANDOM_KEY_LENGTH / 2).toString("hex");
  return `${prefix}${randomPart}`;
}

/**
 * Hash an API key for secure storage
 *
 * Uses SHA-256 which is fast for validation but secure for storage.
 *
 * @param key - The full API key to hash
 * @returns The SHA-256 hash of the key
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract the prefix from an API key for display/identification
 *
 * @param key - The full API key
 * @returns The first 12 characters (e.g., "dk_live_abc1")
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, KEY_PREFIX_LENGTH);
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Create a new API key for an organization
 *
 * IMPORTANT: The returned `key` field contains the full API key.
 * This is the ONLY time the full key is available - it cannot be retrieved later!
 *
 * @param orgId - The organization ID
 * @param name - A user-friendly name for the key
 * @param permissions - Optional permission settings
 * @param expiresAt - Optional expiration date
 * @returns The created key record WITH the full unhashed key
 */
export async function createApiKey(
  orgId: string,
  name: string,
  permissions?: ApiKeyPermissions,
  expiresAt?: Date
): Promise<{
  id: string;
  name: string;
  key: string; // Full key - only returned once!
  keyPrefix: string;
  permissions: ApiKeyPermissions | null;
  createdAt: Date;
}> {
  const key = generateApiKey("live");
  const keyHash = hashApiKey(key);
  const keyPrefix = getKeyPrefix(key);

  const [created] = await db
    .insert(apiKeys)
    .values({
      organizationId: orgId,
      name,
      keyHash,
      keyPrefix,
      permissions: permissions || { read: true, write: true, delete: false },
      expiresAt,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    key, // Return the full key - only time it's available!
    keyPrefix: created.keyPrefix,
    permissions: created.permissions as ApiKeyPermissions | null,
    createdAt: created.createdAt,
  };
}

/**
 * List all API keys for an organization
 *
 * Only returns display info - never the hash or full key.
 *
 * @param orgId - The organization ID
 * @returns Array of API key display info
 */
export async function listApiKeys(orgId: string): Promise<ApiKeyDisplay[]> {
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, orgId))
    .orderBy(apiKeys.createdAt);

  return keys.map((key) => ({
    ...key,
    permissions: key.permissions as ApiKeyPermissions | null,
  }));
}

/**
 * Revoke (deactivate) an API key
 *
 * This soft-deletes the key by setting isActive to false.
 *
 * @param keyId - The API key ID
 * @param orgId - The organization ID (for security - ensures key belongs to org)
 * @returns True if key was revoked, false if not found
 */
export async function revokeApiKey(keyId: string, orgId: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId)))
    .returning({ id: apiKeys.id });

  return result.length > 0;
}

/**
 * Delete an API key permanently
 *
 * @param keyId - The API key ID
 * @param orgId - The organization ID (for security)
 * @returns True if key was deleted, false if not found
 */
export async function deleteApiKey(keyId: string, orgId: string): Promise<boolean> {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId)))
    .returning({ id: apiKeys.id });

  return result.length > 0;
}

/**
 * Validate an API key and return the organization context
 *
 * This is the main function for API authentication.
 * It validates the key, checks if it's active and not expired,
 * and returns the organization details if valid.
 *
 * @param key - The full API key to validate
 * @returns The organization context if valid, null otherwise
 */
export async function validateApiKey(key: string): Promise<{
  orgId: string;
  orgName: string;
  orgSlug: string;
  keyId: string;
  keyName: string;
  permissions: ApiKeyPermissions | null;
} | null> {
  // Quick validation of key format
  if (!key || (!key.startsWith(LIVE_KEY_PREFIX) && !key.startsWith(TEST_KEY_PREFIX))) {
    return null;
  }

  const keyHash = hashApiKey(key);

  // Find the key and join with organization
  const [result] = await db
    .select({
      keyId: apiKeys.id,
      keyName: apiKeys.name,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
      permissions: apiKeys.permissions,
      orgId: organization.id,
      orgName: organization.name,
      orgSlug: organization.slug,
    })
    .from(apiKeys)
    .innerJoin(organization, eq(apiKeys.organizationId, organization.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!result) {
    return null;
  }

  // Check if key is active
  if (!result.isActive) {
    return null;
  }

  // Check expiration
  if (result.expiresAt && result.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp (fire and forget - don't await)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, result.keyId))
    .catch(() => {
      // Ignore errors updating lastUsedAt - it's not critical
    });

  return {
    orgId: result.orgId,
    orgName: result.orgName,
    orgSlug: result.orgSlug,
    keyId: result.keyId,
    keyName: result.keyName,
    permissions: result.permissions as ApiKeyPermissions | null,
  };
}

/**
 * Get a single API key by ID (for display purposes)
 *
 * @param keyId - The API key ID
 * @param orgId - The organization ID
 * @returns The key display info or null
 */
export async function getApiKey(keyId: string, orgId: string): Promise<ApiKeyDisplay | null> {
  const [key] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.organizationId, orgId)))
    .limit(1);

  if (!key) {
    return null;
  }

  return {
    ...key,
    permissions: key.permissions as ApiKeyPermissions | null,
  };
}
