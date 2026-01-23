/**
 * QuickBooks Integration
 *
 * Provides OAuth authentication and accounting sync functionality.
 * Supports syncing invoices, payments, and customers between DiveStreams and QuickBooks.
 *
 * Environment variables required:
 * - QUICKBOOKS_CLIENT_ID: OAuth 2.0 client ID from Intuit Developer Portal
 * - QUICKBOOKS_CLIENT_SECRET: OAuth 2.0 client secret
 * - APP_URL: Base URL for OAuth callback (e.g., https://divestreams.com)
 *
 * QuickBooks OAuth Details:
 * - Authorization URL: https://appcenter.intuit.com/connect/oauth2
 * - Token URL: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 * - Scopes: com.intuit.quickbooks.accounting
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
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { bookings, customers } from "../db/schema";

// ============================================================================
// CONSTANTS
// ============================================================================

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE_SANDBOX = "https://sandbox-quickbooks.api.intuit.com/v3";
const QUICKBOOKS_API_BASE_PRODUCTION = "https://quickbooks.api.intuit.com/v3";

/**
 * Scopes required for QuickBooks integration
 */
const SCOPES = "com.intuit.quickbooks.accounting openid profile email";

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Get QuickBooks OAuth client credentials from tenant settings or environment
 */
function getQuickBooksCredentials(
  tenantClientId?: string,
  tenantClientSecret?: string
) {
  const clientId = tenantClientId || process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = tenantClientSecret || process.env.QUICKBOOKS_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const useSandbox = process.env.QUICKBOOKS_SANDBOX === "true";

  if (!clientId || !clientSecret) {
    throw new Error(
      "QuickBooks OAuth credentials not configured. Please add your OAuth app credentials in Settings → Integrations."
    );
  }

  return { clientId, clientSecret, appUrl, useSandbox };
}

/**
 * Get the QuickBooks API base URL based on environment
 */
export function getQuickBooksApiBase(useSandbox = false): string {
  return useSandbox ? QUICKBOOKS_API_BASE_SANDBOX : QUICKBOOKS_API_BASE_PRODUCTION;
}

/**
 * Build the callback URL for a specific organization
 */
function getCallbackUrl(subdomain?: string): string {
  const { appUrl } = getQuickBooksCredentials();
  // For tenant-specific callback, use subdomain
  if (subdomain) {
    const url = new URL(appUrl);
    return `${url.protocol}//${subdomain}.${url.host}/api/integrations/quickbooks/callback`;
  }
  return `${appUrl}/api/integrations/quickbooks/callback`;
}

/**
 * Generate the QuickBooks OAuth authorization URL
 *
 * @param orgId - Organization ID to include in state
 * @param subdomain - Organization subdomain for callback URL
 * @param tenantClientId - Optional tenant-specific client ID
 * @param tenantClientSecret - Optional tenant-specific client secret
 * @returns URL to redirect the user to
 */
export function getQuickBooksAuthUrl(
  orgId: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): string {
  const { clientId } = getQuickBooksCredentials(tenantClientId, tenantClientSecret);
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

  return `${QUICKBOOKS_AUTH_URL}?${params.toString()}`;
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
  realmId: string;
}> {
  const { clientId, clientSecret } = getQuickBooksCredentials(tenantClientId, tenantClientSecret);
  const callbackUrl = getCallbackUrl(subdomain);

  // QuickBooks uses Basic auth for token exchange
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("QuickBooks token exchange failed:", error);
    throw new Error("Failed to exchange authorization code for tokens");
  }

  const data = await response.json();

  // The realmId (company ID) is passed in the original callback URL, not the token response
  // We'll need to extract it from the URL during callback handling
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    realmId: "", // Will be set from callback URL
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
  const { clientId, clientSecret } = getQuickBooksCredentials(tenantClientId, tenantClientSecret);
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("QuickBooks token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // QuickBooks returns a new refresh token
    expiresIn: data.expires_in,
  };
}

/**
 * Get company info from QuickBooks
 */
