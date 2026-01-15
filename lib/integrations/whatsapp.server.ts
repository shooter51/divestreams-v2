/**
 * WhatsApp Business Integration
 *
 * Provides WhatsApp messaging functionality using Meta's WhatsApp Business API
 * or Twilio's WhatsApp API (simpler setup). Supports booking notifications,
 * customer support, and template-based messaging.
 *
 * Configuration stored in integrations table:
 * - accessToken: WhatsApp Business API Access Token OR Twilio Account SID
 * - refreshToken: For Twilio: Auth Token (encrypted)
 * - settings.provider: "meta" or "twilio"
 * - settings.phoneNumberId: WhatsApp Phone Number ID (Meta)
 * - settings.businessAccountId: WhatsApp Business Account ID (Meta)
 * - settings.phoneNumber: WhatsApp-enabled phone number (Twilio)
 *
 * Meta WhatsApp Business API:
 * - Requires Facebook Business verification
 * - Uses message templates for outbound (24hr window for freeform)
 * - Rate limits apply based on tier
 *
 * Twilio WhatsApp:
 * - Simpler setup via Twilio Console
 * - Uses approved templates for outbound
 * - Same rate limits as Twilio SMS
 */

import {
  connectIntegration,
  getIntegrationWithTokens,
  updateLastSync,
  logSyncOperation,
  type Integration,
} from "./index.server";

// ============================================================================
// CONSTANTS
// ============================================================================

const META_GRAPH_API_BASE = "https://graph.facebook.com/v18.0";
const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

// ============================================================================
// TYPES
// ============================================================================

/**
 * WhatsApp provider type
 */
export type WhatsAppProvider = "meta" | "twilio";

/**
 * Credentials for Meta WhatsApp Business API
 */
export interface MetaWhatsAppCredentials {
  provider: "meta";
  accessToken: string; // Permanent access token from Meta Business
  phoneNumberId: string; // WhatsApp Phone Number ID
  businessAccountId: string; // WhatsApp Business Account ID
}

/**
 * Credentials for Twilio WhatsApp
 */
export interface TwilioWhatsAppCredentials {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  phoneNumber: string; // WhatsApp-enabled Twilio number (format: whatsapp:+1234567890)
}

/**
 * Combined credentials type
 */
export type WhatsAppCredentials = MetaWhatsAppCredentials | TwilioWhatsAppCredentials;

/**
 * WhatsApp message options
 */
export interface SendWhatsAppOptions {
  to: string; // Phone number in E.164 format
  body?: string; // Message text (for session messages or Twilio)
  templateName?: string; // Meta template name
  templateLanguage?: string; // Meta template language (default: en)
  templateComponents?: TemplateComponent[]; // Meta template variables
}

/**
 * Meta template component for variable substitution
 */
export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    document?: { link: string };
    video?: { link: string };
  }>;
}

/**
 * Result of sending a WhatsApp message
 */
export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

/**
 * WhatsApp message template
 */
export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
  }>;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect WhatsApp integration with API credentials
 */
export async function connectWhatsApp(
  orgId: string,
  credentials: WhatsAppCredentials
): Promise<{ success: boolean; error?: string; integration?: Integration }> {
  if (credentials.provider === "meta") {
    return connectMetaWhatsApp(orgId, credentials);
  } else {
    return connectTwilioWhatsApp(orgId, credentials);
  }
}

/**
 * Connect Meta WhatsApp Business API
 */
