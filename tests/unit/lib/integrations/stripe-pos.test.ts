/**
 * Stripe POS Payment Tests
 *
 * Tests for POS payment processing functions including PaymentIntents and Terminal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe SDK
const mockPaymentIntentsCreate = vi.fn();
const mockTerminalLocationsCreate = vi.fn();
const mockTerminalConnectionTokensCreate = vi.fn();
const mockTerminalReadersCreate = vi.fn();
const mockTerminalReadersList = vi.fn();
const mockTerminalReadersDelete = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
      terminal: {
        locations: {
          create: mockTerminalLocationsCreate,
        },
        connectionTokens: {
          create: mockTerminalConnectionTokensCreate,
        },
        readers: {
          create: mockTerminalReadersCreate,
          list: mockTerminalReadersList,
          del: mockTerminalReadersDelete,
        },
      },
    })),
  };
});

// Mock the integrations module
const mockGetIntegration = vi.fn();
const mockGetIntegrationWithTokens = vi.fn();
const mockLogSyncOperation = vi.fn();
const mockUpdateIntegrationSettings = vi.fn();
const mockDecryptToken = vi.fn();

vi.mock("../../../../lib/integrations/index.server", () => ({
  getIntegration: mockGetIntegration,
  getIntegrationWithTokens: mockGetIntegrationWithTokens,
  logSyncOperation: mockLogSyncOperation,
  updateIntegrationSettings: mockUpdateIntegrationSettings,
  decryptToken: mockDecryptToken,
}));

describe("Stripe POS Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockGetIntegration.mockResolvedValue(null);
    mockGetIntegrationWithTokens.mockResolvedValue(null);
    mockDecryptToken.mockImplementation((token: string) => token);
  });

  describe("createPOSPaymentIntent", () => {
    it("exports createPOSPaymentIntent function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.createPOSPaymentIntent).toBe("function");
    });

    it("returns null when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { createPOSPaymentIntent } = await import("../../../../lib/integrations/stripe.server");
      const result = await createPOSPaymentIntent("org-1", 5000);

      expect(result).toBeNull();
    });

    it("returns null when integration is not active", async () => {
      mockGetIntegration.mockResolvedValue({
        id: "int-1",
        isActive: false,
        provider: "stripe",
      });

      const { createPOSPaymentIntent } = await import("../../../../lib/integrations/stripe.server");
      const result = await createPOSPaymentIntent("org-1", 5000);

      expect(result).toBeNull();
    });

    it("accepts amount and metadata parameters", async () => {
      // This test verifies the function signature - actual Stripe calls require integration testing
      const { createPOSPaymentIntent } = await import("../../../../lib/integrations/stripe.server");

      // With no integration, should return null
      mockGetIntegration.mockResolvedValue(null);
      const result = await createPOSPaymentIntent("org-1", 5000, {
        customerId: "cust-1",
        receiptNumber: "R-001",
        description: "POS transaction",
      });

      expect(result).toBeNull();
    });
  });

  describe("getStripePublishableKey", () => {
    it("exports getStripePublishableKey function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.getStripePublishableKey).toBe("function");
    });

    it("returns null when no integration exists", async () => {
      mockGetIntegrationWithTokens.mockResolvedValue(null);

      const { getStripePublishableKey } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripePublishableKey("org-1");

      expect(result).toBeNull();
    });

    it("returns publishable key from refreshToken field", async () => {
      mockGetIntegrationWithTokens.mockResolvedValue({
        accessToken: "sk_test_123",
        refreshToken: "pk_test_456",
      });

      const { getStripePublishableKey } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripePublishableKey("org-1");

      expect(result).toBe("pk_test_456");
    });
  });

  describe("getStripeSettings", () => {
    it("exports getStripeSettings function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.getStripeSettings).toBe("function");
    });

    it("returns null when no integration exists", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");

      expect(result).toBeNull();
    });

    it("returns null when integration is not active", async () => {
      mockGetIntegration.mockResolvedValue({
        id: "int-1",
        isActive: false,
        provider: "stripe",
      });

      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");

      expect(result).toBeNull();
    });

    it("returns settings when integration is active", async () => {
      mockGetIntegration.mockResolvedValue({
        id: "int-1",
        isActive: true,
        provider: "stripe",
        accountId: "acct_123",
        accountName: "Demo Shop",
        settings: {
          liveMode: false,
          webhookEndpointId: "we_123",
          chargesEnabled: true,
          payoutsEnabled: true,
        },
      });
      mockGetIntegrationWithTokens.mockResolvedValue({
        accessToken: "sk_test_123",
        refreshToken: "pk_test_456",
      });

      const { getStripeSettings } = await import("../../../../lib/integrations/stripe.server");
      const result = await getStripeSettings("org-1");

      expect(result).toMatchObject({
        connected: true,
        accountId: "acct_123",
        accountName: "Demo Shop",
        liveMode: false,
        webhookConfigured: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      });
    });
  });

  describe("createTerminalConnectionToken", () => {
    it("exports createTerminalConnectionToken function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.createTerminalConnectionToken).toBe("function");
    });

    it("returns null when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { createTerminalConnectionToken } = await import("../../../../lib/integrations/stripe.server");
      const result = await createTerminalConnectionToken("org-1");

      expect(result).toBeNull();
    });
  });

  describe("getOrCreateTerminalLocation", () => {
    it("exports getOrCreateTerminalLocation function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.getOrCreateTerminalLocation).toBe("function");
    });

    it("returns null when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { getOrCreateTerminalLocation } = await import("../../../../lib/integrations/stripe.server");
      const result = await getOrCreateTerminalLocation("org-1");

      expect(result).toBeNull();
    });

    it("accepts location info parameters", async () => {
      // This test verifies the function signature - actual Stripe calls require integration testing
      const { getOrCreateTerminalLocation } = await import("../../../../lib/integrations/stripe.server");

      // With no integration, should return null
      mockGetIntegration.mockResolvedValue(null);
      const result = await getOrCreateTerminalLocation("org-1", {
        displayName: "Test Location",
        address: {
          city: "Miami",
          country: "US",
          line1: "123 Dive St",
          postalCode: "33101",
          state: "FL",
        },
      });

      expect(result).toBeNull();
    });
  });

  describe("registerTerminalReader", () => {
    it("exports registerTerminalReader function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.registerTerminalReader).toBe("function");
    });

    it("returns null when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { registerTerminalReader } = await import("../../../../lib/integrations/stripe.server");
      const result = await registerTerminalReader("org-1", "simulated-wpe");

      expect(result).toBeNull();
    });
  });

  describe("listTerminalReaders", () => {
    it("exports listTerminalReaders function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.listTerminalReaders).toBe("function");
    });

    it("returns null when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { listTerminalReaders } = await import("../../../../lib/integrations/stripe.server");
      const result = await listTerminalReaders("org-1");

      expect(result).toBeNull();
    });
  });

  describe("deleteTerminalReader", () => {
    it("exports deleteTerminalReader function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.deleteTerminalReader).toBe("function");
    });

    it("returns error when Stripe is not connected", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { deleteTerminalReader } = await import("../../../../lib/integrations/stripe.server");
      const result = await deleteTerminalReader("org-1", "tmr_123");

      expect(result).toEqual({ success: false, error: "Stripe not connected" });
    });
  });

  describe("isStripeTestMode", () => {
    it("exports isStripeTestMode function", async () => {
      const stripeModule = await import("../../../../lib/integrations/stripe.server");
      expect(typeof stripeModule.isStripeTestMode).toBe("function");
    });

    it("returns null when no integration exists", async () => {
      mockGetIntegration.mockResolvedValue(null);

      const { isStripeTestMode } = await import("../../../../lib/integrations/stripe.server");
      const result = await isStripeTestMode("org-1");

      expect(result).toBeNull();
    });

    it("returns true when liveMode is false", async () => {
      mockGetIntegration.mockResolvedValue({
        id: "int-1",
        isActive: true,
        provider: "stripe",
        settings: {
          liveMode: false,
        },
      });

      const { isStripeTestMode } = await import("../../../../lib/integrations/stripe.server");
      const result = await isStripeTestMode("org-1");

      expect(result).toBe(true);
    });

    it("returns false when liveMode is true", async () => {
      mockGetIntegration.mockResolvedValue({
        id: "int-1",
        isActive: true,
        provider: "stripe",
        settings: {
          liveMode: true,
        },
      });

      const { isStripeTestMode } = await import("../../../../lib/integrations/stripe.server");
      const result = await isStripeTestMode("org-1");

      expect(result).toBe(false);
    });
  });
});
