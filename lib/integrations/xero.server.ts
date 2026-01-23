/**
 * Xero Integration
 *
 * Provides OAuth2 authentication and accounting sync functionality.
 * Supports syncing invoices, payments, and contacts between DiveStreams and Xero.
 *
 * Environment variables required:
 * - XERO_CLIENT_ID: OAuth 2.0 client ID from Xero Developer Portal
 * - XERO_CLIENT_SECRET: OAuth 2.0 client secret
 * - APP_URL: Base URL for OAuth callback (e.g., https://divestreams.com)
 */

import {
  connectIntegration,
  getIntegration,
  getIntegrationWithTokens,
  updateTokens,
  updateLastSync,
  logSyncOperation,
  tokenNeedsRefresh,
  type Integration,
} from "./index.server";

// ============================================================================
// CONSTANTS
// ============================================================================

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_API = "https://api.xero.com/connections";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

/**
 * Scopes required for Xero integration
 */
const SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings.read",
  "offline_access",
].join(" ");

// ============================================================================
// TYPES
// ============================================================================

export interface XeroOrganization {
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

export interface XeroInvoice {
  InvoiceID?: string;
  Type: "ACCREC" | "ACCPAY"; // ACCREC = Sales Invoice, ACCPAY = Bills
  Contact: {
    ContactID?: string;
    Name: string;
    EmailAddress?: string;
  };
  Date: string; // ISO date
  DueDate: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode?: string;
    TaxType?: string;
  }>;
  Reference?: string;
  Status?: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";
  CurrencyCode?: string;
}

export interface XeroContact {
  ContactID?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: Array<{
    PhoneType: "DEFAULT" | "DDI" | "MOBILE" | "FAX";
    PhoneNumber: string;
  }>;
  Addresses?: Array<{
    AddressType: "STREET" | "POBOX";
    AddressLine1?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
}

export interface XeroSettings {
  tenantId?: string;
  tenantName?: string;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncContacts?: boolean;
  defaultRevenueAccountCode?: string;
  defaultTaxType?: string;
  invoicePrefix?: string;
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Get Xero OAuth client credentials from tenant settings or environment
 */
function getXeroCredentials(
  tenantClientId?: string,
  tenantClientSecret?: string
) {
  const clientId = tenantClientId || process.env.XERO_CLIENT_ID;
  const clientSecret = tenantClientSecret || process.env.XERO_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Xero OAuth credentials not configured. Please add your OAuth app credentials in Settings → Integrations."
    );
  }

  return { clientId, clientSecret, appUrl };
}

/**
 * Build the callback URL for a specific organization
 */
function getCallbackUrl(subdomain?: string): string {
  const { appUrl } = getXeroCredentials();
  if (subdomain) {
    const url = new URL(appUrl);
    return `${url.protocol}//${subdomain}.${url.host}/api/integrations/xero/callback`;
  }
  return `${appUrl}/api/integrations/xero/callback`;
}

/**
 * Generate the Xero OAuth authorization URL
 *
 * @param orgId - Organization ID to include in state
 * @param subdomain - Organization subdomain for callback URL
 * @param tenantClientId - Optional tenant-specific client ID
 * @param tenantClientSecret - Optional tenant-specific client secret
 * @returns URL to redirect the user to
 */
export function getXeroAuthUrl(
  orgId: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): string {
  const { clientId } = getXeroCredentials(tenantClientId, tenantClientSecret);
  const callbackUrl = getCallbackUrl(subdomain);

  // State contains org ID and a nonce for security
  const state = Buffer.from(
    JSON.stringify({ orgId, nonce: Date.now() })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES,
    state,
  });

  return `${XERO_AUTH_URL}?${params.toString()}`;
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
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}> {
  const { clientId, clientSecret } = getXeroCredentials(tenantClientId, tenantClientSecret);
  const callbackUrl = getCallbackUrl(subdomain);

  // Xero requires Basic auth header for token exchange
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Xero token exchange failed:", error);
    throw new Error("Failed to exchange authorization code for tokens");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getXeroCredentials(tenantClientId, tenantClientSecret);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Xero token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Xero returns a new refresh token
    expiresIn: data.expires_in,
  };
}

/**
 * Get connected Xero organizations (tenants)
 */