async function connectMetaWhatsApp(
  orgId: string,
  credentials: MetaWhatsAppCredentials
): Promise<{ success: boolean; error?: string; integration?: Integration }> {
  // Validate credentials by checking phone number status
  const validation = await validateMetaCredentials(
    credentials.accessToken,
    credentials.phoneNumberId
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const integration = await connectIntegration(
    orgId,
    "whatsapp",
    {
      accessToken: credentials.accessToken,
    },
    {
      accountId: credentials.businessAccountId,
      accountName: validation.displayPhoneNumber || `WhatsApp (${credentials.phoneNumberId.slice(-4)})`,
    },
    {
      whatsappProvider: "meta",
      phoneNumberId: credentials.phoneNumberId,
      businessAccountId: credentials.businessAccountId,
      verifiedName: validation.verifiedName,
      qualityRating: validation.qualityRating,
    }
  );

  return { success: true, integration };
}

/**
 * Connect Twilio WhatsApp API
 */
async function connectTwilioWhatsApp(
  orgId: string,
  credentials: TwilioWhatsAppCredentials
): Promise<{ success: boolean; error?: string; integration?: Integration }> {
  // Validate credentials by fetching account info
  const validation = await validateTwilioCredentials(
    credentials.accountSid,
    credentials.authToken
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Format phone number for WhatsApp
  const whatsappNumber = credentials.phoneNumber.startsWith("whatsapp:")
    ? credentials.phoneNumber
    : `whatsapp:${credentials.phoneNumber}`;

  const integration = await connectIntegration(
    orgId,
    "whatsapp",
    {
      accessToken: credentials.accountSid,
      refreshToken: credentials.authToken,
    },
    {
      accountId: credentials.accountSid,
      accountName: validation.accountName || `Twilio WhatsApp (${credentials.accountSid.slice(-4)})`,
    },
    {
      whatsappProvider: "twilio",
      phoneNumber: whatsappNumber,
    }
  );

  return { success: true, integration };
}

/**
 * Validate Meta WhatsApp credentials
 */
async function validateMetaCredentials(
  accessToken: string,
  phoneNumberId: string
): Promise<{
  valid: boolean;
  error?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
}> {
  try {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: "Invalid access token or insufficient permissions" };
      }
      return {
        valid: false,
        error: error.error?.message || "Failed to validate WhatsApp credentials",
      };
    }

    const data = await response.json();

    return {
      valid: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Validate Twilio credentials
 */
async function validateTwilioCredentials(
  accountSid: string,
  authToken: string
): Promise<{ valid: boolean; error?: string; accountName?: string }> {
  try {
    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Account SID or Auth Token" };
      }
      return { valid: false, error: "Failed to validate Twilio credentials" };
    }

    const data = await response.json();

    if (data.status !== "active") {
      return { valid: false, error: "Twilio account is not active" };
    }

    return { valid: true, accountName: data.friendly_name };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Get WhatsApp credentials for an organization
 */
async function getWhatsAppCredentials(orgId: string): Promise<{
  provider: WhatsAppProvider;
  integration: Integration;
  // Meta fields
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  // Twilio fields
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
} | null> {
  const result = await getIntegrationWithTokens(orgId, "whatsapp");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;
  const settings = integration.settings as {
    whatsappProvider?: WhatsAppProvider;
    phoneNumberId?: string;
    businessAccountId?: string;
    phoneNumber?: string;
  } | null;

  if (!settings?.whatsappProvider) {
    return null;
  }

  if (settings.whatsappProvider === "meta") {
    if (!accessToken || !settings.phoneNumberId) {
      return null;
    }
    return {
      provider: "meta",
      integration,
      accessToken,
      phoneNumberId: settings.phoneNumberId,
      businessAccountId: settings.businessAccountId,
    };
  } else {
    if (!accessToken || !refreshToken || !settings.phoneNumber) {
      return null;
    }
    return {
      provider: "twilio",
      integration,
      accountSid: accessToken,
      authToken: refreshToken,
      phoneNumber: settings.phoneNumber,
    };
  }
}

// ============================================================================
// MESSAGING
// ============================================================================

/**
 * Send a WhatsApp message
 */
export async function sendWhatsApp(
  orgId: string,
  options: SendWhatsAppOptions
): Promise<WhatsAppResult> {
  const credentials = await getWhatsAppCredentials(orgId);

  if (!credentials) {
    return { success: false, error: "WhatsApp not connected" };
  }

  if (credentials.provider === "meta") {
    return sendMetaWhatsApp(credentials, options);
  } else {
    return sendTwilioWhatsApp(credentials, options);
  }
}

/**
 * Send WhatsApp message via Meta API
 */
async function sendMetaWhatsApp(
  credentials: {
    accessToken?: string;
    phoneNumberId?: string;
    integration: Integration;
  },
  options: SendWhatsAppOptions
): Promise<WhatsAppResult> {
  const { accessToken, phoneNumberId, integration } = credentials;

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: "Missing Meta WhatsApp credentials" };
  }

  // Normalize phone number
  const toNumber = normalizePhoneNumber(options.to);
  if (!toNumber) {
    return { success: false, error: "Invalid phone number format" };
  }

  // Build message payload
  let messagePayload: Record<string, unknown>;

  if (options.templateName) {
    // Template message (for outside 24hr window)
    messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber.replace("+", ""), // Meta API expects number without +
      type: "template",
      template: {
        name: options.templateName,
        language: { code: options.templateLanguage || "en" },
        components: options.templateComponents || [],
      },
    };
  } else if (options.body) {
    // Text message (within 24hr window)
    messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber.replace("+", ""),
      type: "text",
      text: { body: options.body },
    };
  } else {
    return { success: false, error: "Either body or templateName is required" };
  }

  try {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || "Failed to send WhatsApp message";

      await logSyncOperation(integration.id, "send_whatsapp", "failed", {
        entityType: "whatsapp",
        error: errorMessage,
        request: { to: toNumber, hasTemplate: !!options.templateName },
        response: data,
      });

      return { success: false, error: errorMessage };
    }

    const messageId = data.messages?.[0]?.id;

    await logSyncOperation(integration.id, "send_whatsapp", "success", {
      entityType: "whatsapp",
      externalId: messageId,
      request: { to: toNumber, hasTemplate: !!options.templateName },
    });

    await updateLastSync(integration.id);

    return {
      success: true,
      messageId,
      status: "sent",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";

    await logSyncOperation(integration.id, "send_whatsapp", "failed", {
      entityType: "whatsapp",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendTwilioWhatsApp(
  credentials: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    integration: Integration;
  },
  options: SendWhatsAppOptions
): Promise<WhatsAppResult> {
  const { accountSid, authToken, phoneNumber, integration } = credentials;

  if (!accountSid || !authToken || !phoneNumber) {
    return { success: false, error: "Missing Twilio WhatsApp credentials" };
  }

  // Normalize phone number
  const toNumber = normalizePhoneNumber(options.to);
  if (!toNumber) {
    return { success: false, error: "Invalid phone number format" };
  }

  // Build message params
  const params = new URLSearchParams({
    To: `whatsapp:${toNumber}`,
    From: phoneNumber, // Already in whatsapp:+xxx format
  });

  // For Twilio, we use body for regular messages or ContentSid for templates
  if (options.body) {
    params.set("Body", options.body.slice(0, 1600));
  } else if (options.templateName) {
    // Twilio uses Content Templates
    params.set("ContentSid", options.templateName);
    if (options.templateComponents && options.templateComponents.length > 0) {
      // Convert template variables to JSON
      const contentVariables: Record<string, string> = {};
      let varIndex = 1;
      for (const comp of options.templateComponents) {
        for (const param of comp.parameters) {
          if (param.type === "text" && param.text) {
            contentVariables[varIndex.toString()] = param.text;
            varIndex++;
          }
        }
      }
      params.set("ContentVariables", JSON.stringify(contentVariables));
    }
  } else {
    return { success: false, error: "Either body or templateName is required" };
  }

  try {
    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error_message || "Failed to send WhatsApp message";

      await logSyncOperation(integration.id, "send_whatsapp", "failed", {
        entityType: "whatsapp",
        error: errorMessage,
        request: { to: toNumber },
        response: data,
      });

      return { success: false, error: errorMessage };
    }

    await logSyncOperation(integration.id, "send_whatsapp", "success", {
      entityType: "whatsapp",
      externalId: data.sid,
      request: { to: toNumber },
    });

    await updateLastSync(integration.id);

    return {
      success: true,
      messageId: data.sid,
      status: data.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";

    await logSyncOperation(integration.id, "send_whatsapp", "failed", {
      entityType: "whatsapp",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// TEMPLATE MESSAGES
// ============================================================================

/**
 * Send a booking confirmation via WhatsApp
 */
export async function sendBookingConfirmationWhatsApp(
  orgId: string,
  customerPhone: string,
  bookingDetails: {
    bookingNumber: string;
    tourName: string;
    date: string;
    time: string;
    participants: number;
  }
): Promise<WhatsAppResult> {
  const credentials = await getWhatsAppCredentials(orgId);

  if (!credentials) {
    return { success: false, error: "WhatsApp not connected" };
  }

  // For Meta, try to use a template; for Twilio or session messages, use text
  const body = `Your booking ${bookingDetails.bookingNumber} is confirmed!

${bookingDetails.tourName}
Date: ${bookingDetails.date}
Time: ${bookingDetails.time}
Guests: ${bookingDetails.participants}

Reply with any questions!`;

  return sendWhatsApp(orgId, { to: customerPhone, body });
}

/**
 * Send a trip reminder via WhatsApp
 */
export async function sendTripReminderWhatsApp(
  orgId: string,
  customerPhone: string,
  reminderDetails: {
    tourName: string;
    date: string;
    time: string;
    location?: string;
  }
): Promise<WhatsAppResult> {
  let body = `Reminder: ${reminderDetails.tourName} tomorrow!

Date: ${reminderDetails.date}
Time: ${reminderDetails.time}`;

  if (reminderDetails.location) {
    body += `\nLocation: ${reminderDetails.location}`;
  }

  body += "\n\nSee you there!";

  return sendWhatsApp(orgId, { to: customerPhone, body });
}

/**
 * Send a custom WhatsApp message
 */
export async function sendCustomWhatsAppMessage(
  orgId: string,
  customerPhone: string,
  message: string
): Promise<WhatsAppResult> {
  return sendWhatsApp(orgId, { to: customerPhone, body: message });
}

// ============================================================================
// TEMPLATE MANAGEMENT (Meta API only)
// ============================================================================

/**
 * List available message templates (Meta API only)
 */
export async function listMessageTemplates(
  orgId: string
): Promise<WhatsAppTemplate[] | null> {
  const credentials = await getWhatsAppCredentials(orgId);

  if (!credentials || credentials.provider !== "meta") {
    return null;
  }

  const { accessToken, businessAccountId } = credentials;

  if (!accessToken || !businessAccountId) {
    return null;
  }

  try {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${businessAccountId}/message_templates?fields=name,language,status,category,components`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data.data.map((template: Record<string, unknown>) => ({
      name: template.name as string,
      language: template.language as string,
      status: template.status as string,
      category: template.category as string,
      components: template.components as WhatsAppTemplate["components"],
    }));
  } catch {
    return null;
  }
}

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Normalize a phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // If it starts with +, validate it's E.164
  if (cleaned.startsWith("+")) {
    if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  // If it's a 10-digit US number, add +1
  if (/^\d{10}$/.test(cleaned)) {
    return `+1${cleaned}`;
  }

  // If it's 11 digits starting with 1 (US with country code)
  if (/^1\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If it's longer, assume it includes country code
  if (/^\d{11,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Format a phone number for display
 */
export function formatWhatsAppNumber(phone: string): string {
  // Remove whatsapp: prefix if present
  const cleaned = phone.replace("whatsapp:", "").replace(/\D/g, "");

  // US number formatting
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return `+${cleaned}`;
}
