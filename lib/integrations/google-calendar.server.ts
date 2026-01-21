/**
 * Google Calendar Integration
 *
 * Provides OAuth authentication and calendar sync functionality.
 * Supports two-way sync between DiveStreams trips/bookings and Google Calendar.
 *
 * Environment variables required:
 * - GOOGLE_CLIENT_ID: OAuth 2.0 client ID from Google Cloud Console
 * - GOOGLE_CLIENT_SECRET: OAuth 2.0 client secret
 * - APP_URL: Base URL for OAuth callback (e.g., https://divestreams.com)
 */

import {
  connectIntegration,
  getIntegrationWithTokens,
  updateTokens,
  updateLastSync,
  logSyncOperation,
  tokenNeedsRefresh,
  type Integration,
} from "./index.server";
import { db } from "../db";
import { eq, and, gte, lte } from "drizzle-orm";
import { trips, bookings, tours, customers } from "../db/schema";

// ============================================================================
// CONSTANTS
// ============================================================================

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_API = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * Scopes required for Google Calendar integration
 */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Get Google OAuth client credentials from tenant settings or environment
 */
function getGoogleCredentials(
  tenantClientId?: string,
  tenantClientSecret?: string
) {
  const clientId = tenantClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = tenantClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured. Please add your OAuth app credentials in Settings → Integrations."
    );
  }

  return { clientId, clientSecret, appUrl };
}

/**
 * Build the callback URL for a specific organization
 */
function getCallbackUrl(subdomain?: string): string {
  const { appUrl } = getGoogleCredentials();
  // For tenant-specific callback, use subdomain
  if (subdomain) {
    const url = new URL(appUrl);
    return `${url.protocol}//${subdomain}.${url.host}/api/integrations/google/callback`;
  }
  return `${appUrl}/api/integrations/google/callback`;
}

/**
 * Generate the Google OAuth authorization URL
 *
 * @param orgId - Organization ID to include in state
 * @param subdomain - Organization subdomain for callback URL
 * @param tenantClientId - Optional tenant-specific client ID
 * @param tenantClientSecret - Optional tenant-specific client secret
 * @returns URL to redirect the user to
 */
export function getGoogleAuthUrl(
  orgId: string,
  subdomain?: string,
  tenantClientId?: string,
  tenantClientSecret?: string
): string {
  const { clientId } = getGoogleCredentials(tenantClientId, tenantClientSecret);
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
    access_type: "offline", // Required for refresh token
    prompt: "consent", // Force consent to get refresh token
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
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
  const { clientId, clientSecret } = getGoogleCredentials(tenantClientId, tenantClientSecret);
  const callbackUrl = getCallbackUrl(subdomain);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Google token exchange failed:", error);
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
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getGoogleCredentials(tenantClientId, tenantClientSecret);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Google token refresh failed:", error);
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get user info from Google to display account details
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch(GOOGLE_USERINFO_API, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get Google user info");
  }

  return response.json();
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Complete OAuth flow and connect Google Calendar
 */
export async function handleGoogleCallback(
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
    const existing = await getIntegrationWithTokens(orgId, "google-calendar");
    if (existing) {
      const existingSettings = existing.integration.settings as { oauthClientId?: string; oauthClientSecret?: string } | null;
      clientId = existingSettings?.oauthClientId;
      clientSecret = existingSettings?.oauthClientSecret;
    }
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, subdomain, clientId, clientSecret);

  // Get user info for display
  const userInfo = await getGoogleUserInfo(tokens.accessToken);

  // Calculate token expiry time
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  // Store the integration with tenant OAuth credentials
  const settings: Record<string, unknown> = {
    syncEnabled: true,
    syncDirection: "one-way" as const,
  };

  // Store tenant OAuth credentials if provided
  if (clientId && clientSecret) {
    settings.oauthClientId = clientId;
    settings.oauthClientSecret = clientSecret;
  }

  return connectIntegration(
    orgId,
    "google-calendar",
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      scopes: SCOPES,
    },
    {
      accountId: userInfo.id,
      accountName: userInfo.name,
      accountEmail: userInfo.email,
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
  const result = await getIntegrationWithTokens(orgId, "google-calendar");

  if (!result) {
    return null;
  }

  const { integration, accessToken, refreshToken } = result;

  // Check if token needs refresh
  if (tokenNeedsRefresh(integration) && refreshToken) {
    try {
      // Get tenant OAuth credentials from settings if available
      const settings = integration.settings as { oauthClientId?: string; oauthClientSecret?: string } | null;
      const tenantClientId = settings?.oauthClientId;
      const tenantClientSecret = settings?.oauthClientSecret;

      const refreshed = await refreshAccessToken(refreshToken, tenantClientId, tenantClientSecret);
      const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

      await updateTokens(integration.id, {
        accessToken: refreshed.accessToken,
        expiresAt: newExpiresAt,
      });

      return { accessToken: refreshed.accessToken, integration };
    } catch (error) {
      console.error("Failed to refresh Google token:", error);
      await updateLastSync(integration.id, "Token refresh failed");
      return null;
    }
  }

  return { accessToken, integration };
}

// ============================================================================
// CALENDAR SYNC
// ============================================================================

/**
 * Calendar event data for Google Calendar API
 */
interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  extendedProperties?: {
    private: Record<string, string>;
  };
}