export async function getXeroConnections(accessToken: string): Promise<XeroOrganization[]> {
  const response = await fetch(XERO_CONNECTIONS_API, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get Xero connections");
  }

  const connections = await response.json();

  return connections.map((conn: { tenantId: string; tenantName: string; tenantType: string }) => ({
    tenantId: conn.tenantId,
    tenantName: conn.tenantName,
    tenantType: conn.tenantType,
  }));
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Complete OAuth flow and connect Xero
 */
export async function handleXeroCallback(
  code: string,
  orgId: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): Promise<Integration> {
  // If tenant credentials not provided, try to retrieve from existing integration settings
  let clientId = tenantClientId;
  let clientSecret = tenantClientSecret;

  if (!clientId || !clientSecret) {
    const existing = await getIntegrationWithTokens(orgId, "xero");
    if (existing) {
      const existingSettings = existing.integration.settings as { oauthClientId?: string; oauthClientSecret?: string } | null;
      clientId = existingSettings?.oauthClientId;
      clientSecret = existingSettings?.oauthClientSecret;
    }
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, subdomain, clientId, clientSecret);

  // Get connected organizations
  const connections = await getXeroConnections(tokens.accessToken);

  if (connections.length === 0) {
    throw new Error("No Xero organizations found. Please connect at least one organization.");
  }

  // Use the first organization (user can change later in settings)
  const primaryOrg = connections[0];

  // Calculate token expiry time
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  // Store the integration with tenant OAuth credentials
  const settings: Record<string, unknown> = {
    tenantId: primaryOrg.tenantId,
    tenantName: primaryOrg.tenantName,
    syncInvoices: true,
    syncPayments: false,
    syncContacts: false,
  };

  // Store tenant OAuth credentials if provided
  if (clientId && clientSecret) {
    settings.oauthClientId = clientId;
    settings.oauthClientSecret = clientSecret;
  }

  return connectIntegration(
    orgId,
    "xero",
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scopes: SCOPES,
    },
    {
      accountId: primaryOrg.tenantId,
      accountName: primaryOrg.tenantName,
    },
    settings
  );
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(
  orgId: string
): Promise<{ accessToken: string; integration: Integration } | null> {
  const result = await getIntegrationWithTokens(orgId, "xero");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;

  // Check if token needs refresh
  if (tokenNeedsRefresh(integration) && refreshToken) {
    try {
      // Get tenant OAuth credentials from settings if available
      const allSettings = integration.settings as XeroSettings & {
        oauthClientId?: string;
        oauthClientSecret?: string;
      } | null;
      const tenantClientId = allSettings?.oauthClientId;
      const tenantClientSecret = allSettings?.oauthClientSecret;

      const refreshed = await refreshAccessToken(refreshToken, tenantClientId, tenantClientSecret);
      const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

      await updateTokens(integration.id, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: newExpiresAt,
      });

      return { accessToken: refreshed.accessToken, integration };
    } catch (error) {
      console.error("Failed to refresh Xero token:", error);
      await updateLastSync(integration.id, "Token refresh failed");
      return null;
    }
  }

  return { accessToken, integration };
}

// ============================================================================
// XERO API OPERATIONS
// ============================================================================

/**
 * Make an authenticated request to Xero API
 */
