/**
 * Twilio SMS Integration
 *
 * Provides SMS messaging functionality using Twilio's REST API.
 * Supports booking confirmations, reminders, and custom messages.
 *
 * Configuration stored in integrations table:
 * - accessToken: Account SID
 * - refreshToken: Auth Token (encrypted)
 * - settings.phoneNumber: Twilio phone number to send from
 * - settings.messagingServiceSid: Optional Messaging Service SID
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

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Credentials for Twilio API
 */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  messagingServiceSid?: string;
}

/**
 * Connect Twilio integration with API credentials
 *
 * Unlike OAuth integrations, Twilio uses API keys that the user
 * provides directly. We validate them before storing.
 */
export async function connectTwilio(
  orgId: string,
  credentials: TwilioCredentials
): Promise<{ success: boolean; error?: string; integration?: Integration }> {
  // Validate credentials by making a test API call
  const validation = await validateTwilioCredentials(
    credentials.accountSid,
    credentials.authToken
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Store the integration
  // We use accessToken for Account SID and refreshToken for Auth Token
  const integration = await connectIntegration(
    orgId,
    "twilio",
    {
      accessToken: credentials.accountSid, // Account SID
      refreshToken: credentials.authToken, // Auth Token (encrypted)
    },
    {
      accountId: credentials.accountSid,
      accountName: validation.accountName || `Twilio (${credentials.accountSid.slice(-4)})`,
    },
    {
      phoneNumber: credentials.phoneNumber,
      messagingServiceSid: credentials.messagingServiceSid,
    }
  );

  return { success: true, integration };
}

/**
 * Validate Twilio credentials by fetching account info
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
 * Get Twilio credentials for an organization
 */
async function getTwilioCredentials(orgId: string): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  messagingServiceSid?: string;
  integration: Integration;
} | null> {
  const result = await getIntegrationWithTokens(orgId, "twilio");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;
  const settings = integration.settings as {
    phoneNumber?: string;
    messagingServiceSid?: string;
  } | null;

  if (!accessToken || !refreshToken || !settings?.phoneNumber) {
    return null;
  }

  return {
    accountSid: accessToken,
    authToken: refreshToken,
    phoneNumber: settings.phoneNumber,
    messagingServiceSid: settings.messagingServiceSid,
    integration,
  };
}

// ============================================================================
// SMS MESSAGING
// ============================================================================

/**
 * SMS message options
 */
export interface SendSMSOptions {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  body: string; // Message content (max 1600 characters)
  mediaUrl?: string; // Optional MMS media URL
}

/**
 * Result of sending an SMS
 */
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

/**
 * Send an SMS message via Twilio
 *
 * @param orgId - Organization ID
 * @param options - Message options
 * @returns Result of the send operation
 */
export async function sendSMS(
  orgId: string,
  options: SendSMSOptions
): Promise<SMSResult> {
  const credentials = await getTwilioCredentials(orgId);

  if (!credentials) {
    return { success: false, error: "Twilio not connected" };
  }

  const { accountSid, authToken, phoneNumber, messagingServiceSid, integration } =
    credentials;

  // Normalize phone number (ensure E.164 format)
  const toNumber = normalizePhoneNumber(options.to);
  if (!toNumber) {
    return { success: false, error: "Invalid phone number format" };
  }

  // Build message params
  const params = new URLSearchParams({
    To: toNumber,
    Body: options.body.slice(0, 1600), // Twilio limit
  });

  // Use messaging service if configured, otherwise use phone number
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    params.set("From", phoneNumber);
  }

  // Add media URL for MMS
  if (options.mediaUrl) {
    params.set("MediaUrl", options.mediaUrl);
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
      const errorMessage = data.message || data.error_message || "Failed to send SMS";

      await logSyncOperation(integration.id, "send_sms", "failed", {
        entityType: "sms",
        error: errorMessage,
        request: { to: toNumber, bodyLength: options.body.length },
        response: data,
      });

      return { success: false, error: errorMessage };
    }

    await logSyncOperation(integration.id, "send_sms", "success", {
      entityType: "sms",
      externalId: data.sid,
      request: { to: toNumber, bodyLength: options.body.length },
    });

    await updateLastSync(integration.id);

    return {
      success: true,
      messageId: data.sid,
      status: data.status,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Network error";

    await logSyncOperation(integration.id, "send_sms", "failed", {
      entityType: "sms",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Send a bulk SMS to multiple recipients
 */
export async function sendBulkSMS(
  orgId: string,
  recipients: string[],
  body: string
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
  const results: SMSResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    // Add a small delay to avoid rate limiting
    if (results.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const result = await sendSMS(orgId, { to, body });
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed, results };
}

// ============================================================================
// TEMPLATE MESSAGES
// ============================================================================

/**
 * Send a booking confirmation SMS
 */
export async function sendBookingConfirmation(
  orgId: string,
  customerPhone: string,
  bookingDetails: {
    bookingNumber: string;
    tourName: string;
    date: string;
    time: string;
    participants: number;
  }
): Promise<SMSResult> {
  const body = `Your booking ${bookingDetails.bookingNumber} is confirmed!

${bookingDetails.tourName}
Date: ${bookingDetails.date}
Time: ${bookingDetails.time}
Guests: ${bookingDetails.participants}

Reply HELP for assistance.`;

  return sendSMS(orgId, { to: customerPhone, body });
}

/**
 * Send a trip reminder SMS
 */
export async function sendTripReminder(
  orgId: string,
  customerPhone: string,
  reminderDetails: {
    tourName: string;
    date: string;
    time: string;
    location?: string;
  }
): Promise<SMSResult> {
  let body = `Reminder: ${reminderDetails.tourName} tomorrow!

Date: ${reminderDetails.date}
Time: ${reminderDetails.time}`;

  if (reminderDetails.location) {
    body += `\nLocation: ${reminderDetails.location}`;
  }

  body += "\n\nSee you there!";

  return sendSMS(orgId, { to: customerPhone, body });
}

/**
 * Send a custom message
 */
export async function sendCustomMessage(
  orgId: string,
  customerPhone: string,
  message: string
): Promise<SMSResult> {
  return sendSMS(orgId, { to: customerPhone, body: message });
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
    // E.164 format: +[country code][number], 7-15 digits total after +
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
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  // US number formatting
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // International - just add + and return
  return `+${cleaned}`;
}

// ============================================================================
// ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Get Twilio account balance
 */
export async function getAccountBalance(
  orgId: string
): Promise<{ balance: string; currency: string } | null> {
  const credentials = await getTwilioCredentials(orgId);

  if (!credentials) {
    return null;
  }

  const { accountSid, authToken } = credentials;

  try {
    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${accountSid}/Balance.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      balance: data.balance,
      currency: data.currency,
    };
  } catch {
    return null;
  }
}

/**
 * List available phone numbers for the account
 */
export async function listPhoneNumbers(
  orgId: string
): Promise<Array<{ sid: string; phoneNumber: string; friendlyName: string }> | null> {
  const credentials = await getTwilioCredentials(orgId);

  if (!credentials) {
    return null;
  }

  const { accountSid, authToken } = credentials;

  try {
    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data.incoming_phone_numbers.map(
      (pn: { sid: string; phone_number: string; friendly_name: string }) => ({
        sid: pn.sid,
        phoneNumber: pn.phone_number,
        friendlyName: pn.friendly_name,
      })
    );
  } catch {
    return null;
  }
}
