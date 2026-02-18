/**
 * Unit tests for tenant layout route (KAN-677)
 *
 * Validates that the layout loader returns user email and that
 * the sidebar user section displays name, email, and role.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies before importing the loader
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getBaseDomain: vi.fn(() => "divestreams.com"),
}));

vi.mock("../../../../../lib/security/csrf.server", () => ({
  generateCsrfToken: vi.fn(() => "mock-csrf-token"),
}));

import { loader } from "../../../../../app/routes/tenant/layout";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";

function loaderArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof loader>[0];
}

describe("tenant/layout loader", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Jane Diver", email: "jane@diveshop.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Deep Blue Dive Shop", slug: "deepblue" },
    membership: { role: "owner" },
    subscription: {
      status: "active",
      trialEndsAt: null,
      planDetails: {
        displayName: "Pro",
        features: { has_tours_bookings: true, has_equipment_boats: true },
        limits: { customers: 500 },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("user email in loader response", () => {
    it("returns user.email in the loader data", async () => {
      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe("jane@diveshop.com");
    });

    it("returns user.name alongside email", async () => {
      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.user.name).toBe("Jane Diver");
      expect(result.user.email).toBe("jane@diveshop.com");
    });

    it("returns membership.role", async () => {
      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.membership.role).toBe("owner");
    });

    it("includes email for staff role users", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        user: { id: "user-2", name: "Staff User", email: "staff@diveshop.com" },
        membership: { role: "staff" },
      });

      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.user.email).toBe("staff@diveshop.com");
      expect(result.membership.role).toBe("staff");
    });

    it("includes email for admin role users", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        user: { id: "user-3", name: "Admin User", email: "admin@diveshop.com" },
        membership: { role: "admin" },
      });

      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.user.email).toBe("admin@diveshop.com");
      expect(result.membership.role).toBe("admin");
    });
  });

  describe("tenant and subscription data", () => {
    it("returns tenant info with baseDomain", async () => {
      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.tenant.name).toBe("Deep Blue Dive Shop");
      expect(result.tenant.subdomain).toBe("deepblue");
      expect(result.tenant.baseDomain).toBe("divestreams.com");
    });

    it("returns CSRF token", async () => {
      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.csrfToken).toBe("mock-csrf-token");
    });

    it("calculates trial days left when trialing", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        subscription: {
          ...mockOrgContext.subscription,
          status: "trialing",
          trialEndsAt: futureDate.toISOString(),
        },
      });

      const request = new Request("https://deepblue.divestreams.com/tenant");
      const result = await loader(loaderArgs(request));

      expect(result.tenant.subscriptionStatus).toBe("trialing");
      expect(result.tenant.trialDaysLeft).toBeGreaterThanOrEqual(6);
      expect(result.tenant.trialDaysLeft).toBeLessThanOrEqual(8);
    });
  });
});