async function xeroRequest<T>(
  accessToken: string,
  tenantId: string,
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const response = await fetch(`${XERO_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Xero API error (${endpoint}):`, errorText);
    throw new Error(`Xero API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get organization info from Xero
 */
export async function getXeroOrganizationInfo(
  orgId: string
): Promise<{ name: string; shortCode: string; currencyCode: string } | null> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) return null;

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) return null;

  try {
    const data = await xeroRequest<{ Organisations: Array<{ Name: string; ShortCode: string; BaseCurrency: string }> }>(
      accessToken,
      tenantId,
      "/Organisation"
    );

    if (data.Organisations && data.Organisations.length > 0) {
      const org = data.Organisations[0];
      return {
        name: org.Name,
        shortCode: org.ShortCode,
        currencyCode: org.BaseCurrency,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching Xero organization:", error);
    return null;
  }
}

/**
 * Get account codes from Xero for mapping
 */
export async function getXeroAccounts(
  orgId: string
): Promise<Array<{ code: string; name: string; type: string }> | null> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) return null;

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) return null;

  try {
    const data = await xeroRequest<{
      Accounts: Array<{ Code: string; Name: string; Type: string; Status: string }>;
    }>(accessToken, tenantId, "/Accounts?where=Status==\"ACTIVE\"");

    return data.Accounts.map((acc) => ({
      code: acc.Code,
      name: acc.Name,
      type: acc.Type,
    }));
  } catch (error) {
    console.error("Error fetching Xero accounts:", error);
    return null;
  }
}

/**
 * Create an invoice in Xero
 */
export async function createXeroInvoice(
  orgId: string,
  invoice: XeroInvoice
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "Xero not connected" };
  }

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) {
    return { success: false, error: "No Xero organization selected" };
  }

  try {
    const data = await xeroRequest<{ Invoices: Array<{ InvoiceID: string }> }>(
      accessToken,
      tenantId,
      "/Invoices",
      {
        method: "POST",
        body: { Invoices: [invoice] },
      }
    );

    const invoiceId = data.Invoices?.[0]?.InvoiceID;

    await logSyncOperation(integration.id, "create_invoice", "success", {
      entityType: "invoice",
      externalId: invoiceId,
    });

    await updateLastSync(integration.id);

    return { success: true, invoiceId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(integration.id, "create_invoice", "failed", {
      entityType: "invoice",
      error: errorMessage,
    });

    await updateLastSync(integration.id, errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Create or update a contact in Xero
 */
export async function syncContactToXero(
  orgId: string,
  contact: XeroContact
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "Xero not connected" };
  }

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) {
    return { success: false, error: "No Xero organization selected" };
  }

  try {
    const data = await xeroRequest<{ Contacts: Array<{ ContactID: string }> }>(
      accessToken,
      tenantId,
      "/Contacts",
      {
        method: "POST",
        body: { Contacts: [contact] },
      }
    );

    const contactId = data.Contacts?.[0]?.ContactID;

    await logSyncOperation(integration.id, "sync_contact", "success", {
      entityType: "contact",
      externalId: contactId,
    });

    await updateLastSync(integration.id);

    return { success: true, contactId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(integration.id, "sync_contact", "failed", {
      entityType: "contact",
      error: errorMessage,
    });

    await updateLastSync(integration.id, errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Get invoices from Xero
 */
export async function getXeroInvoices(
  orgId: string,
  options?: { status?: string; modifiedAfter?: Date }
): Promise<XeroInvoice[] | null> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) return null;

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) return null;

  try {
    let endpoint = "/Invoices";
    const params: string[] = [];

    if (options?.status) {
      params.push(`Status=="${options.status}"`);
    }

    if (params.length > 0) {
      endpoint += `?where=${encodeURIComponent(params.join(" AND "))}`;
    }

    const headers: Record<string, string> = {};
    if (options?.modifiedAfter) {
      headers["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    const data = await xeroRequest<{ Invoices: XeroInvoice[] }>(
      accessToken,
      tenantId,
      endpoint
    );

    return data.Invoices || [];
  } catch (error) {
    console.error("Error fetching Xero invoices:", error);
    return null;
  }
}

/**
 * Get contacts from Xero
 */
export async function getXeroContacts(
  orgId: string,
  options?: { modifiedAfter?: Date }
): Promise<XeroContact[] | null> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) return null;

  const { accessToken, integration } = auth;
  const settings = integration.settings as XeroSettings | null;
  const tenantId = settings?.tenantId;

  if (!tenantId) return null;

  try {
    const endpoint = "/Contacts";

    const data = await xeroRequest<{ Contacts: XeroContact[] }>(
      accessToken,
      tenantId,
      endpoint
    );

    return data.Contacts || [];
  } catch (error) {
    console.error("Error fetching Xero contacts:", error);
    return null;
  }
}

// ============================================================================
// Sync Functions
// ============================================================================

export interface XeroSyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors?: string[];
}

/**
 * Sync contacts to Xero
 */
export async function syncContactsToXero(organizationId: string): Promise<XeroSyncResult> {
  const integration = await getIntegration(organizationId, 'xero');
  if (!integration?.isActive) {
    return { success: false, synced: 0, failed: 0, errors: ['Xero integration not active'] };
  }

  // Get customers that need syncing
  // For now, return a placeholder - actual implementation requires Xero API calls
  console.log('[Xero] Would sync contacts for org:', organizationId);

  return {
    success: false,
    synced: 0,
    failed: 0,
    errors: ['Xero contact sync requires API implementation'],
  };
}

/**
 * Sync invoices to Xero
 */
export async function syncInvoicesToXero(organizationId: string): Promise<XeroSyncResult> {
  const integration = await getIntegration(organizationId, 'xero');
  if (!integration?.isActive) {
    return { success: false, synced: 0, failed: 0, errors: ['Xero integration not active'] };
  }

  // Get invoices that need syncing
  // For now, return a placeholder - actual implementation requires Xero API calls
  console.log('[Xero] Would sync invoices for org:', organizationId);

  return {
    success: false,
    synced: 0,
    failed: 0,
    errors: ['Xero invoice sync requires API implementation'],
  };
}