export async function getCompanyInfo(
  accessToken: string,
  realmId: string,
  useSandbox = false
): Promise<{
  id: string;
  companyName: string;
  email?: string;
}> {
  const apiBase = getQuickBooksApiBase(useSandbox);
  const response = await fetch(
    `${apiBase}/company/${realmId}/companyinfo/${realmId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get QuickBooks company info");
  }

  const data = await response.json();
  const companyInfo = data.CompanyInfo;

  return {
    id: companyInfo.Id,
    companyName: companyInfo.CompanyName,
    email: companyInfo.Email?.Address,
  };
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Complete OAuth flow and connect QuickBooks
 */
export async function handleQuickBooksCallback(
  code: string,
  realmId: string,
  orgId: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): Promise<Integration> {
  // If tenant credentials not provided, try to retrieve from existing integration settings
  let clientId = tenantClientId;
  let clientSecret = tenantClientSecret;

  if (!clientId || !clientSecret) {
    const existing = await getIntegrationWithTokens(orgId, "quickbooks");
    if (existing) {
      const existingSettings = existing.integration.settings as { oauthClientId?: string; oauthClientSecret?: string } | null;
      clientId = existingSettings?.oauthClientId;
      clientSecret = existingSettings?.oauthClientSecret;
    }
  }

  const { useSandbox } = getQuickBooksCredentials(clientId, clientSecret);

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, subdomain, clientId, clientSecret);

  // Get company info for display
  const companyInfo = await getCompanyInfo(tokens.accessToken, realmId, useSandbox);

  // Calculate token expiry time
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  // Store the integration with tenant OAuth credentials
  const settings: Record<string, unknown> = {
    realmId,
    companyId: companyInfo.id,
    useSandbox,
    syncInvoices: true,
    syncPayments: true,
    syncCustomers: true,
  };

  // Store tenant OAuth credentials if provided
  if (clientId && clientSecret) {
    settings.oauthClientId = clientId;
    settings.oauthClientSecret = clientSecret;
  }

  return connectIntegration(
    orgId,
    "quickbooks",
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scopes: SCOPES,
    },
    {
      accountId: realmId,
      accountName: companyInfo.companyName,
      accountEmail: companyInfo.email,
    },
    settings
  );
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(
  orgId: string
): Promise<{ accessToken: string; integration: Integration; realmId: string } | null> {
  const result = await getIntegrationWithTokens(orgId, "quickbooks");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;
  const settings = integration.settings as { realmId?: string } | null;
  const realmId = settings?.realmId;

  if (!realmId) {
    return null;
  }

  // Check if token needs refresh
  if (tokenNeedsRefresh(integration) && refreshToken) {
    try {
      // Get tenant OAuth credentials from settings if available
      const allSettings = integration.settings as {
        realmId?: string;
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

      return { accessToken: refreshed.accessToken, integration, realmId };
    } catch (error) {
      console.error("Failed to refresh QuickBooks token:", error);
      await updateLastSync(integration.id, "Token refresh failed");
      return null;
    }
  }

  return { accessToken, integration, realmId };
}

// ============================================================================
// QUICKBOOKS API HELPERS
// ============================================================================

/**
 * Make an authenticated API request to QuickBooks
 */
async function quickBooksRequest<T>(
  orgId: string,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "QuickBooks not connected" };
  }

  const { accessToken, integration, realmId } = auth;
  const settings = integration.settings as { useSandbox?: boolean } | null;
  const apiBase = getQuickBooksApiBase(settings?.useSandbox);

  try {
    const response = await fetch(`${apiBase}/company/${realmId}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.Fault?.Error?.[0]?.Message || "API request failed";
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// CUSTOMER SYNC
// ============================================================================

/**
 * QuickBooks Customer object
 */
interface QBCustomer {
  Id?: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
}

/**
 * Find a QuickBooks customer by email
 */
export async function findQuickBooksCustomer(
  orgId: string,
  email: string
): Promise<QBCustomer | null> {
  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`;
  const result = await quickBooksRequest<{
    QueryResponse: { Customer?: QBCustomer[] };
  }>(orgId, `/query?query=${encodeURIComponent(query)}`);

  if (!result.success) {
    return null;
  }

  return result.data.QueryResponse.Customer?.[0] || null;
}

/**
 * Create a customer in QuickBooks
 */
export async function createQuickBooksCustomer(
  orgId: string,
  customer: {
    name: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }
): Promise<{ success: boolean; customerId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "QuickBooks not connected" };
  }

  const qbCustomer: QBCustomer = {
    DisplayName: customer.name,
    GivenName: customer.firstName,
    FamilyName: customer.lastName,
    ...(customer.email ? { PrimaryEmailAddr: { Address: customer.email } } : {}),
    ...(customer.phone ? { PrimaryPhone: { FreeFormNumber: customer.phone } } : {}),
    ...(customer.address
      ? {
          BillAddr: {
            Line1: customer.address.line1,
            City: customer.address.city,
            CountrySubDivisionCode: customer.address.state,
            PostalCode: customer.address.postalCode,
            Country: customer.address.country,
          },
        }
      : {}),
  };

  const result = await quickBooksRequest<{ Customer: QBCustomer }>(
    orgId,
    "/customer",
    "POST",
    qbCustomer
  );

  if (!result.success) {
    await logSyncOperation(auth.integration.id, "create_customer", "failed", {
      entityType: "customer",
      error: result.error,
    });
    return { success: false, error: result.error };
  }

  await logSyncOperation(auth.integration.id, "create_customer", "success", {
    entityType: "customer",
    externalId: result.data.Customer.Id,
  });

  return { success: true, customerId: result.data.Customer.Id };
}

// ============================================================================
// INVOICE SYNC
// ============================================================================

/**
 * QuickBooks Invoice Line Item
 */
interface QBInvoiceLine {
  DetailType: "SalesItemLineDetail";
  Amount: number;
  Description?: string;
  SalesItemLineDetail: {
    ItemRef?: { value: string; name: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

/**
 * QuickBooks Invoice object
 */
interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: { value: string };
  Line: QBInvoiceLine[];
  DueDate?: string;
  TxnDate?: string;
  EmailStatus?: string;
  BillEmail?: { Address: string };
  PrivateNote?: string;
}

/**
 * Create an invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  orgId: string,
  invoice: {
    customerId: string;
    customerEmail?: string;
    lines: Array<{
      description: string;
      amount: number;
      quantity?: number;
      unitPrice?: number;
    }>;
    dueDate?: string;
    invoiceDate?: string;
    invoiceNumber?: string;
    notes?: string;
  }
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "QuickBooks not connected" };
  }

  const qbInvoice: QBInvoice = {
    CustomerRef: { value: invoice.customerId },
    DocNumber: invoice.invoiceNumber,
    TxnDate: invoice.invoiceDate,
    DueDate: invoice.dueDate,
    PrivateNote: invoice.notes,
    ...(invoice.customerEmail
      ? { BillEmail: { Address: invoice.customerEmail }, EmailStatus: "NeedToSend" }
      : {}),
    Line: invoice.lines.map((line) => ({
      DetailType: "SalesItemLineDetail" as const,
      Amount: line.amount,
      Description: line.description,
      SalesItemLineDetail: {
        Qty: line.quantity || 1,
        UnitPrice: line.unitPrice || line.amount,
      },
    })),
  };

  const result = await quickBooksRequest<{ Invoice: QBInvoice }>(
    orgId,
    "/invoice",
    "POST",
    qbInvoice
  );

  if (!result.success) {
    await logSyncOperation(auth.integration.id, "create_invoice", "failed", {
      entityType: "invoice",
      error: result.error,
    });
    return { success: false, error: result.error };
  }

  await logSyncOperation(auth.integration.id, "create_invoice", "success", {
    entityType: "invoice",
    externalId: result.data.Invoice.Id,
  });

  await updateLastSync(auth.integration.id);

  return { success: true, invoiceId: result.data.Invoice.Id };
}

// ============================================================================
// PAYMENT SYNC
// ============================================================================

/**
 * QuickBooks Payment object
 */
interface QBPayment {
  Id?: string;
  CustomerRef: { value: string };
  TotalAmt: number;
  TxnDate?: string;
  PaymentMethodRef?: { value: string };
  DepositToAccountRef?: { value: string };
  Line?: Array<{
    Amount: number;
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>;
  }>;
}

/**
 * Record a payment in QuickBooks
 */
export async function createQuickBooksPayment(
  orgId: string,
  payment: {
    customerId: string;
    amount: number;
    paymentDate?: string;
    invoiceId?: string;
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "QuickBooks not connected" };
  }

  const qbPayment: QBPayment = {
    CustomerRef: { value: payment.customerId },
    TotalAmt: payment.amount,
    TxnDate: payment.paymentDate,
    ...(payment.invoiceId
      ? {
          Line: [
            {
              Amount: payment.amount,
              LinkedTxn: [{ TxnId: payment.invoiceId, TxnType: "Invoice" }],
            },
          ],
        }
      : {}),
  };

  const result = await quickBooksRequest<{ Payment: QBPayment }>(
    orgId,
    "/payment",
    "POST",
    qbPayment
  );

  if (!result.success) {
    await logSyncOperation(auth.integration.id, "create_payment", "failed", {
      entityType: "payment",
      error: result.error,
    });
    return { success: false, error: result.error };
  }

  await logSyncOperation(auth.integration.id, "create_payment", "success", {
    entityType: "payment",
    externalId: result.data.Payment.Id,
  });

  await updateLastSync(auth.integration.id);

  return { success: true, paymentId: result.data.Payment.Id };
}

// ============================================================================
// ACCOUNT/ITEM QUERIES
// ============================================================================

/**
 * List QuickBooks accounts (for mapping)
 */
export async function listQuickBooksAccounts(
  orgId: string
): Promise<Array<{ id: string; name: string; type: string }> | null> {
  const query = "SELECT Id, Name, AccountType FROM Account WHERE Active = true";
  const result = await quickBooksRequest<{
    QueryResponse: { Account?: Array<{ Id: string; Name: string; AccountType: string }> };
  }>(orgId, `/query?query=${encodeURIComponent(query)}`);

  if (!result.success) {
    return null;
  }

  return (
    result.data.QueryResponse.Account?.map((acc) => ({
      id: acc.Id,
      name: acc.Name,
      type: acc.AccountType,
    })) || []
  );
}

/**
 * List QuickBooks items (products/services)
 */
export async function listQuickBooksItems(
  orgId: string
): Promise<Array<{ id: string; name: string; type: string; unitPrice?: number }> | null> {
  const query = "SELECT Id, Name, Type, UnitPrice FROM Item WHERE Active = true";
  const result = await quickBooksRequest<{
    QueryResponse: {
      Item?: Array<{ Id: string; Name: string; Type: string; UnitPrice?: number }>;
    };
  }>(orgId, `/query?query=${encodeURIComponent(query)}`);

  if (!result.success) {
    return null;
  }

  return (
    result.data.QueryResponse.Item?.map((item) => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      unitPrice: item.UnitPrice,
    })) || []
  );
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Sync a booking to QuickBooks as an invoice
 */
export async function syncBookingToQuickBooks(
  orgId: string,
  bookingId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "QuickBooks not connected" };
  }

  // Get booking details
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.organizationId, orgId), eq(bookings.id, bookingId)))
    .limit(1);

  if (!booking) {
    return { success: false, error: "Booking not found" };
  }

  // Get customer details
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, booking.customerId))
    .limit(1);

  if (!customer) {
    return { success: false, error: "Customer not found" };
  }

  // Find or create QuickBooks customer
  let qbCustomerId: string | undefined;

  if (customer.email) {
    const existingCustomer = await findQuickBooksCustomer(orgId, customer.email);
    if (existingCustomer?.Id) {
      qbCustomerId = existingCustomer.Id;
    }
  }

  if (!qbCustomerId) {
    const customerName = `${customer.firstName} ${customer.lastName}`.trim();
    const createResult = await createQuickBooksCustomer(orgId, {
      name: customerName,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      firstName: customer.firstName,
      lastName: customer.lastName,
    });

    if (!createResult.success || !createResult.customerId) {
      return { success: false, error: `Failed to create customer: ${createResult.error}` };
    }

    qbCustomerId = createResult.customerId;
  }

  // Create invoice
  const totalAmount = parseFloat(booking.total || "0");
  const result = await createQuickBooksInvoice(orgId, {
    customerId: qbCustomerId,
    customerEmail: customer.email || undefined,
    lines: [
      {
        description: `Booking #${booking.bookingNumber} - ${booking.specialRequests || "Dive Trip"}`,
        amount: totalAmount,
        quantity: booking.participants || 1,
        unitPrice: totalAmount / (booking.participants || 1),
      },
    ],
    invoiceNumber: booking.bookingNumber,
    invoiceDate: new Date().toISOString().split("T")[0],
    notes: booking.internalNotes || undefined,
  });

  if (result.success) {
    await logSyncOperation(auth.integration.id, "sync_booking", "success", {
      entityType: "booking",
      entityId: bookingId,
      externalId: result.invoiceId,
    });
  }

  return result;
}

