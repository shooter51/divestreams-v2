/**
 * Stripe Integration for Payment Processing
 *
 * Provides payment processing functionality using Stripe's API.
 * Supports connecting Stripe accounts, managing webhooks, and processing payments.
 *
 * Configuration stored in integrations table:
 * - accessToken: Stripe Secret Key (encrypted)
 * - refreshToken: Stripe Publishable Key (encrypted)
 * - accountId: Stripe Account ID
 * - settings.liveMode: Whether using live or test mode
 * - settings.webhookSecret: Webhook signing secret
 * - settings.webhookEndpointId: Stripe webhook endpoint ID
 */

import Stripe from "stripe";
import crypto from "crypto";
import {
  connectIntegration,
  getIntegrationWithTokens,
  getIntegration,
  updateIntegrationSettings,
  updateLastSync,
  logSyncOperation,
  type Integration,
} from "./index.server";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Credentials for Stripe API
 */
export interface StripeCredentials {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
}

/**
 * Stripe account information
 */
export interface StripeAccountInfo {
  accountId: string;
  businessName: string | null;
  email: string | null;
  liveMode: boolean;
  country: string | null;
  defaultCurrency: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/**
 * Stripe subscription information
 */
export interface StripeSubscriptionInfo {
  id: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  planName: string | null;
  planAmount: number | null;
  planCurrency: string | null;
  planInterval: string | null;
}

/**
 * Stripe payment method information
 */
export interface StripePaymentMethodInfo {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect Stripe integration with API credentials
 *
 * Validates the credentials by making a test API call to retrieve account info.
 */
export async function connectStripe(
  orgId: string,
  credentials: StripeCredentials
): Promise<{ success: boolean; error?: string; integration?: Integration; accountInfo?: StripeAccountInfo }> {
  // Validate credentials by making a test API call
  const validation = await validateStripeCredentials(credentials.secretKey);

  if (!validation.valid || !validation.accountInfo) {
    return { success: false, error: validation.error };
  }

  const accountInfo = validation.accountInfo;

  // Store the integration
  // We use accessToken for Secret Key and refreshToken for Publishable Key
  const integration = await connectIntegration(
    orgId,
    "stripe",
    {
      accessToken: credentials.secretKey,
      refreshToken: credentials.publishableKey,
    },
    {
      accountId: accountInfo.accountId,
      accountName: accountInfo.businessName || `Stripe (${accountInfo.accountId.slice(-8)})`,
      accountEmail: accountInfo.email ?? undefined,
    },
    {
      liveMode: accountInfo.liveMode,
      webhookSecret: credentials.webhookSecret,
      country: accountInfo.country,
      defaultCurrency: accountInfo.defaultCurrency,
      chargesEnabled: accountInfo.chargesEnabled,
      payoutsEnabled: accountInfo.payoutsEnabled,
    }
  );

  return { success: true, integration, accountInfo };
}

/**
 * Validate Stripe credentials by fetching account info
 */
async function validateStripeCredentials(
  secretKey: string
): Promise<{ valid: boolean; error?: string; accountInfo?: StripeAccountInfo }> {
  try {
    const stripe = new Stripe(secretKey);

    // Retrieve account information
    const account = await stripe.accounts.retrieve();

    return {
      valid: true,
      accountInfo: {
        accountId: account.id,
        businessName: account.business_profile?.name || null,
        email: account.email || null,
        liveMode: !secretKey.startsWith("sk_test_"),
        country: account.country || null,
        defaultCurrency: account.default_currency || null,
        chargesEnabled: account.charges_enabled ?? true,
        payoutsEnabled: account.payouts_enabled ?? true,
      },
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      return { valid: false, error: "Invalid API key" };
    }
    if (error instanceof Stripe.errors.StripePermissionError) {
      return { valid: false, error: "Insufficient permissions" };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to validate Stripe credentials",
    };
  }
}

/**
 * Get Stripe client for an organization
 */
async function getStripeClient(orgId: string): Promise<{
  stripe: Stripe;
  integration: Integration;
  publishableKey: string;
} | null> {
  const result = await getIntegrationWithTokens(orgId, "stripe");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;

  if (!accessToken) {
    return null;
  }

  return {
    stripe: new Stripe(accessToken),
    integration,
    publishableKey: refreshToken || "",
  };
}

// ============================================================================
// ACCOUNT INFORMATION
// ============================================================================

/**
 * Get Stripe account information
 */
export async function getStripeAccountInfo(
  orgId: string
): Promise<StripeAccountInfo | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const account = await stripe.accounts.retrieve();
    const settings = integration.settings as Record<string, unknown> | null;

