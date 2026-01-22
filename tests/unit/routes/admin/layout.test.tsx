/**
 * Admin Layout Route Tests
 *
 * Tests the admin layout route loader and authentication logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/admin/layout";

// Mock modules
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "https://divestreams.com"),
}));

// Import mocked modules
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";

describe("Route: admin/layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default successful state
    (isAdminSubdomain as any).mockReturnValue(true);
    (requirePlatformContext as any).mockResolvedValue({
      user: {
        name: "Admin User",
        email: "admin@platform.com",
      },
      isOwner: true,
      isAdmin: true,
    });
  });

  describe("loader", () => {
    it("should require admin subdomain", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      // Act
      await loader({ request, params: {}, context: {} });

      // Assert
      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
    });

    it("should redirect when not on admin subdomain", async () => {
      // Arrange
      (isAdminSubdomain as any).mockReturnValue(false);
      const request = new Request("http://tenant.divestreams.com");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("https://divestreams.com");
      }
    });

    it("should require platform context authentication", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      // Act
      await loader({ request, params: {}, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should return user data when authenticated", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");
      (requirePlatformContext as any).mockResolvedValue({
        user: {
          name: "Test Admin",
          email: "test@admin.com",
        },
        isOwner: false,
        isAdmin: true,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        user: {
          name: "Test Admin",
          email: "test@admin.com",
        },
        isOwner: false,
        isAdmin: true,
      });
    });

    it("should handle owner user", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");
      (requirePlatformContext as any).mockResolvedValue({
        user: {
          name: "Owner User",
          email: "owner@platform.com",
        },
        isOwner: true,
        isAdmin: true,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.isOwner).toBe(true);
      expect(result.isAdmin).toBe(true);
    });

    it("should handle non-owner admin user", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");
      (requirePlatformContext as any).mockResolvedValue({
        user: {
          name: "Admin User",
          email: "admin@platform.com",
        },
        isOwner: false,
        isAdmin: true,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.isOwner).toBe(false);
      expect(result.isAdmin).toBe(true);
    });

    it("should handle authentication failure", async () => {
      // Arrange
      (requirePlatformContext as any).mockRejectedValue(
        new Error("Unauthorized")
      );
      const request = new Request("http://admin.divestreams.com");

      // Act & Assert
      await expect(
        loader({ request, params: {}, context: {} })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with minimal data", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");
      (requirePlatformContext as any).mockResolvedValue({
        user: {
          name: "",
          email: "user@example.com",
        },
        isOwner: false,
        isAdmin: false,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.user.name).toBe("");
      expect(result.user.email).toBe("user@example.com");
      expect(result.isOwner).toBe(false);
      expect(result.isAdmin).toBe(false);
    });

    it("should handle different admin subdomain variations", async () => {
      // Arrange
      const requests = [
        "http://admin.divestreams.com",
        "https://admin.divestreams.com",
        "http://admin.divestreams.com/dashboard",
      ];

      // Act & Assert
      for (const url of requests) {
        const request = new Request(url);
        const result = await loader({ request, params: {}, context: {} });
        expect(result.user).toBeDefined();
        expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      }
    });
  });
});