/**
 * Get QuickBooks connection status and company info
 */
export async function getQuickBooksStatus(
  orgId: string
): Promise<{
  connected: boolean;
  companyName?: string;
  realmId?: string;
  useSandbox?: boolean;
} | null> {
  const result = await getIntegrationWithTokens(orgId, "quickbooks");

  if (!result) {
    return { connected: false };
  }

  const { integration } = result;
  const settings = integration.settings as {
    realmId?: string;
    useSandbox?: boolean;
  } | null;

  return {
    connected: true,
    companyName: integration.accountName || undefined,
    realmId: settings?.realmId,
    useSandbox: settings?.useSandbox,
  };
}

// ============================================================================
// Sync Functions
// ============================================================================

export interface QuickBooksSyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors?: string[];
}

/**
 * Sync data to QuickBooks
 */
export async function syncToQuickBooks(organizationId: string): Promise<QuickBooksSyncResult> {
  const integration = await getIntegration(organizationId, 'quickbooks');
  if (!integration?.isActive) {
    return { success: false, synced: 0, failed: 0, errors: ['QuickBooks integration not active'] };
  }

  // Sync customers, invoices, and payments to QuickBooks
  // For now, return a placeholder - actual implementation requires QuickBooks API calls
  console.log('[QuickBooks] Would sync data for org:', organizationId);

  return {
    success: false,
    synced: 0,
    failed: 0,
    errors: ['QuickBooks sync requires API implementation'],
  };
}
