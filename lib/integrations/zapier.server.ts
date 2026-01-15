/**
 * Zapier Integration
 *
 * Provides webhook-based integration with Zapier for automating workflows.
 * Unlike OAuth integrations, Zapier uses webhooks that DiveStreams sends to.
 *
 * How it works:
 * 1. User connects Zapier integration in DiveStreams
 * 2. DiveStreams generates a unique webhook URL for the tenant
 * 3. User copies this URL into their Zapier trigger
 * 4. DiveStreams sends events to Zapier when triggers occur
 *
 * Configuration stored in integrations table:
 * - accessToken: Webhook secret for validation (generated)
 * - settings.webhookUrl: The Zapier webhook URL provided by user (optional)
 * - settings.enabledTriggers: Which triggers to send
 */

import { randomBytes } from "crypto";
import {
  connectIntegration,
  getIntegration,
  updateIntegrationSettings,
  updateLastSync,
  logSyncOperation,
  type Integration,
} from "./index.server";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available Zapier triggers that DiveStreams can send
 */
export const ZAPIER_TRIGGERS = [
  "booking.created",
  "booking.updated",
  "booking.cancelled",
  "customer.created",
  "customer.updated",
  "payment.received",
  "payment.refunded",
  "trip.completed",
  "trip.created",
] as const;

export type ZapierTriggerType = (typeof ZAPIER_TRIGGERS)[number];

/**
 * Human-readable descriptions for each trigger
 */
export const ZAPIER_TRIGGER_DESCRIPTIONS: Record<ZapierTriggerType, string> = {
  "booking.created": "Triggered when a new booking is created",
  "booking.updated": "Triggered when a booking is modified",
  "booking.cancelled": "Triggered when a booking is cancelled",
  "customer.created": "Triggered when a new customer is added",
  "customer.updated": "Triggered when customer details are updated",
  "payment.received": "Triggered when a payment is received",
  "payment.refunded": "Triggered when a payment is refunded",
  "trip.completed": "Triggered when a trip is marked as completed",
  "trip.created": "Triggered when a new trip is created",
};

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Settings for Zapier integration
 */
export interface ZapierSettings {
  webhookUrl?: string; // User's Zapier webhook URL (for catch hook)
  enabledTriggers: ZapierTriggerType[];
  webhookSecret: string; // Secret for validating incoming requests
}

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  return `zap_${randomBytes(24).toString("hex")}`;
}

/**
 * Generate the DiveStreams webhook URL for Zapier
 * This is the URL that Zapier will call when setting up instant triggers
 */
export function getZapierWebhookUrl(orgSlug: string): string {
  const baseUrl = process.env.APP_URL || "https://divestreams.com";
  return `${baseUrl}/api/webhooks/zapier/${orgSlug}`;
}

/**
 * Connect Zapier integration
 *
 * Creates a new Zapier integration with a generated webhook secret.
 * The user can optionally provide their Zapier webhook URL.
 */
export async function connectZapier(
  orgId: string,
  options?: {
    webhookUrl?: string;
    enabledTriggers?: ZapierTriggerType[];
  }
): Promise<{ success: boolean; error?: string; integration?: Integration; webhookSecret?: string }> {
  // Generate a new webhook secret
  const webhookSecret = generateWebhookSecret();

  // Default to all triggers enabled
  const enabledTriggers = options?.enabledTriggers || [...ZAPIER_TRIGGERS];

  try {
    // Store the integration
    const integration = await connectIntegration(
      orgId,
      "zapier",
      {
        accessToken: webhookSecret, // Store secret as access token (encrypted)
      },
      {
        accountName: "Zapier Integration",
      },
      {
        webhookUrl: options?.webhookUrl || null,
        enabledTriggers,
        webhookSecret, // Also store in settings for easy access
      }
    );

    return { success: true, integration, webhookSecret };
  } catch (error) {
    console.error("Error connecting Zapier:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect Zapier",
    };
  }
}

/**
 * Update Zapier settings
 */
