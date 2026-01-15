/**
 * Mailchimp Integration
 *
 * Provides OAuth authentication and email marketing functionality.
 * Supports customer sync, audience management, and campaign integration.
 *
 * Environment variables required:
 * - MAILCHIMP_CLIENT_ID: OAuth 2.0 client ID from Mailchimp
 * - MAILCHIMP_CLIENT_SECRET: OAuth 2.0 client secret
 * - APP_URL: Base URL for OAuth callback (e.g., https://divestreams.com)
 *
 * Mailchimp OAuth Flow:
 * 1. User redirects to Mailchimp authorization URL
 * 2. User approves access
 * 3. Mailchimp redirects back with authorization code
 * 4. We exchange code for access token
 * 5. We get account metadata to determine API endpoint (datacenter)
 */

import {
  connectIntegration,
  getIntegrationWithTokens,
  updateLastSync,
  logSyncOperation,
  type Integration,
} from "./index.server";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { customers } from "../db/schema";

// ============================================================================
// CONSTANTS
// ============================================================================

const MAILCHIMP_AUTH_URL = "https://login.mailchimp.com/oauth2/authorize";
const MAILCHIMP_TOKEN_URL = "https://login.mailchimp.com/oauth2/token";
const MAILCHIMP_METADATA_URL = "https://login.mailchimp.com/oauth2/metadata";

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Get Mailchimp OAuth client credentials from environment
 */
function getMailchimpCredentials() {
  const clientId = process.env.MAILCHIMP_CLIENT_ID;
  const clientSecret = process.env.MAILCHIMP_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Mailchimp OAuth credentials not configured. Set MAILCHIMP_CLIENT_ID and MAILCHIMP_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret, appUrl };
}

/**
 * Build the callback URL for a specific organization
 */
function getCallbackUrl(subdomain?: string): string {
  const { appUrl } = getMailchimpCredentials();
  // For tenant-specific callback, use subdomain
  if (subdomain) {
    const url = new URL(appUrl);
    return `${url.protocol}//${subdomain}.${url.host}/api/integrations/mailchimp/callback`;
  }
  return `${appUrl}/api/integrations/mailchimp/callback`;
}

/**
 * Generate the Mailchimp OAuth authorization URL
 *
 * @param orgId - Organization ID to include in state
 * @param subdomain - Organization subdomain for callback URL
 * @returns URL to redirect the user to
 */
export function getMailchimpAuthUrl(orgId: string, subdomain?: string): string {
  const { clientId } = getMailchimpCredentials();
  const callbackUrl = getCallbackUrl(subdomain);

  // State contains org ID and a nonce for security
  const state = Buffer.from(
    JSON.stringify({ orgId, nonce: Date.now() })
  ).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    state,
  });

  return `${MAILCHIMP_AUTH_URL}?${params.toString()}`;
}

/**
 * Parse and validate the state parameter from OAuth callback
 */
