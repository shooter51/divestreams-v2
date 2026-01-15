import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/settings/integrations";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  getSubdomainFromRequest: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../../lib/api-keys/index.server", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}));

vi.mock("../../../../../lib/webhooks/index.server", () => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  createTestDelivery: vi.fn(),
  regenerateWebhookSecret: vi.fn(),
  WEBHOOK_EVENTS: ["booking.created", "booking.updated", "booking.canceled"],
  WEBHOOK_EVENT_DESCRIPTIONS: {
    "booking.created": "When a new booking is created",
    "booking.updated": "When a booking is updated",
    "booking.canceled": "When a booking is canceled",
  },
}));

vi.mock("../../../../../lib/webhooks/deliver.server", () => ({
  deliverWebhook: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/index.server", () => ({
  listActiveIntegrations: vi.fn(),
  disconnectIntegration: vi.fn(),
  updateIntegrationSettings: vi.fn(),
  getIntegration: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/google-calendar.server", () => ({
  getGoogleAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/oauth"),
  syncAllTrips: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/twilio.server", () => ({
  connectTwilio: vi.fn(),
  sendSMS: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/zapier.server", () => ({
  connectZapier: vi.fn(),
  getZapierIntegration: vi.fn().mockResolvedValue(null),
  updateZapierSettings: vi.fn(),
  regenerateZapierSecret: vi.fn(),
  testZapierWebhook: vi.fn(),
  getZapierWebhookUrl: vi.fn().mockReturnValue("https://api.example.com/webhooks/zapier/xxx"),
  isValidZapierWebhookUrl: vi.fn().mockReturnValue(true),
  ZAPIER_TRIGGERS: ["booking.created", "booking.updated", "customer.created"],
  ZAPIER_TRIGGER_DESCRIPTIONS: {
    "booking.created": "When a new booking is created",
    "booking.updated": "When a booking is updated",
    "customer.created": "When a new customer is created",
  },
}));

vi.mock("../../../../../lib/integrations/xero.server", () => ({
  getXeroAuthUrl: vi.fn().mockReturnValue("https://login.xero.com/oauth"),
}));

vi.mock("../../../../../lib/integrations/mailchimp.server", () => ({
  getMailchimpAuthUrl: vi.fn().mockReturnValue("https://login.mailchimp.com/oauth"),
  listAudiences: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../../lib/integrations/quickbooks.server", () => ({
  getQuickBooksAuthUrl: vi.fn().mockReturnValue("https://appcenter.intuit.com/oauth"),
}));

vi.mock("../../../../../lib/integrations/stripe.server", () => ({
  getStripeSettings: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../../lib/integrations/whatsapp.server", () => ({
  connectWhatsApp: vi.fn(),
  sendWhatsApp: vi.fn(),
}));

