/**
 * Integrations Schema Tests
 *
 * Tests for integration schema types and constants.
 */

import { describe, it, expect } from "vitest";
import {
  type NewIntegration,
  type IntegrationProvider,
  type IntegrationDisplay,
  type GoogleCalendarSettings,
  type TwilioSettings,
  type StripeSettings,
  type MailchimpSettings,
} from "../../../../../lib/db/schema/integrations";

describe("Integrations Schema", () => {
  describe("IntegrationProvider type", () => {
    it("accepts stripe", () => {
      const provider: IntegrationProvider = "stripe";
      expect(provider).toBe("stripe");
    });

    it("accepts google-calendar", () => {
      const provider: IntegrationProvider = "google-calendar";
      expect(provider).toBe("google-calendar");
    });

    it("accepts mailchimp", () => {
      const provider: IntegrationProvider = "mailchimp";
      expect(provider).toBe("mailchimp");
    });

    it("accepts quickbooks", () => {
      const provider: IntegrationProvider = "quickbooks";
      expect(provider).toBe("quickbooks");
    });

    it("accepts zapier", () => {
      const provider: IntegrationProvider = "zapier";
      expect(provider).toBe("zapier");
    });

    it("accepts twilio", () => {
      const provider: IntegrationProvider = "twilio";
      expect(provider).toBe("twilio");
    });

    it("accepts whatsapp", () => {
      const provider: IntegrationProvider = "whatsapp";
      expect(provider).toBe("whatsapp");
    });

    it("accepts xero", () => {
      const provider: IntegrationProvider = "xero";
      expect(provider).toBe("xero");
    });
  });

  describe("GoogleCalendarSettings type", () => {
    it("supports all Google Calendar settings", () => {
      const settings: GoogleCalendarSettings = {
        calendarId: "primary",
        syncEnabled: true,
        syncDirection: "two-way",
      };

      expect(settings.calendarId).toBe("primary");
      expect(settings.syncEnabled).toBe(true);
      expect(settings.syncDirection).toBe("two-way");
    });

    it("allows partial settings", () => {
      const settings: GoogleCalendarSettings = {
        syncEnabled: false,
      };

      expect(settings.syncEnabled).toBe(false);
      expect(settings.calendarId).toBeUndefined();
    });

    it("allows empty object", () => {
      const settings: GoogleCalendarSettings = {};
      expect(Object.keys(settings)).toHaveLength(0);
    });

    it("syncDirection accepts one-way", () => {
      const settings: GoogleCalendarSettings = {
        syncDirection: "one-way",
      };
      expect(settings.syncDirection).toBe("one-way");
    });
  });

  describe("TwilioSettings type", () => {
    it("supports phone number", () => {
      const settings: TwilioSettings = {
        phoneNumber: "+15551234567",
      };
      expect(settings.phoneNumber).toBe("+15551234567");
    });

    it("supports messaging service SID", () => {
      const settings: TwilioSettings = {
        messagingServiceSid: "MG123456789",
      };
      expect(settings.messagingServiceSid).toBe("MG123456789");
    });

    it("supports both settings", () => {
      const settings: TwilioSettings = {
        phoneNumber: "+15551234567",
        messagingServiceSid: "MG123456789",
      };
      expect(settings.phoneNumber).toBeDefined();
      expect(settings.messagingServiceSid).toBeDefined();
    });
  });

  describe("StripeSettings type", () => {
    it("supports liveMode setting", () => {
      const settings: StripeSettings = {
        liveMode: true,
      };
      expect(settings.liveMode).toBe(true);
    });

    it("allows test mode", () => {
      const settings: StripeSettings = {
        liveMode: false,
      };
      expect(settings.liveMode).toBe(false);
    });
  });

  describe("MailchimpSettings type", () => {
    it("supports listId", () => {
      const settings: MailchimpSettings = {
        listId: "abc123",
      };
      expect(settings.listId).toBe("abc123");
    });

    it("supports audienceId", () => {
      const settings: MailchimpSettings = {
        audienceId: "def456",
      };
      expect(settings.audienceId).toBe("def456");
    });
  });

  describe("IntegrationDisplay type", () => {
    it("has all required fields", () => {
      const display: IntegrationDisplay = {
        id: "int-1",
        provider: "stripe",
        accountName: "Test Account",
        accountEmail: "test@example.com",
        isActive: true,
        connectedAt: new Date(),
        lastSyncAt: null,
        lastSyncError: null,
        settings: null,
      };

      expect(display.id).toBe("int-1");
      expect(display.provider).toBe("stripe");
      expect(display.isActive).toBe(true);
    });

    it("supports nullable fields", () => {
      const display: IntegrationDisplay = {
        id: "int-2",
        provider: "google-calendar",
        accountName: null,
        accountEmail: null,
        isActive: false,
        connectedAt: new Date("2025-01-01"),
        lastSyncAt: new Date("2025-01-15"),
        lastSyncError: "Sync failed: timeout",
        settings: { syncEnabled: false },
      };

      expect(display.accountName).toBeNull();
      expect(display.lastSyncError).toContain("timeout");
    });
  });

  describe("Integration type constraints", () => {
    it("validates required fields for NewIntegration", () => {
      // This tests that the type structure is correct
      const newIntegration: Partial<NewIntegration> = {
        organizationId: "org-1",
        provider: "twilio",
      };

      expect(newIntegration.organizationId).toBe("org-1");
      expect(newIntegration.provider).toBe("twilio");
    });

    it("allows optional OAuth fields", () => {
      const newIntegration: Partial<NewIntegration> = {
        organizationId: "org-1",
        provider: "google-calendar",
        accessToken: "encrypted_token",
        refreshToken: "encrypted_refresh",
        tokenExpiresAt: new Date("2025-02-01"),
        accountId: "google-user-123",
        accountEmail: "user@gmail.com",
        scopes: "calendar.readonly calendar.events",
      };

      expect(newIntegration.scopes).toContain("calendar");
    });
  });
});
