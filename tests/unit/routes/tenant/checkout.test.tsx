/**
 * Tenant Checkout Route Tests
 *
 * Tests the checkout redirect handler for Stripe payment flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/tenant/checkout";

// Mock auth
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Import mocked modules
import { requireOrgContext } from "../../../../lib/auth/org-context.server";

describe("Route: tenant/checkout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to billing with success param when session_id present", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?session_id=cs_test_123");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing?success=true");
    });

    it("should redirect to billing with success param when success=true", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?success=true");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing?success=true");
    });

    it("should redirect to billing with success param when both session_id and success present", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?session_id=cs_test_123&success=true");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing?success=true");
    });

    it("should redirect to billing with canceled param when canceled=true", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?canceled=true");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing?canceled=true");
    });

    it("should redirect to billing without params when no status params present", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing");
    });

    it("should prioritize success over canceled when both present", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?success=true&canceled=true");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing?success=true");
    });

    it("should handle success=false as non-success", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?success=false");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing");
    });

    it("should handle canceled=false as non-canceled", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/checkout?canceled=false");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("http://localhost/app/settings/billing");
    });
  });
});
