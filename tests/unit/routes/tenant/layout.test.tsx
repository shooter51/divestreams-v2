/**
 * Tenant Layout Route Tests
 *
 * Tests the tenant dashboard layout with trial days calculation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/tenant/layout";

// Mock auth
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Import mocked modules
import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("Route: tenant/layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset system time
    vi.useRealTimers();
  });

  describe("loader", () => {
    it("should load tenant data with active subscription", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "active",
          trialEndsAt: null,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.name).toBe("Dive Shop ABC");
      expect(result.tenant.subdomain).toBe("diveshop");
      expect(result.tenant.subscriptionStatus).toBe("active");
      expect(result.tenant.trialDaysLeft).toBe(0); // No trial
    });

    it("should calculate trial days left correctly", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.subscriptionStatus).toBe("trialing");
      expect(result.tenant.trialDaysLeft).toBe(7);
    });

    it("should round up trial days (even 1 hour remaining counts as 1 day)", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(1); // Rounds up
    });

    it("should return 0 trial days if trial already ended", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(0); // Max(0, negative) = 0
    });

    it("should return 0 trial days if trialEndsAt is null", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "active",
          trialEndsAt: null,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(0);
    });

    it("should default to 'free' status if no subscription", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: null,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.subscriptionStatus).toBe("free");
      expect(result.tenant.trialDaysLeft).toBe(0);
    });

    it("should default to 'free' status if subscription is undefined", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: undefined,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.subscriptionStatus).toBe("free");
      expect(result.tenant.trialDaysLeft).toBe(0);
    });

    it("should handle exactly 24 hours remaining", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Exactly 24 hours
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(1);
    });

    it("should handle large trial period (30 days)", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(30);
    });

    it("should handle different subscription statuses", async () => {
      const statuses = ["active", "canceled", "past_due", "unpaid"];

      for (const status of statuses) {
        // Arrange
        const request = new Request("http://localhost/tenant/dashboard");
        (requireOrgContext as any).mockResolvedValue({
          org: {
            id: "org-123",
            name: "Dive Shop ABC",
            slug: "diveshop",
          },
          subscription: {
            status,
            trialEndsAt: null,
          },
        });

        // Act
        const result = await loader({ request, params: {}, context: {} });

        // Assert
        expect(result.tenant.subscriptionStatus).toBe(status);
      }
    });

    it("should include tenant subdomain and name", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "My Dive Shop",
          slug: "mydiveshop",
        },
        subscription: {
          status: "active",
          trialEndsAt: null,
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.name).toBe("My Dive Shop");
      expect(result.tenant.subdomain).toBe("mydiveshop");
    });

    it("should handle trialEndsAt as string and convert to Date", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/dashboard");
      const trialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const trialEndsAtString = trialEndDate.toISOString();
      (requireOrgContext as any).mockResolvedValue({
        org: {
          id: "org-123",
          name: "Dive Shop ABC",
          slug: "diveshop",
        },
        subscription: {
          status: "trialing",
          trialEndsAt: trialEndsAtString, // String from database
        },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.trialDaysLeft).toBe(5);
    });
  });
});
