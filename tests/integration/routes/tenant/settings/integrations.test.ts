import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/tenant/settings/integrations";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  getSubdomainFromRequest: vi.fn(),
}));

vi.mock("../../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  PLAN_FEATURES: { HAS_INTEGRATIONS: "has_integrations" },
  FEATURE_UPGRADE_INFO: {},
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  subscriptionPlans: { isActive: "isActive" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
}));

vi.mock("../../../../../lib/integrations/index.server", () => ({
  listActiveIntegrations: vi.fn().mockResolvedValue([]),
  disconnectIntegration: vi.fn(),
  updateIntegrationSettings: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/google-calendar.server", () => ({
  getGoogleAuthUrl: vi.fn(),
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
  getZapierWebhookUrl: vi.fn(),
  isValidZapierWebhookUrl: vi.fn(),
  ZAPIER_TRIGGERS: {},
  ZAPIER_TRIGGER_DESCRIPTIONS: {},
}));

vi.mock("../../../../../lib/integrations/xero.server", () => ({
  getXeroAuthUrl: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/mailchimp.server", () => ({
  getMailchimpAuthUrl: vi.fn(),
  listAudiences: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/quickbooks.server", () => ({
  getQuickBooksAuthUrl: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/stripe.server", () => ({
  getStripeSettings: vi.fn().mockResolvedValue(null),
  connectStripe: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/whatsapp.server", () => ({
  connectWhatsApp: vi.fn(),
  sendWhatsApp: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../../lib/require-feature.server";

describe("tenant/settings/integrations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires org context", async () => {
      (requireOrgContext as Mock).mockRejectedValue(new Response(null, { status: 302 }));

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/settings/integrations"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("requires integrations feature", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        user: { id: "user-1" },
        org: { id: "org-1" },
        subscription: { planDetails: { features: {} } },
      });
      (requireFeature as Mock).mockImplementation(() => {
        throw new Response("Feature not available", { status: 403 });
      });

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/tenant/settings/integrations"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 403 }));
    });
  });
});
