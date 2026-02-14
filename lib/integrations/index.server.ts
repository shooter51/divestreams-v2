/**
 * Integration Management Utilities
 *
 * Core functions for managing third-party integrations:
 * - Connect/disconnect integrations
 * - Store and retrieve credentials
 * - Token refresh handling
 * - Simple encryption for tokens
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { integrationLogger } from "../logger";
import {
  integrations,
  integrationSyncLog,
  type Integration,
  type IntegrationProvider,
  type IntegrationDisplay,
  type NewIntegration,
} from "../db/schema/integrations";

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Get encryption key from environment or generate a default
 * In production, INTEGRATION_ENCRYPTION_KEY should be set
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY or AUTH_SECRET environment variable must be set");
  }
  // Use scrypt to derive a 32-byte key from the secret
  return scryptSync(secret, "divestreams-salt", 32);
}

/**
 * Encrypt a string value for storage
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptToken(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a stored encrypted value
 */
export function decryptToken(encryptedValue: string): string {
  const key = getEncryptionKey();
  const parts = encryptedValue.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ============================================================================
// INTEGRATION CRUD OPERATIONS
// ============================================================================

/**
 * Connect a new integration or update existing one
 *
 * @param orgId - Organization ID
 * @param provider - Integration provider
 * @param tokens - OAuth tokens or API credentials
 * @param accountInfo - External account information
 * @param settings - Provider-specific settings
 */
export async function connectIntegration(
  orgId: string,
  provider: IntegrationProvider,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: string;
  },
  accountInfo?: {
    accountId?: string;
    accountName?: string;
    accountEmail?: string;
  },
  settings?: Record<string, unknown>
): Promise<Integration> {
  // Encrypt tokens before storage
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : null;

  // Check if integration already exists
  const existing = await getIntegration(orgId, provider);

  if (existing) {
    // Update existing integration
    const [updated] = await db
      .update(integrations)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt || null,
        scopes: tokens.scopes || null,
        accountId: accountInfo?.accountId || existing.accountId,
        accountName: accountInfo?.accountName || existing.accountName,
        accountEmail: accountInfo?.accountEmail || existing.accountEmail,
        settings: settings ? { ...existing.settings, ...settings } : existing.settings,
        isActive: true,
        connectedAt: new Date(),
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id))
      .returning();

    return updated;
  }

  // Create new integration
  const newIntegration: NewIntegration = {
    organizationId: orgId,
    provider,
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    tokenExpiresAt: tokens.expiresAt || null,
    scopes: tokens.scopes || null,
    accountId: accountInfo?.accountId || null,
    accountName: accountInfo?.accountName || null,
    accountEmail: accountInfo?.accountEmail || null,
    settings: settings || null,
    isActive: true,
    connectedAt: new Date(),
  };

  const [created] = await db.insert(integrations).values(newIntegration).returning();

  return created;
}

/**
 * Disconnect an integration by marking it inactive and clearing tokens
 */
export async function disconnectIntegration(
  orgId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const result = await db
    .update(integrations)
    .set({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.provider, provider)
      )
    )
    .returning({ id: integrations.id });

  return result.length > 0;
}

/**
 * Permanently delete an integration and all related sync logs
 */
export async function deleteIntegration(
  orgId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const result = await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.provider, provider)
      )
    )
    .returning({ id: integrations.id });

  return result.length > 0;
}

/**
 * Get an integration by organization and provider
 */
export async function getIntegration(
  orgId: string,
  provider: IntegrationProvider
): Promise<Integration | null> {
  const [result] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.provider, provider)
      )
    )
    .limit(1);

  return result || null;
}

/**
 * Get integration with decrypted tokens (for API calls)
 */