import { requireOrgContext, getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";
import { createApiKey, listApiKeys, revokeApiKey } from "../../../../../lib/api-keys/index.server";
import { listWebhooks, createWebhook, updateWebhook, deleteWebhook, createTestDelivery, regenerateWebhookSecret } from "../../../../../lib/webhooks/index.server";
import { listActiveIntegrations, disconnectIntegration, updateIntegrationSettings } from "../../../../../lib/integrations/index.server";
import { connectTwilio, sendSMS } from "../../../../../lib/integrations/twilio.server";
import { deliverWebhook } from "../../../../../lib/webhooks/deliver.server";

describe("tenant/settings/integrations route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: {
      id: "org-uuid",
      name: "Demo Dive Shop",
      slug: "demo",
      metadata: null,
    },
    membership: { role: "owner" },
    subscription: { plan: "professional" },
    isPremium: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (listApiKeys as Mock).mockResolvedValue([]);
    (listWebhooks as Mock).mockResolvedValue([]);
    (listActiveIntegrations as Mock).mockResolvedValue([]);
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches API keys", async () => {
      const mockKeys = [
        { id: "key-1", name: "Production", keyPrefix: "dk_live_abc", isActive: true, createdAt: new Date(), lastUsedAt: null },
      ];
      (listApiKeys as Mock).mockResolvedValue(mockKeys);

      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(listApiKeys).toHaveBeenCalledWith("org-uuid");
      expect(result.apiKeys).toEqual(mockKeys);
    });

    it("fetches webhooks", async () => {
      const mockWebhooks = [
        { id: "wh-1", url: "https://example.com/webhook", events: ["booking.created"], isActive: true },
      ];
      (listWebhooks as Mock).mockResolvedValue(mockWebhooks);

      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(listWebhooks).toHaveBeenCalledWith("org-uuid");
      expect(result.webhooks).toEqual(mockWebhooks);
    });

    it("fetches active integrations", async () => {
      const mockIntegrations = [
        { provider: "google-calendar", accountName: "test@gmail.com", lastSyncAt: new Date(), connectedAt: new Date() },
      ];
      (listActiveIntegrations as Mock).mockResolvedValue(mockIntegrations);

      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(listActiveIntegrations).toHaveBeenCalledWith("org-uuid");
      expect(result.connectedIntegrations).toBeDefined();
    });

    it("returns current plan and premium status", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.currentPlan).toBe("professional");
      expect(result.isPremium).toBe(true);
    });

    it("returns webhook events and descriptions", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.webhookEvents).toBeDefined();
      expect(result.webhookEventDescriptions).toBeDefined();
    });

    it("indicates Google OAuth configuration status", async () => {
      const request = new Request("https://demo.divestreams.com/app/settings/integrations");
      const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

      expect(result.googleConfigured).toBe(true);
    });
  });

  describe("action - API Keys", () => {
    it("creates a new API key", async () => {
      (createApiKey as Mock).mockResolvedValue({
        id: "key-new",
        key: "dk_live_fullkey123",
        name: "New Key",
        keyPrefix: "dk_live_ful",
      });

      const formData = new FormData();
      formData.append("intent", "createApiKey");
      formData.append("keyName", "Production Server");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(createApiKey).toHaveBeenCalledWith("org-uuid", "Production Server");
      expect(result.success).toBe(true);
      expect(result.newKey).toBe("dk_live_fullkey123");
    });

    it("returns error when API key name is empty", async () => {
      const formData = new FormData();
      formData.append("intent", "createApiKey");
      formData.append("keyName", "");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("API key name is required");
    });

    it("revokes an API key", async () => {
      (revokeApiKey as Mock).mockResolvedValue(true);

      const formData = new FormData();
      formData.append("intent", "revokeApiKey");
      formData.append("keyId", "key-to-revoke");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(revokeApiKey).toHaveBeenCalledWith("key-to-revoke", "org-uuid");
      expect(result.success).toBe(true);
      expect(result.revokedKeyId).toBe("key-to-revoke");
    });

    it("returns error when revoking non-existent key", async () => {
      (revokeApiKey as Mock).mockResolvedValue(false);

      const formData = new FormData();
      formData.append("intent", "revokeApiKey");
      formData.append("keyId", "non-existent-key");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("API key not found");
    });
  });

  describe("action - Webhooks", () => {
    it("creates a new webhook", async () => {
      (createWebhook as Mock).mockResolvedValue({
        id: "wh-new",
        secret: "whsec_secret123",
      });

      const formData = new FormData();
      formData.append("intent", "createWebhook");
      formData.append("webhookUrl", "https://example.com/webhook");
      formData.append("webhookDescription", "Production webhook");
      formData.append("webhookEvents", "booking.created");
      formData.append("webhookEvents", "booking.canceled");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(createWebhook).toHaveBeenCalledWith(
        "org-uuid",
        "https://example.com/webhook",
        ["booking.created", "booking.canceled"],
        "Production webhook"
      );
      expect(result.success).toBe(true);
      expect(result.webhookSecret).toBe("whsec_secret123");
    });

    it("returns error when webhook URL is empty", async () => {
      const formData = new FormData();
      formData.append("intent", "createWebhook");
      formData.append("webhookUrl", "");
      formData.append("webhookEvents", "booking.created");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Webhook URL is required");
    });

    it("returns error when no events selected", async () => {
      const formData = new FormData();
      formData.append("intent", "createWebhook");
      formData.append("webhookUrl", "https://example.com/webhook");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("At least one event must be selected");
    });

    it("updates an existing webhook", async () => {
      (updateWebhook as Mock).mockResolvedValue({ id: "wh-1" });

      const formData = new FormData();
      formData.append("intent", "updateWebhook");
      formData.append("webhookId", "wh-1");
      formData.append("webhookUrl", "https://example.com/webhook-updated");
      formData.append("webhookEvents", "booking.updated");
      formData.append("webhookIsActive", "true");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(updateWebhook).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.webhookUpdated).toBe(true);
    });

    it("deletes a webhook", async () => {
      (deleteWebhook as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "deleteWebhook");
      formData.append("webhookId", "wh-to-delete");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(deleteWebhook).toHaveBeenCalledWith("wh-to-delete", "org-uuid");
      expect(result.success).toBe(true);
      expect(result.webhookDeleted).toBe(true);
    });

    it("tests a webhook", async () => {
      (createTestDelivery as Mock).mockResolvedValue("delivery-id");
      (deliverWebhook as Mock).mockResolvedValue(true);

      const formData = new FormData();
      formData.append("intent", "testWebhook");
      formData.append("webhookId", "wh-test");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(createTestDelivery).toHaveBeenCalledWith("wh-test", "org-uuid");
      expect(deliverWebhook).toHaveBeenCalledWith("delivery-id");
      expect(result.success).toBe(true);
      expect(result.webhookTested).toBe(true);
    });

    it("regenerates webhook secret", async () => {
      (regenerateWebhookSecret as Mock).mockResolvedValue({ secret: "whsec_newsecret" });

      const formData = new FormData();
      formData.append("intent", "regenerateWebhookSecret");
      formData.append("webhookId", "wh-1");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(regenerateWebhookSecret).toHaveBeenCalledWith("wh-1", "org-uuid");
      expect(result.success).toBe(true);
      expect(result.newSecret).toBe("whsec_newsecret");
    });
  });

  describe("action - Integrations", () => {
    it("disconnects an integration", async () => {
      (disconnectIntegration as Mock).mockResolvedValue(true);

      const formData = new FormData();
      formData.append("intent", "disconnect");
      formData.append("integrationId", "google-calendar");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(disconnectIntegration).toHaveBeenCalledWith("org-uuid", "google-calendar");
      expect(result.success).toBe(true);
    });

    it("returns error when disconnecting non-existent integration", async () => {
      (disconnectIntegration as Mock).mockResolvedValue(false);

      const formData = new FormData();
      formData.append("intent", "disconnect");
      formData.append("integrationId", "non-existent");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Integration not found");
    });

    it("connects Twilio", async () => {
      (connectTwilio as Mock).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.append("intent", "connectTwilio");
      formData.append("accountSid", "AC123456");
      formData.append("authToken", "token123");
      formData.append("phoneNumber", "+15551234567");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(connectTwilio).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("returns error when Twilio credentials are missing", async () => {
      const formData = new FormData();
      formData.append("intent", "connectTwilio");
      formData.append("accountSid", "");
      formData.append("authToken", "");
      formData.append("phoneNumber", "");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Account SID, Auth Token, and Phone Number are required");
    });

    it("sends test SMS", async () => {
      (sendSMS as Mock).mockResolvedValue({ success: true });

      const formData = new FormData();
      formData.append("intent", "testSMS");
      formData.append("phoneNumber", "+15559876543");

      const request = new Request("https://demo.divestreams.com/app/settings/integrations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);

      expect(sendSMS).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
