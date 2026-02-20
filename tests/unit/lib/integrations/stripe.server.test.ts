/**
 * Stripe Server Integration Tests
 *
 * Tests for core Stripe server-side functions including getStripeSettings.
 * POS-specific functions (PaymentIntents, Terminal) are in stripe-pos.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe SDK
const mockAccountsRetrieve = vi.fn();

class MockStripe {
  paymentIntents = { create: vi.fn() };
  terminal = {
    locations: { create: vi.fn() },
    connectionTokens: { create: vi.fn() },
    readers: { create: vi.fn(), list: vi.fn(), del: vi.fn() },
  };
  accounts = { retrieve: mockAccountsRetrieve };
}

vi.mock("stripe", () => ({ default: MockStripe }));

// Mock the integrations module
const mockGetIntegration = vi.fn();
const mockGetIntegrationWithTokens = vi.fn();
const mockLogSyncOperation = vi.fn();
const mockUpdateLastSync = vi.fn();

vi.mock("../../../../lib/integrations/index.server", () => ({
  getIntegration: mockGetIntegration,
  getIntegrationWithTokens: mockGetIntegrationWithTokens,
  logSyncOperation: mockLogSyncOperation,
  updateIntegrationSettings: vi.fn(),
  decryptToken: (token: string) => token,
  updateLastSync: mockUpdateLastSync,
}));

describe("getStripeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIntegration.mockResolvedValue(null);
    mockGetIntegrationWithTokens.mockResolvedValue(null);
    mockLogSyncOperation.mockResolvedValue(undefined);
    mockUpdateLastSync.mockResolvedValue(undefined);
  });

  it("returns null when no integration exists", async () => {
    const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeSettings("org-1");
    expect(result).toBeNull();
  });

  it("returns null when integration is not active", async () => {
    mockGetIntegration.mockResolvedValue({ id: "int-1", isActive: false, provider: "stripe" });
    const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeSettings("org-1");
    expect(result).toBeNull();
  });

  it("returns live Stripe API data when available", async () => {
    const integrationData = {
      id: "int-1",
      isActive: true,
      provider: "stripe" as const,
      accountId: "acct_123",
      accountName: "Demo Shop",
      settings: {
        liveMode: false,
        webhookEndpointId: "we_123",
        chargesEnabled: false,
        payoutsEnabled: false,
      },
    };
    mockGetIntegration.mockResolvedValue(integrationData);
    mockGetIntegrationWithTokens.mockResolvedValue({
      integration: integrationData,
      accessToken: "sk_test_123",
      refreshToken: "pk_test_456",
    });
    mockAccountsRetrieve.mockResolvedValue({
      id: "acct_123",
      business_profile: { name: "Demo Shop" },
      email: "demo@example.com",
      country: "US",
      default_currency: "usd",
      charges_enabled: true,
      payouts_enabled: true,
    });

    const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeSettings("org-1");

    expect(result).toMatchObject({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      liveMode: false,
      webhookConfigured: true,
    });
  });

  it("falls back to cached chargesEnabled when Stripe API call fails", async () => {
    // KAN-653 bug fix: Stripe API failure must not show "Stripe Not Connected"
    // when Stripe was previously confirmed to have charges enabled.
    const integrationData = {
      id: "int-1",
      isActive: true,
      provider: "stripe" as const,
      accountId: "acct_live_123",
      accountName: "Live Shop",
      settings: {
        liveMode: true,
        webhookEndpointId: "we_123",
        chargesEnabled: true,  // Cached from last successful sync
        payoutsEnabled: true,  // Cached from last successful sync
      },
    };
    mockGetIntegration.mockResolvedValue(integrationData);
    mockGetIntegrationWithTokens.mockResolvedValue({
      integration: integrationData,
      accessToken: "sk_live_123",
      refreshToken: "pk_live_456",
    });
    // Simulate Stripe API failure
    mockAccountsRetrieve.mockRejectedValue(new Error("Network error"));

    const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeSettings("org-1");

    // Must return connected with cached values — not false
    expect(result).toMatchObject({
      connected: true,
      liveMode: true,
      chargesEnabled: true,  // Falls back to cached settings
      payoutsEnabled: true,  // Falls back to cached settings
    });
  });

  it("returns chargesEnabled false when API fails and no cached value exists", async () => {
    const integrationData = {
      id: "int-1",
      isActive: true,
      provider: "stripe" as const,
      accountId: "acct_123",
      accountName: "Shop",
      settings: { liveMode: true },
    };
    mockGetIntegration.mockResolvedValue(integrationData);
    mockGetIntegrationWithTokens.mockResolvedValue({
      integration: integrationData,
      accessToken: "sk_live_123",
      refreshToken: "pk_live_456",
    });
    mockAccountsRetrieve.mockRejectedValue(new Error("Network error"));

    const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeSettings("org-1");

    expect(result).toMatchObject({ connected: true, chargesEnabled: false, payoutsEnabled: false });
  });

  // KAN-656: webhookConfigured checks both webhookEndpointId and webhookSecret
  describe("webhookConfigured field", () => {
    const makeIntegration = (settings: Record<string, unknown>) => ({
      id: "int-1",
      isActive: true,
      provider: "stripe" as const,
      accountId: "acct_123",
      accountName: "Shop",
      settings,
    });

    const setupMocks = (settings: Record<string, unknown>) => {
      const data = makeIntegration(settings);
      mockGetIntegration.mockResolvedValue(data);
      mockGetIntegrationWithTokens.mockResolvedValue({
        integration: data,
        accessToken: "sk_test_123",
        refreshToken: "pk_test_456",
      });
      mockAccountsRetrieve.mockResolvedValue({
        id: "acct_123",
        charges_enabled: true,
        payouts_enabled: true,
      });
    };

    it("returns true when only webhookEndpointId is set", async () => {
      setupMocks({ webhookEndpointId: "we_123" });
      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");
      expect(result?.webhookConfigured).toBe(true);
    });

    it("returns true when only webhookSecret is set", async () => {
      setupMocks({ webhookSecret: "whsec_123" });
      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");
      expect(result?.webhookConfigured).toBe(true);
    });

    it("returns true when both webhookEndpointId and webhookSecret are set", async () => {
      setupMocks({ webhookEndpointId: "we_123", webhookSecret: "whsec_123" });
      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");
      expect(result?.webhookConfigured).toBe(true);
    });

    it("returns false when neither webhookEndpointId nor webhookSecret is set", async () => {
      setupMocks({});
      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");
      expect(result?.webhookConfigured).toBe(false);
    });
  });
});

// KAN-656: charges_enabled/payouts_enabled ?? true (nullish coalescing)
// Tests for getStripeAccountInfo — when Stripe API returns undefined for capabilities,
// they should default to true (not false as with the old || false pattern).
describe("getStripeAccountInfo — KAN-656 nullish coalescing fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIntegration.mockResolvedValue(null);
    mockGetIntegrationWithTokens.mockResolvedValue(null);
    mockLogSyncOperation.mockResolvedValue(undefined);
    mockUpdateLastSync.mockResolvedValue(undefined);
  });

  const setupForAccountInfo = () => {
    const integrationData = {
      id: "int-1",
      isActive: true,
      provider: "stripe" as const,
      accountId: "acct_123",
      accountName: "Shop",
      settings: { liveMode: false },
    };
    mockGetIntegration.mockResolvedValue(integrationData);
    mockGetIntegrationWithTokens.mockResolvedValue({
      integration: integrationData,
      accessToken: "sk_test_123",
      refreshToken: "pk_test_456",
    });
  };

  it("defaults chargesEnabled to true when Stripe returns undefined", async () => {
    setupForAccountInfo();
    mockAccountsRetrieve.mockResolvedValue({
      id: "acct_123",
      charges_enabled: undefined,
      payouts_enabled: undefined,
    });

    const { getStripeAccountInfo } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeAccountInfo("org-1");

    expect(result?.chargesEnabled).toBe(true);
    expect(result?.payoutsEnabled).toBe(true);
  });

  it("preserves explicit false for chargesEnabled", async () => {
    setupForAccountInfo();
    mockAccountsRetrieve.mockResolvedValue({
      id: "acct_123",
      charges_enabled: false,
      payouts_enabled: false,
    });

    const { getStripeAccountInfo } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeAccountInfo("org-1");

    expect(result?.chargesEnabled).toBe(false);
    expect(result?.payoutsEnabled).toBe(false);
  });

  it("preserves explicit true for chargesEnabled", async () => {
    setupForAccountInfo();
    mockAccountsRetrieve.mockResolvedValue({
      id: "acct_123",
      charges_enabled: true,
      payouts_enabled: true,
    });

    const { getStripeAccountInfo } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeAccountInfo("org-1");

    expect(result?.chargesEnabled).toBe(true);
    expect(result?.payoutsEnabled).toBe(true);
  });

  it("handles mixed: chargesEnabled true, payoutsEnabled undefined", async () => {
    setupForAccountInfo();
    mockAccountsRetrieve.mockResolvedValue({
      id: "acct_123",
      charges_enabled: true,
      payouts_enabled: undefined,
    });

    const { getStripeAccountInfo } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeAccountInfo("org-1");

    expect(result?.chargesEnabled).toBe(true);
    expect(result?.payoutsEnabled).toBe(true);
  });

  it("returns null when no Stripe client exists", async () => {
    // No integration set up
    const { getStripeAccountInfo } = await import("../../../../lib/integrations/stripe.server");
    const result = await getStripeAccountInfo("org-no-stripe");
    expect(result).toBeNull();
  });
});