export async function updateZapierSettings(
  orgId: string,
  settings: Partial<{
    webhookUrl: string | null;
    enabledTriggers: ZapierTriggerType[];
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateIntegrationSettings(orgId, "zapier", settings);
    return { success: true };
  } catch (error) {
    console.error("Error updating Zapier settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

/**
 * Regenerate Zapier webhook secret
 */
export async function regenerateZapierSecret(
  orgId: string
): Promise<{ success: boolean; error?: string; newSecret?: string }> {
  const newSecret = generateWebhookSecret();

  try {
    const integration = await getIntegration(orgId, "zapier");
    if (!integration) {
      return { success: false, error: "Zapier not connected" };
    }

    await updateIntegrationSettings(orgId, "zapier", {
      ...integration.settings,
      webhookSecret: newSecret,
    });

    // Also update the access token
    await connectIntegration(
      orgId,
      "zapier",
      { accessToken: newSecret },
      undefined,
      undefined
    );

    return { success: true, newSecret };
  } catch (error) {
    console.error("Error regenerating Zapier secret:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to regenerate secret",
    };
  }
}

/**
 * Get Zapier integration details for an organization
 */
export async function getZapierIntegration(orgId: string): Promise<{
  integration: Integration;
  settings: ZapierSettings;
} | null> {
  const integration = await getIntegration(orgId, "zapier");

  if (!integration || !integration.isActive) {
    return null;
  }

  const settings = integration.settings as unknown as ZapierSettings | null;

  if (!settings) {
    return null;
  }

  return {
    integration,
    settings: {
      webhookUrl: settings.webhookUrl || undefined,
      enabledTriggers: settings.enabledTriggers || [...ZAPIER_TRIGGERS],
      webhookSecret: settings.webhookSecret || "",
    },
  };
}

// ============================================================================
// WEBHOOK TRIGGER FUNCTIONS
// ============================================================================

/**
 * Result of sending a trigger to Zapier
 */
export interface ZapierTriggerResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Send a trigger event to Zapier
 *
 * This function is called when an event occurs that Zapier should be notified about.
 * It checks if:
 * 1. Zapier is connected
 * 2. The trigger is enabled
 * 3. A webhook URL is configured
 *
 * @param orgId - Organization ID
 * @param trigger - The trigger type
 * @param data - Event data to send
 */
export async function sendZapierTrigger(
  orgId: string,
  trigger: ZapierTriggerType,
  data: Record<string, unknown>
): Promise<ZapierTriggerResult> {
  const zapier = await getZapierIntegration(orgId);

  if (!zapier) {
    return { success: false, error: "Zapier not connected" };
  }

  const { integration, settings } = zapier;

  // Check if this trigger is enabled
  if (!settings.enabledTriggers.includes(trigger)) {
    return { success: false, error: "Trigger not enabled" };
  }

  // Check if a webhook URL is configured
  if (!settings.webhookUrl) {
    return { success: false, error: "No webhook URL configured" };
  }

  // Build the payload
  const payload = {
    event: trigger,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiveStreams-Event": trigger,
        "X-DiveStreams-Timestamp": payload.timestamp,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      await logSyncOperation(integration.id, "zapier_trigger", "failed", {
        entityType: "trigger",
        error: `HTTP ${response.status}: ${errorText}`,
        request: { trigger, dataKeys: Object.keys(data) },
      });

      return {
        success: false,
        error: `Zapier returned HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    await logSyncOperation(integration.id, "zapier_trigger", "success", {
      entityType: "trigger",
      request: { trigger, dataKeys: Object.keys(data) },
    });

    await updateLastSync(integration.id);

    return { success: true, statusCode: response.status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";

    await logSyncOperation(integration.id, "zapier_trigger", "failed", {
      entityType: "trigger",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Test the Zapier webhook connection
 *
 * Sends a test payload to the configured webhook URL.
 */
export async function testZapierWebhook(
  orgId: string
): Promise<ZapierTriggerResult> {
  const zapier = await getZapierIntegration(orgId);

  if (!zapier) {
    return { success: false, error: "Zapier not connected" };
  }

  const { settings } = zapier;

  if (!settings.webhookUrl) {
    return { success: false, error: "No webhook URL configured" };
  }

  // Send test payload
  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook from DiveStreams",
      organization: orgId,
      test: true,
    },
  };

  try {
    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiveStreams-Event": "test",
        "X-DiveStreams-Timestamp": testPayload.timestamp,
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook returned HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    return { success: true, statusCode: response.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate a Zapier webhook URL
 */
export function isValidZapierWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Zapier webhooks are typically on hooks.zapier.com
    // But we allow any HTTPS URL for flexibility
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Format sample data for a trigger type
 * Used for documentation and Zapier setup
 */
export function getSampleTriggerData(trigger: ZapierTriggerType): Record<string, unknown> {
  switch (trigger) {
    case "booking.created":
    case "booking.updated":
    case "booking.cancelled":
      return {
        bookingId: "bk_abc123",
        bookingNumber: "BK-2024-001",
        status: trigger === "booking.cancelled" ? "cancelled" : "confirmed",
        tripName: "Morning Dive Trip",
        tripDate: "2024-03-15",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        participants: 2,
        totalAmount: 150.0,
        currency: "USD",
      };
    case "customer.created":
    case "customer.updated":
      return {
        customerId: "cust_xyz789",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        totalBookings: 5,
        lifetimeValue: 750.0,
      };
    case "payment.received":
    case "payment.refunded":
      return {
        paymentId: "pay_def456",
        amount: 150.0,
        currency: "USD",
        status: trigger === "payment.refunded" ? "refunded" : "succeeded",
        bookingNumber: "BK-2024-001",
        customerEmail: "john@example.com",
        paymentMethod: "card",
      };
    case "trip.completed":
    case "trip.created":
      return {
        tripId: "trip_ghi012",
        tripName: "Morning Dive Trip",
        date: "2024-03-15",
        startTime: "08:00",
        endTime: "12:00",
        capacity: 12,
        bookedSpots: 8,
        status: trigger === "trip.completed" ? "completed" : "scheduled",
      };
    default:
      return {};
  }
}
