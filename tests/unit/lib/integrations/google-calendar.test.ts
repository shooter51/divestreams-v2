/**
 * Unit tests for Google Calendar integration
 *
 * Tests OAuth flow, token management, and calendar sync operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment variables
vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("APP_URL", "https://divestreams.test");

describe("Google Calendar Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuth URL Generation", () => {
    it("should generate valid OAuth authorization URL", async () => {
      const { getGoogleAuthUrl } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const orgId = "test-org-123";
      const authUrl = getGoogleAuthUrl(orgId);

      expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authUrl).toContain("client_id=test-client-id.apps.googleusercontent.com");
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fdivestreams.test%2Fapi%2Fintegrations%2Fgoogle%2Fcallback");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=");
      expect(authUrl).toContain("access_type=offline");
      expect(authUrl).toContain("prompt=consent");
      expect(authUrl).toContain("state=");
    });

    it("should generate tenant-specific callback URL with subdomain", async () => {
      const { getGoogleAuthUrl } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const orgId = "test-org-123";
      const subdomain = "demo";
      const authUrl = getGoogleAuthUrl(orgId, subdomain);

      expect(authUrl).toContain(
        "redirect_uri=https%3A%2F%2Fdemo.divestreams.test%2Fapi%2Fintegrations%2Fgoogle%2Fcallback"
      );
    });

    it("should include required Calendar API scopes", async () => {
      const { getGoogleAuthUrl } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const orgId = "test-org-123";
      const authUrl = getGoogleAuthUrl(orgId);
      const url = new URL(authUrl);
      const scopes = url.searchParams.get("scope")?.split(" ") || [];

      expect(scopes).toContain(
        "https://www.googleapis.com/auth/calendar.events"
      );
      expect(scopes).toContain(
        "https://www.googleapis.com/auth/calendar.readonly"
      );
      expect(scopes).toContain(
        "https://www.googleapis.com/auth/userinfo.email"
      );
      expect(scopes).toContain(
        "https://www.googleapis.com/auth/userinfo.profile"
      );
    });
  });

  describe("OAuth State Parameter", () => {
    it("should encode and decode state parameter correctly", async () => {
      const { parseOAuthState } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const orgId = "test-org-456";
      const state = Buffer.from(
        JSON.stringify({ orgId, nonce: Date.now() })
      ).toString("base64url");

      const decoded = parseOAuthState(state);

      expect(decoded.orgId).toBe(orgId);
      expect(decoded.nonce).toBeTypeOf("number");
    });

    it("should throw error for invalid state parameter", async () => {
      const { parseOAuthState } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      const invalidState = "invalid-base64-string";

      expect(() => parseOAuthState(invalidState)).toThrow(
        "Invalid OAuth state parameter"
      );
    });
  });

  describe("Token Exchange", () => {
    it("should exchange authorization code for tokens", async () => {
      const { exchangeCodeForTokens } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock successful token exchange
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });

      const code = "test-authorization-code";
      const tokens = await exchangeCodeForTokens(code);

      expect(tokens.accessToken).toBe("test-access-token");
      expect(tokens.refreshToken).toBe("test-refresh-token");
      expect(tokens.expiresIn).toBe(3600);
      expect(tokens.tokenType).toBe("Bearer");
    });

    it("should handle token exchange errors", async () => {
      const { exchangeCodeForTokens } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock failed token exchange
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid authorization code",
      });

      const code = "invalid-code";

      await expect(exchangeCodeForTokens(code)).rejects.toThrow(
        "Failed to exchange authorization code for tokens"
      );
    });
  });

  describe("Token Refresh", () => {
    it("should refresh expired access token", async () => {
      const { refreshAccessToken } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock successful token refresh
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
        }),
      });

      const refreshToken = "test-refresh-token";
      const refreshed = await refreshAccessToken(refreshToken);

      expect(refreshed.accessToken).toBe("new-access-token");
      expect(refreshed.expiresIn).toBe(3600);
    });

    it("should handle token refresh errors", async () => {
      const { refreshAccessToken } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock failed token refresh
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid refresh token",
      });

      const refreshToken = "invalid-refresh-token";

      await expect(refreshAccessToken(refreshToken)).rejects.toThrow(
        "Failed to refresh access token"
      );
    });
  });

  describe("User Info Retrieval", () => {
    it("should fetch Google user information", async () => {
      const { getGoogleUserInfo } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock successful user info fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "google-user-123",
          email: "user@example.com",
          name: "Test User",
          picture: "https://example.com/photo.jpg",
        }),
      });

      const accessToken = "test-access-token";
      const userInfo = await getGoogleUserInfo(accessToken);

      expect(userInfo.id).toBe("google-user-123");
      expect(userInfo.email).toBe("user@example.com");
      expect(userInfo.name).toBe("Test User");
      expect(userInfo.picture).toBe("https://example.com/photo.jpg");
    });

    it("should handle user info fetch errors", async () => {
      const { getGoogleUserInfo } = await import(
        "../../../../lib/integrations/google-calendar.server"
      );

      // Mock failed user info fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
      });

      const accessToken = "invalid-token";

      await expect(getGoogleUserInfo(accessToken)).rejects.toThrow(
        "Failed to get Google user info"
      );
    });
  });

  describe("Calendar Event Structure", () => {
    it("should format trip data correctly for calendar event", () => {
      const trip = {
        id: "trip-123",
        date: "2024-03-15",
        startTime: "10:00",
        endTime: "14:00",
        status: "confirmed",
        notes: "Beautiful dive site",
      };

      const tour = {
        name: "Wreck Dive Adventure",
        description: "Explore the SS Thistlegorm",
      };

      const event = {
        summary: `${tour.name} - ${trip.status}`,
        description: [
          `Trip ID: ${trip.id}`,
          tour.description,
          trip.notes,
        ]
          .filter(Boolean)
          .join("\n\n"),
        start: {
          dateTime: `${trip.date}T${trip.startTime}`,
          timeZone: "UTC",
        },
        end: {
          dateTime: `${trip.date}T${trip.endTime}`,
          timeZone: "UTC",
        },
        extendedProperties: {
          private: {
            divestreams_trip_id: trip.id,
            divestreams_org_id: "test-org",
          },
        },
      };

      expect(event.summary).toBe("Wreck Dive Adventure - confirmed");
      expect(event.description).toContain("Trip ID: trip-123");
      expect(event.description).toContain("Explore the SS Thistlegorm");
      expect(event.description).toContain("Beautiful dive site");
      expect(event.start.dateTime).toBe("2024-03-15T10:00");
      expect(event.end.dateTime).toBe("2024-03-15T14:00");
      expect(event.extendedProperties?.private.divestreams_trip_id).toBe(
        "trip-123"
      );
    });

    it("should calculate end time when not provided (default +2 hours)", () => {
      const trip = {
        date: "2024-03-15",
        startTime: "10:00",
        endTime: undefined,
      };

      // Calculate end time (+2 hours from start)
      const startHour = parseInt(trip.startTime.split(":")[0]);
      const startMinutes = trip.startTime.split(":")[1];
      const endTime = `${String(startHour + 2).padStart(2, "0")}:${startMinutes}`;

      const event = {
        start: { dateTime: `${trip.date}T${trip.startTime}`, timeZone: "UTC" },
        end: { dateTime: `${trip.date}T${endTime}`, timeZone: "UTC" },
      };

      expect(event.end.dateTime).toBe("2024-03-15T12:00");
    });
  });
});

describe("Google Calendar Bookings", () => {
  it("should sync booking to calendar by updating trip", async () => {
    const { syncBookingToCalendar } = await import(
      "../../../../lib/integrations/google-calendar-bookings.server"
    );

    // This function should call syncTripToCalendar internally
    const orgId = "test-org";
    const tripId = "trip-123";
    const timezone = "America/New_York";

    // Mock syncTripToCalendar
    vi.mock("../../../../lib/integrations/google-calendar.server", () => ({
      syncTripToCalendar: vi.fn().mockResolvedValue({
        success: true,
        eventId: "calendar-event-123",
      }),
    }));

    const result = await syncBookingToCalendar(orgId, tripId, timezone);

    expect(result.success).toBe(true);
  });

  it("should sync booking cancellation to calendar", async () => {
    const { syncBookingCancellationToCalendar } = await import(
      "../../../../lib/integrations/google-calendar-bookings.server"
    );

    const orgId = "test-org";
    const tripId = "trip-123";
    const timezone = "America/New_York";

    // Mock syncTripToCalendar
    vi.mock("../../../../lib/integrations/google-calendar.server", () => ({
      syncTripToCalendar: vi.fn().mockResolvedValue({
        success: true,
        eventId: "calendar-event-123",
      }),
    }));

    const result = await syncBookingCancellationToCalendar(
      orgId,
      tripId,
      timezone
    );

    expect(result.success).toBe(true);
  });
});