/**
 * Create or update a calendar event for a trip
 */
export async function syncTripToCalendar(
  orgId: string,
  tripId: string,
  timezone = "UTC"
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  const { accessToken, integration } = auth;
  const settings = integration.settings as { calendarId?: string } | null;
  const calendarId = settings?.calendarId || "primary";

  // Get trip details with tour info
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.organizationId, orgId), eq(trips.id, tripId)))
    .limit(1);

  if (!trip) {
    return { success: false, error: "Trip not found" };
  }

  // Get tour details
  const [tour] = await db
    .select()
    .from(tours)
    .where(eq(tours.id, trip.tourId))
    .limit(1);

  // Build event data
  const startDateTime = `${trip.date}T${trip.startTime}`;
  const endDateTime = trip.endTime
    ? `${trip.date}T${trip.endTime}`
    : `${trip.date}T${String(parseInt(trip.startTime.split(":")[0]) + 2).padStart(2, "0")}:${trip.startTime.split(":")[1]}`;

  const event: CalendarEvent = {
    summary: `${tour?.name || "Dive Trip"} - ${trip.status}`,
    description: [
      `Trip ID: ${trip.id}`,
      tour?.description || "",
      trip.notes || "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    start: {
      dateTime: startDateTime,
      timeZone: timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: timezone,
    },
    extendedProperties: {
      private: {
        divestreams_trip_id: trip.id,
        divestreams_org_id: orgId,
      },
    },
  };

  try {
    // Check if event already exists (by searching extended properties)
    const existingEventId = await findExistingEvent(
      accessToken,
      calendarId,
      tripId
    );

    let response: Response;
    let eventId: string;

    if (existingEventId) {
      // Update existing event
      response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${existingEventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      eventId = existingEventId;
    } else {
      // Create new event
      response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      const data = await response.json();
      eventId = data.id;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to sync event");
    }

    // Log the sync
    await logSyncOperation(integration.id, "sync_trip", "success", {
      entityType: "trip",
      entityId: tripId,
      externalId: eventId,
    });

    await updateLastSync(integration.id);

    return { success: true, eventId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(integration.id, "sync_trip", "failed", {
      entityType: "trip",
      entityId: tripId,
      error: errorMessage,
    });

    await updateLastSync(integration.id, errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Find an existing calendar event by trip ID
 */
async function findExistingEvent(
  accessToken: string,
  calendarId: string,
  tripId: string
): Promise<string | null> {
  // Search for events with our private extended property
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events?privateExtendedProperty=divestreams_trip_id%3D${tripId}`,
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
  return data.items?.[0]?.id || null;
}

/**
 * Delete a calendar event for a trip
 */
export async function deleteTripFromCalendar(
  orgId: string,
  tripId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  const { accessToken, integration } = auth;
  const settings = integration.settings as { calendarId?: string } | null;
  const calendarId = settings?.calendarId || "primary";

  try {
    const eventId = await findExistingEvent(accessToken, calendarId, tripId);

    if (!eventId) {
      return { success: true }; // Event doesn't exist, nothing to delete
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 410) {
      // 410 Gone is fine (already deleted)
      throw new Error("Failed to delete calendar event");
    }

    await logSyncOperation(integration.id, "delete_trip", "success", {
      entityType: "trip",
      entityId: tripId,
      externalId: eventId,
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await logSyncOperation(integration.id, "delete_trip", "failed", {
      entityType: "trip",
      entityId: tripId,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all trips for a date range to Google Calendar
 */
export async function syncAllTrips(
  orgId: string,
  startDate: string,
  endDate: string,
  timezone = "UTC"
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return { synced: 0, failed: 0, errors: ["Google Calendar not connected"] };
  }

  // Get all trips in the date range
  const tripsToSync = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, orgId),
        gte(trips.date, startDate),
        lte(trips.date, endDate)
      )
    );

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const trip of tripsToSync) {
    const result = await syncTripToCalendar(orgId, trip.id, timezone);
    if (result.success) {
      synced++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`Trip ${trip.id}: ${result.error}`);
      }
    }
  }

  return { synced, failed, errors };
}

/**
 * Get list of available calendars for the user
 */
export async function listCalendars(
  orgId: string
): Promise<Array<{ id: string; name: string; primary: boolean }> | null> {
  const auth = await getValidAccessToken(orgId);
  if (!auth) {
    return null;
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return data.items.map(
    (cal: { id: string; summary: string; primary?: boolean }) => ({
      id: cal.id,
      name: cal.summary,
      primary: cal.primary || false,
    })
  );
}