export async function getIntegrationWithTokens(
  orgId: string,
  provider: IntegrationProvider
): Promise<{
  integration: Integration;
  accessToken: string;
  refreshToken: string | null;
} | null> {
  const integration = await getIntegration(orgId, provider);

  if (!integration || !integration.isActive || !integration.accessToken) {
    return null;
  }

  try {
    const accessToken = decryptToken(integration.accessToken);
    const refreshToken = integration.refreshToken
      ? decryptToken(integration.refreshToken)
      : null;

    return {
      integration,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    integrationLogger.error({ err: error, provider, organizationId: orgId }, "Failed to decrypt tokens");
    return null;
  }
}

/**
 * List all integrations for an organization (display info only)
 */
export async function listIntegrations(orgId: string): Promise<IntegrationDisplay[]> {
  const results = await db
    .select({
      id: integrations.id,
      provider: integrations.provider,
      accountName: integrations.accountName,
      accountEmail: integrations.accountEmail,
      isActive: integrations.isActive,
      connectedAt: integrations.connectedAt,
      lastSyncAt: integrations.lastSyncAt,
      lastSyncError: integrations.lastSyncError,
      settings: integrations.settings,
    })
    .from(integrations)
    .where(eq(integrations.organizationId, orgId))
    .orderBy(integrations.connectedAt);

  return results.map((r) => ({
    ...r,
    provider: r.provider as IntegrationProvider,
    settings: r.settings as Record<string, unknown> | null,
  }));
}

/**
 * List active integrations for an organization
 */
export async function listActiveIntegrations(orgId: string): Promise<IntegrationDisplay[]> {
  const results = await db
    .select({
      id: integrations.id,
      provider: integrations.provider,
      accountName: integrations.accountName,
      accountEmail: integrations.accountEmail,
      isActive: integrations.isActive,
      connectedAt: integrations.connectedAt,
      lastSyncAt: integrations.lastSyncAt,
      lastSyncError: integrations.lastSyncError,
      settings: integrations.settings,
    })
    .from(integrations)
    .where(
      and(eq(integrations.organizationId, orgId), eq(integrations.isActive, true))
    )
    .orderBy(integrations.connectedAt);

  return results.map((r) => ({
    ...r,
    provider: r.provider as IntegrationProvider,
    settings: r.settings as Record<string, unknown> | null,
  }));
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Check if an integration's token needs refresh
 * Returns true if token expires within the next 5 minutes
 */
export function tokenNeedsRefresh(integration: Integration): boolean {
  if (!integration.tokenExpiresAt) {
    return false; // No expiry means it doesn't need refresh (API keys)
  }

  const expiresAt = new Date(integration.tokenExpiresAt);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  return expiresAt <= fiveMinutesFromNow;
}

/**
 * Update tokens after a refresh
 */
export async function updateTokens(
  integrationId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }
): Promise<void> {
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : undefined;

  await db
    .update(integrations)
    .set({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integrationId));
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(
  integrationId: string,
  error?: string
): Promise<void> {
  await db
    .update(integrations)
    .set({
      lastSyncAt: new Date(),
      lastSyncError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integrationId));
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  orgId: string,
  provider: IntegrationProvider,
  settings: Record<string, unknown>
): Promise<Integration | null> {
  const existing = await getIntegration(orgId, provider);

  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(integrations)
    .set({
      settings: { ...existing.settings, ...settings },
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, existing.id))
    .returning();

  return updated;
}

// ============================================================================
// SYNC LOG OPERATIONS
// ============================================================================

/**
 * Log a sync operation
 */
export async function logSyncOperation(
  integrationId: string,
  action: string,
  status: "pending" | "success" | "failed",
  details?: {
    entityType?: string;
    entityId?: string;
    externalId?: string;
    request?: unknown;
    response?: unknown;
    error?: string;
  }
): Promise<void> {
  await db.insert(integrationSyncLog).values({
    integrationId,
    action,
    status,
    entityType: details?.entityType,
    entityId: details?.entityId,
    externalId: details?.externalId,
    details: details
      ? {
          request: details.request,
          response: details.response,
          error: details.error,
        }
      : null,
  });
}

/**
 * Get recent sync logs for an integration
 */
export async function getSyncLogs(
  integrationId: string,
  limit = 50
): Promise<typeof integrationSyncLog.$inferSelect[]> {
  return db
    .select()
    .from(integrationSyncLog)
    .where(eq(integrationSyncLog.integrationId, integrationId))
    .orderBy(integrationSyncLog.createdAt)
    .limit(limit);
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export {
  type Integration,
  type IntegrationProvider,
  type IntegrationDisplay,
} from "../db/schema/integrations";
