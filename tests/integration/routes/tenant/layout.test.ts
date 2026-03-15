/**
 * Integration tests for tenant layout route loader
 *
 * Verifies that the layout loader correctly resolves org context, generates a
 * CSRF token, derives trial/subscription state, and returns the expected
 * shape consumed by the TenantLayout component (including HelpWidget).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/security/csrf.server", () => ({
  generateCsrfToken: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getBaseDomain: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { generateCsrfToken } from "../../../../lib/security/csrf.server";
import { getBaseDomain } from "../../../../lib/utils/url";
import { loader } from "../../../../app/routes/tenant/layout";

const mockRequireOrgContext = requireOrgContext as Mock;
const mockGenerateCsrfToken = generateCsrfToken as Mock;
const mockGetBaseDomain = getBaseDomain as Mock;

function makeOrgContext(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: {
      status: "active",
      trialEndsAt: null,
      planDetails: {
        displayName: "Standard",
        features: {
          has_tours_bookings: true,
          has_equipment_boats: true,
          has_pos: true,
          has_training: true,
        },
        limits: {
          maxCustomers: 500,
          maxTours: 50,
        },
      },
    },
    ...overrides,
  };
}

describe("tenant/layout loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue(makeOrgContext());
    mockGenerateCsrfToken.mockReturnValue("mock-csrf-token");
    mockGetBaseDomain.mockReturnValue("divestreams.com");
  });

  describe("authentication", () => {
    it("calls requireOrgContext with the incoming request", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      await loader({ request, params: {}, context: {} });
      expect(mockRequireOrgContext).toHaveBeenCalledWith(request);
    });

    it("propagates errors thrown by requireOrgContext", async () => {
      mockRequireOrgContext.mockRejectedValue(new Response(null, { status: 401 }));
      const request = new Request("https://demo.divestreams.com/tenant");
      await expect(loader({ request, params: {}, context: {} })).rejects.toBeInstanceOf(Response);
    });
  });

  describe("CSRF token", () => {
    it("generates a CSRF token from the session id", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      await loader({ request, params: {}, context: {} });
      expect(mockGenerateCsrfToken).toHaveBeenCalledWith("session-1");
    });

    it("includes the generated CSRF token in the loader data", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.csrfToken).toBe("mock-csrf-token");
    });
  });

  describe("tenant data", () => {
    it("returns the org name", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.name).toBe("Demo Dive Shop");
    });

    it("returns the org slug as subdomain", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.subdomain).toBe("demo");
    });

    it("returns the base domain from getBaseDomain()", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.baseDomain).toBe("divestreams.com");
    });

    it("returns subscription status", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.subscriptionStatus).toBe("active");
    });
  });

  describe("trial days calculation", () => {
    it("returns 0 trial days when not trialing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.trialDaysLeft).toBe(0);
    });

    it("returns positive trial days when trial is active", async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      mockRequireOrgContext.mockResolvedValue(
        makeOrgContext({
          subscription: {
            status: "trialing",
            trialEndsAt: futureDate,
            planDetails: null,
          },
        })
      );

      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.trialDaysLeft).toBeGreaterThan(0);
      expect(result.tenant.subscriptionStatus).toBe("trialing");
    });

    it("returns 0 trial days when trial has expired", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockRequireOrgContext.mockResolvedValue(
        makeOrgContext({
          subscription: {
            status: "trialing",
            trialEndsAt: pastDate,
            planDetails: null,
          },
        })
      );

      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.tenant.trialDaysLeft).toBe(0);
    });
  });

  describe("plan features and limits", () => {
    it("includes plan features in the result", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.features).toBeDefined();
    });

    it("includes plan limits in the result", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.limits).toBeDefined();
    });

    it("uses DEFAULT_PLAN_FEATURES when subscription has no planDetails", async () => {
      mockRequireOrgContext.mockResolvedValue(
        makeOrgContext({ subscription: { status: "active", trialEndsAt: null, planDetails: null } })
      );

      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.features).toBeDefined();
    });

    it("returns plan display name", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.planName).toBe("Standard");
    });
  });

  describe("user and membership", () => {
    it("returns user name and email", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.user.name).toBe("Test User");
      expect(result.user.email).toBe("test@example.com");
    });

    it("returns membership role", async () => {
      const request = new Request("https://demo.divestreams.com/tenant");
      const result = await loader({ request, params: {}, context: {} });
      expect(result.membership.role).toBe("owner");
    });
  });
});