export function parseOAuthState(state: string): { orgId: string; nonce: number } {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(
  code: string,
  subdomain?: string
): Promise<{
  accessToken: string;
}> {
  const { clientId, clientSecret } = getMailchimpCredentials();
  const callbackUrl = getCallbackUrl(subdomain);

  const response = await fetch(MAILCHIMP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Mailchimp token exchange failed:", error);
    throw new Error("Failed to exchange authorization code for tokens");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
  };
}

/**
 * Get Mailchimp account metadata (datacenter, account name, etc.)
 * This is required to construct the API base URL
 */
export async function getMailchimpMetadata(accessToken: string): Promise<{
  dc: string;
  accountId: string;
  login: {
    email: string;
    loginId: number;
    loginName: string;
    loginEmail: string;
  };
  accountName: string;
  apiEndpoint: string;
}> {
  const response = await fetch(MAILCHIMP_METADATA_URL, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get Mailchimp account metadata");
  }

  const data = await response.json();

  return {
    dc: data.dc,
    accountId: data.accountId || data.account_id,
    login: data.login,
    accountName: data.accountname || data.login?.login_name || "Mailchimp Account",
    apiEndpoint: data.api_endpoint,
  };
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Complete OAuth flow and connect Mailchimp
 */
export async function handleMailchimpCallback(
  code: string,
  orgId: string,
  subdomain?: string
): Promise<Integration> {
  // Exchange code for token
  const tokens = await exchangeCodeForTokens(code, subdomain);

  // Get account metadata for datacenter and account info
  const metadata = await getMailchimpMetadata(tokens.accessToken);

  // Store the integration
  return connectIntegration(
    orgId,
    "mailchimp",
    {
      accessToken: tokens.accessToken,
      // Mailchimp tokens don't expire and don't have refresh tokens
    },
    {
      accountId: metadata.accountId,
      accountName: metadata.accountName,
      accountEmail: metadata.login?.loginEmail || metadata.login?.email,
    },
    {
      datacenter: metadata.dc,
      apiEndpoint: metadata.apiEndpoint,
      syncEnabled: true,
      syncNewCustomers: true,
      syncExistingCustomers: false,
    }
  );
}

/**
 * Get a valid access token and API endpoint
 */
async function getMailchimpClient(
  orgId: string
): Promise<{
  accessToken: string;
  apiEndpoint: string;
  integration: Integration;
} | null> {
  const result = await getIntegrationWithTokens(orgId, "mailchimp");

  if (!result) {
    return null;
  }

  const { integration, accessToken } = result;
  const settings = integration.settings as { apiEndpoint?: string; datacenter?: string } | null;

  // Get API endpoint from settings or construct from datacenter
  let apiEndpoint = settings?.apiEndpoint;
  if (!apiEndpoint && settings?.datacenter) {
    apiEndpoint = `https://${settings.datacenter}.api.mailchimp.com/3.0`;
  }

  if (!apiEndpoint) {
    // Fallback: get metadata again
    try {
      const metadata = await getMailchimpMetadata(accessToken);
      apiEndpoint = metadata.apiEndpoint;
    } catch {
      return null;
    }
  }

  return { accessToken, apiEndpoint, integration };
}

// ============================================================================
// AUDIENCE (LIST) MANAGEMENT
// ============================================================================

/**
 * Mailchimp audience (list) data
 */
export interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
  dateCreated: string;
}

/**
 * List available audiences (lists) in the Mailchimp account
 */
export async function listAudiences(
  orgId: string
): Promise<MailchimpAudience[] | null> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return null;
  }

  try {
    const response = await fetch(
      `${client.apiEndpoint}/lists?fields=lists.id,lists.name,lists.stats.member_count,lists.date_created&count=100`,
      {
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch Mailchimp audiences:", await response.text());
      return null;
    }

    const data = await response.json();

    return data.lists.map((list: {
      id: string;
      name: string;
      stats?: { member_count: number };
      date_created: string;
    }) => ({
      id: list.id,
      name: list.name,
      memberCount: list.stats?.member_count || 0,
      dateCreated: list.date_created,
    }));
  } catch (error) {
    console.error("Error listing Mailchimp audiences:", error);
    return null;
  }
}

/**
 * Get details of a specific audience
 */