    await updateLastSync(integration.id);

    return {
      accountId: account.id,
      businessName: account.business_profile?.name || null,
      email: account.email || null,
      liveMode: (settings?.liveMode as boolean) ?? !account.id.includes("test"),
      country: account.country || null,
      defaultCurrency: account.default_currency || null,
      chargesEnabled: account.charges_enabled ?? true,
      payoutsEnabled: account.payouts_enabled ?? true,
    };
  } catch (error) {
    await logSyncOperation(integration.id, "get_account_info", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Get Stripe balance
 */
export async function getStripeBalance(
  orgId: string
): Promise<{ available: number; pending: number; currency: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const balance = await stripe.balance.retrieve();

    // Get the first available balance (usually in default currency)
    const available = balance.available[0];
    const pending = balance.pending[0];

    return {
      available: available?.amount ?? 0,
      pending: pending?.amount ?? 0,
      currency: available?.currency ?? "usd",
    };
  } catch (error) {
    await logSyncOperation(integration.id, "get_balance", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * List Stripe customers
 */
export async function listStripeCustomers(
  orgId: string,
  options?: { limit?: number; startingAfter?: string }
): Promise<Array<{
  id: string;
  email: string | null;
  name: string | null;
  created: Date;
}> | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const customers = await stripe.customers.list({
      limit: options?.limit ?? 10,
      starting_after: options?.startingAfter,
    });

    return customers.data.map((customer) => ({
      id: customer.id,
      email: customer.email,
      name: customer.name ?? null,
      created: new Date(customer.created * 1000),
    }));
  } catch (error) {
    await logSyncOperation(integration.id, "list_customers", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

/**
 * List payment methods for a customer
 */
export async function listPaymentMethods(
  orgId: string,
  customerId: string
): Promise<StripePaymentMethodInfo[] | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(customerId);
    let defaultPaymentMethodId: string | null = null;

    // Check if customer is not deleted and has invoice settings
    if (!("deleted" in customer && customer.deleted)) {
      const invoiceSettings = (customer as Stripe.Customer).invoice_settings;
      if (invoiceSettings?.default_payment_method) {
        defaultPaymentMethodId = typeof invoiceSettings.default_payment_method === "string"
          ? invoiceSettings.default_payment_method
          : invoiceSettings.default_payment_method.id;
      }
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      brand: pm.card?.brand || null,
      last4: pm.card?.last4 || null,
      expiryMonth: pm.card?.exp_month || null,
      expiryYear: pm.card?.exp_year || null,
      isDefault: pm.id === defaultPaymentMethodId,
    }));
  } catch (error) {
    await logSyncOperation(integration.id, "list_payment_methods", "failed", {
      entityType: "customer",
      entityId: customerId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * List subscriptions for a customer
 */
export async function listSubscriptions(
  orgId: string,
  customerId: string
): Promise<StripeSubscriptionInfo[] | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

    return subscriptions.data.map((sub) => {
      const item = sub.items.data[0];
      const price = item?.price;

      // Access current_period_end properly - it's a Unix timestamp
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: periodEnd
          ? new Date(periodEnd * 1000)
          : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        planName: price?.nickname || null,
        planAmount: price?.unit_amount || null,
        planCurrency: price?.currency || null,
        planInterval: price?.recurring?.interval || null,
      };
    });
  } catch (error) {
    await logSyncOperation(integration.id, "list_subscriptions", "failed", {
      entityType: "customer",
      entityId: customerId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

// ============================================================================
// WEBHOOK MANAGEMENT
// ============================================================================

/**
 * Create a webhook endpoint in Stripe
 */
export async function createStripeWebhook(
  orgId: string,
  webhookUrl: string,
  events: string[]
): Promise<{ success: boolean; error?: string; webhookSecret?: string; endpointId?: string }> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return { success: false, error: "Stripe not connected" };
  }

  const { stripe, integration } = client;

  try {
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
      description: `DiveStreams webhook for ${integration.accountName || "organization"}`,
    });

    // Update integration settings with webhook info
    await updateIntegrationSettings(orgId, "stripe", {
      webhookEndpointId: endpoint.id,
      webhookSecret: endpoint.secret,
      webhookUrl: webhookUrl,
      webhookEvents: events,
    });

    await logSyncOperation(integration.id, "create_webhook", "success", {
      entityType: "webhook",
      externalId: endpoint.id,
    });

    return {
      success: true,
      webhookSecret: endpoint.secret,
      endpointId: endpoint.id,
    };
  } catch (error) {
    await logSyncOperation(integration.id, "create_webhook", "failed", {
      entityType: "webhook",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create webhook",
    };
  }
}

/**
 * List webhook endpoints
 */
export async function listStripeWebhooks(
  orgId: string
): Promise<Array<{
  id: string;
  url: string;
  status: string;
  enabledEvents: string[];
}> | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });

    return webhooks.data.map((wh) => ({
      id: wh.id,
      url: wh.url,
      status: wh.status,
      enabledEvents: wh.enabled_events as string[],
    }));
  } catch (error) {
    await logSyncOperation(integration.id, "list_webhooks", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Delete a webhook endpoint
 */
export async function deleteStripeWebhook(
  orgId: string,
  webhookEndpointId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return { success: false, error: "Stripe not connected" };
  }

  const { stripe, integration } = client;

  try {
    await stripe.webhookEndpoints.del(webhookEndpointId);

    // Clear webhook settings if this was our webhook
    const settings = integration.settings as Record<string, unknown> | null;
    if (settings?.webhookEndpointId === webhookEndpointId) {
      await updateIntegrationSettings(orgId, "stripe", {
        webhookEndpointId: null,
        webhookSecret: null,
        webhookUrl: null,
        webhookEvents: null,
      });
    }

    await logSyncOperation(integration.id, "delete_webhook", "success", {
      entityType: "webhook",
      externalId: webhookEndpointId,
    });

    return { success: true };
  } catch (error) {
    await logSyncOperation(integration.id, "delete_webhook", "failed", {
      entityType: "webhook",
      externalId: webhookEndpointId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete webhook",
    };
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Update Stripe integration settings
 */
export async function updateStripeSettings(
  orgId: string,
  settings: {
    liveMode?: boolean;
    webhookSecret?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateIntegrationSettings(orgId, "stripe", settings);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

/**
 * Get Stripe settings for display
 */
export async function getStripeSettings(
  orgId: string
): Promise<{
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
  liveMode: boolean;
  webhookConfigured: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  publishableKeyPrefix: string | null;
} | null> {
  const integration = await getIntegration(orgId, "stripe");

  if (!integration || !integration.isActive) {
    return null;
  }

  const settings = integration.settings as Record<string, unknown> | null;

  // Get the publishable key to show first few chars
  const result = await getIntegrationWithTokens(orgId, "stripe");
  const publishableKey = result?.refreshToken || null;

  // Fetch current account status from Stripe to ensure accuracy.
  // Fall back to cached settings if the Stripe API call fails (network error, outage, etc.)
  // to avoid incorrectly showing "Stripe Not Connected" when Stripe is properly configured.
  const accountInfo = await getStripeAccountInfo(orgId);

  return {
    connected: true,
    accountId: integration.accountId,
    accountName: integration.accountName,
    liveMode: (settings?.liveMode as boolean) ?? false,
    webhookConfigured: !!(settings?.webhookEndpointId || settings?.webhookSecret),
    chargesEnabled: accountInfo?.chargesEnabled ?? (settings?.chargesEnabled as boolean) ?? false,
    payoutsEnabled: accountInfo?.payoutsEnabled ?? (settings?.payoutsEnabled as boolean) ?? false,
    publishableKeyPrefix: publishableKey ? publishableKey.slice(0, 12) + "..." : null,
  };
}

// ============================================================================
// TEST MODE
// ============================================================================

/**
 * Check if Stripe is in test mode
 */
export async function isStripeTestMode(orgId: string): Promise<boolean | null> {
  const integration = await getIntegration(orgId, "stripe");

  if (!integration || !integration.isActive) {
    return null;
  }

  const settings = integration.settings as Record<string, unknown> | null;
  return !(settings?.liveMode as boolean);
}

/**
 * Get Stripe publishable key (for client-side use)
 */
export async function getStripePublishableKey(orgId: string): Promise<string | null> {
  const result = await getIntegrationWithTokens(orgId, "stripe");

  if (!result) {
    return null;
  }

  return result.refreshToken;
}

// ============================================================================
// POS PAYMENT PROCESSING
// ============================================================================

/**
 * Create a PaymentIntent for POS transactions
 *
 * Creates a PaymentIntent using the tenant's connected Stripe account.
 * Used for manual card entry in the POS system.
 */
export async function createPOSPaymentIntent(
  orgId: string,
  amount: number, // in cents
  metadata?: { customerId?: string; receiptNumber?: string; description?: string }
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    // SECURITY: Generate idempotency key to prevent double-charging on retry/timeout
    // Use receipt number if available, otherwise use timestamp
    const idempotencyBase = metadata?.receiptNumber
      ? `${orgId}-${metadata.receiptNumber}-${amount}`
      : `${orgId}-${amount}-${Date.now()}`;

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(idempotencyBase)
      .digest("hex")
      .substring(0, 50); // Stripe idempotency keys max 255 chars

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd", // Could be configurable per org
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orgId,
        source: "pos",
        ...metadata,
      },
    }, {
      idempotencyKey,
    });

    await logSyncOperation(integration.id, "create_payment_intent", "success", {
      entityType: "payment_intent",
      externalId: paymentIntent.id,
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    await logSyncOperation(integration.id, "create_payment_intent", "failed", {
      entityType: "payment_intent",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

// ============================================================================
// STRIPE TERMINAL
// ============================================================================

/**
 * Get or create a Terminal Location for the organization
 *
 * Stripe Terminal requires a location object. We create one per org.
 */
export async function getOrCreateTerminalLocation(
  orgId: string,
  locationInfo?: { displayName?: string; address?: { city?: string; country?: string; line1?: string; postalCode?: string; state?: string } }
): Promise<{ locationId: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;
  const settings = integration.settings as Record<string, unknown> | null;

  // Check if we already have a location
  if (settings?.terminalLocationId) {
    return { locationId: settings.terminalLocationId as string };
  }

  try {
    // Create a new location
    const location = await stripe.terminal.locations.create({
      display_name: locationInfo?.displayName || integration.accountName || "POS Location",
      address: {
        city: locationInfo?.address?.city || "Unknown",
        country: locationInfo?.address?.country || "US",
        line1: locationInfo?.address?.line1 || "123 Main St",
        postal_code: locationInfo?.address?.postalCode || "00000",
        state: locationInfo?.address?.state || "XX",
      },
    });

    // Save location ID to settings
    await updateIntegrationSettings(orgId, "stripe", {
      terminalLocationId: location.id,
    });

    await logSyncOperation(integration.id, "create_terminal_location", "success", {
      entityType: "terminal_location",
      externalId: location.id,
    });

    return { locationId: location.id };
  } catch (error) {
    await logSyncOperation(integration.id, "create_terminal_location", "failed", {
      entityType: "terminal_location",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Create a connection token for Stripe Terminal SDK
 *
 * The client-side Terminal SDK needs a connection token to connect to readers.
 */
export async function createTerminalConnectionToken(
  orgId: string
): Promise<{ secret: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe } = client;

  try {
    const connectionToken = await stripe.terminal.connectionTokens.create();
    return { secret: connectionToken.secret };
  } catch (error) {
    console.error("Failed to create Terminal connection token:", error);
    return null;
  }
}

/**
 * Register a Terminal reader with a registration code
 */
export async function registerTerminalReader(
  orgId: string,
  registrationCode: string,
  label?: string
): Promise<{ readerId: string; label: string; deviceType: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  // Get or create location first
  const location = await getOrCreateTerminalLocation(orgId);
  if (!location) {
    throw new Error("Could not create Terminal location");
  }

  try {
    const reader = await stripe.terminal.readers.create({
      registration_code: registrationCode,
      label: label || "POS Reader",
      location: location.locationId,
    });

    await logSyncOperation(integration.id, "register_terminal_reader", "success", {
      entityType: "terminal_reader",
      externalId: reader.id,
    });

    return {
      readerId: reader.id,
      label: reader.label || "POS Reader",
      deviceType: reader.device_type,
    };
  } catch (error) {
    await logSyncOperation(integration.id, "register_terminal_reader", "failed", {
      entityType: "terminal_reader",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * List registered Terminal readers for the organization
 */
export async function listTerminalReaders(
  orgId: string
): Promise<Array<{
  id: string;
  label: string;
  deviceType: string;
  status: string;
  ipAddress: string | null;
}> | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;
  const settings = integration.settings as Record<string, unknown> | null;
  const locationId = settings?.terminalLocationId as string | undefined;

  try {
    const readers = await stripe.terminal.readers.list({
      location: locationId,
      limit: 20,
    });

    return readers.data.map((reader) => ({
      id: reader.id,
      label: reader.label || "Unnamed Reader",
      deviceType: reader.device_type,
      status: reader.status || "unknown",
      ipAddress: reader.ip_address || null,
    }));
  } catch (error) {
    await logSyncOperation(integration.id, "list_terminal_readers", "failed", {
      entityType: "terminal_reader",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Delete a Terminal reader
 */
export async function deleteTerminalReader(
  orgId: string,
  readerId: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return { success: false, error: "Stripe not connected" };
  }

  const { stripe, integration } = client;

  try {
    await stripe.terminal.readers.del(readerId);

    await logSyncOperation(integration.id, "delete_terminal_reader", "success", {
      entityType: "terminal_reader",
      externalId: readerId,
    });

    return { success: true };
  } catch (error) {
    await logSyncOperation(integration.id, "delete_terminal_reader", "failed", {
      entityType: "terminal_reader",
      externalId: readerId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete reader",
    };
  }
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Create a refund for a PaymentIntent
 *
 * Used for processing POS refunds when original payment was made by card.
 * Can do full or partial refunds.
 */
export async function createStripeRefund(
  orgId: string,
  paymentIntentId: string,
  options?: {
    amount?: number; // Amount in cents (undefined = full refund)
    reason?: "duplicate" | "fraudulent" | "requested_by_customer";
    metadata?: Record<string, string>;
  }
): Promise<{ refundId: string; amount: number; status: string } | null> {
  const client = await getStripeClient(orgId);

  if (!client) {
    return null;
  }

  const { stripe, integration } = client;

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: options?.amount,
      reason: options?.reason,
      metadata: {
        orgId,
        source: "pos_refund",
        ...options?.metadata,
      },
    });

    await logSyncOperation(integration.id, "create_refund", "success", {
      entityType: "refund",
      externalId: refund.id,
    });

    return {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status || "pending",
    };
  } catch (error) {
    await logSyncOperation(integration.id, "create_refund", "failed", {
      entityType: "refund",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