export async function getAudience(
  orgId: string,
  audienceId: string
): Promise<MailchimpAudience | null> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return null;
  }

  try {
    const response = await fetch(
      `${client.apiEndpoint}/lists/${audienceId}`,
      {
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const list = await response.json();

    return {
      id: list.id,
      name: list.name,
      memberCount: list.stats?.member_count || 0,
      dateCreated: list.date_created,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// CONTACT SYNC
// ============================================================================

/**
 * Mailchimp subscriber status
 */
type SubscriberStatus = "subscribed" | "unsubscribed" | "cleaned" | "pending" | "transactional";

/**
 * Result of syncing a customer
 */
interface SyncCustomerResult {
  success: boolean;
  subscriberId?: string;
  error?: string;
}

/**
 * Sync a single customer to Mailchimp audience
 */
export async function syncCustomerToMailchimp(
  orgId: string,
  customer: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  },
  audienceId?: string
): Promise<SyncCustomerResult> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return { success: false, error: "Mailchimp not connected" };
  }

  const settings = client.integration.settings as { audienceId?: string } | null;
  const targetAudienceId = audienceId || settings?.audienceId;

  if (!targetAudienceId) {
    return { success: false, error: "No audience selected" };
  }

  // Create MD5 hash of lowercase email (Mailchimp's subscriber ID)
  const crypto = await import("crypto");
  const subscriberHash = crypto
    .createHash("md5")
    .update(customer.email.toLowerCase())
    .digest("hex");

  try {
    // Use PUT to create or update (upsert)
    const response = await fetch(
      `${client.apiEndpoint}/lists/${targetAudienceId}/members/${subscriberHash}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: customer.email,
          status_if_new: "subscribed" as SubscriberStatus,
          merge_fields: {
            FNAME: customer.firstName || "",
            LNAME: customer.lastName || "",
            PHONE: customer.phone || "",
          },
          tags: ["DiveStreams", "Customer"],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail || errorData.title || "Failed to sync customer";

      await logSyncOperation(client.integration.id, "sync_customer", "failed", {
        entityType: "customer",
        entityId: customer.id,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }

    const data = await response.json();

    await logSyncOperation(client.integration.id, "sync_customer", "success", {
      entityType: "customer",
      entityId: customer.id,
      externalId: data.id,
    });

    await updateLastSync(client.integration.id);

    return { success: true, subscriberId: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(client.integration.id, "sync_customer", "failed", {
      entityType: "customer",
      entityId: customer.id,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all customers from an organization to Mailchimp
 */
export async function syncAllCustomers(
  orgId: string
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return { synced: 0, failed: 0, errors: ["Mailchimp not connected"] };
  }

  const settings = client.integration.settings as { audienceId?: string } | null;
  if (!settings?.audienceId) {
    return { synced: 0, failed: 0, errors: ["No audience selected"] };
  }

  // Get all customers for the organization
  const customerList = await db
    .select({
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, orgId),
        // Only sync customers with email addresses
      )
    );

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const customer of customerList) {
    if (!customer.email) {
      continue;
    }

    const result = await syncCustomerToMailchimp(
      orgId,
      {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      },
      settings.audienceId
    );

    if (result.success) {
      synced++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${customer.email}: ${result.error}`);
      }
    }

    // Add small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await updateLastSync(client.integration.id, errors.length > 0 ? `${failed} errors` : undefined);

  return { synced, failed, errors };
}

/**
 * Remove a customer from Mailchimp audience
 */
export async function removeCustomerFromMailchimp(
  orgId: string,
  email: string,
  audienceId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return { success: false, error: "Mailchimp not connected" };
  }

  const settings = client.integration.settings as { audienceId?: string } | null;
  const targetAudienceId = audienceId || settings?.audienceId;

  if (!targetAudienceId) {
    return { success: false, error: "No audience selected" };
  }

  // Create MD5 hash of lowercase email
  const crypto = await import("crypto");
  const subscriberHash = crypto
    .createHash("md5")
    .update(email.toLowerCase())
    .digest("hex");

  try {
    const response = await fetch(
      `${client.apiEndpoint}/lists/${targetAudienceId}/members/${subscriberHash}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
        },
      }
    );

    // 204 No Content or 404 Not Found are both acceptable
    if (!response.ok && response.status !== 404) {
      throw new Error("Failed to remove subscriber");
    }

    await logSyncOperation(client.integration.id, "remove_customer", "success", {
      entityType: "customer",
      externalId: subscriberHash,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(client.integration.id, "remove_customer", "failed", {
      entityType: "customer",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// ACCOUNT INFO
// ============================================================================

/**
 * Get Mailchimp account info
 */
export async function getAccountInfo(
  orgId: string
): Promise<{
  accountId: string;
  accountName: string;
  email: string;
  totalSubscribers: number;
} | null> {
  const client = await getMailchimpClient(orgId);
  if (!client) {
    return null;
  }

  try {
    const response = await fetch(client.apiEndpoint, {
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      accountId: data.account_id,
      accountName: data.account_name,
      email: data.email,
      totalSubscribers: data.total_subscribers || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Verify Mailchimp connection is still valid
 */
export async function verifyConnection(orgId: string): Promise<boolean> {
  const info = await getAccountInfo(orgId);
  return info !== null;
}
