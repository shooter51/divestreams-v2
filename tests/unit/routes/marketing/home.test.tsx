/**
 * Marketing Home Route Tests
 *
 * Tests the home marketing page with admin subdomain redirect logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/marketing/home";

// Mock modules
vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  getPlatformContext: vi.fn(),
}));

// Import mocked modules
import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";
import { getPlatformContext } from "../../../../lib/auth/platform-context.server";

describe("Route: marketing/home.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "DiveStreams - Dive Shop Management Software" },
        {
          name: "description",
          content: "Modern booking and management software for dive shops worldwide. Streamline operations, manage customers, and grow your business.",
        },
      ]);
    });
  });

  describe("loader", () => {
    it("should return null when not on admin subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com");
      (isAdminSubdomain as any).mockReturnValue(false);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(result).toBeNull();
    });

    it("should redirect to /dashboard when on admin subdomain with platform context", async () => {
      // Arrange
      const request = new Request("http://admin.test.com");
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue({ userId: "user-123" });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("/dashboard");
      }

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(getPlatformContext).toHaveBeenCalledWith(request);
    });

    it("should redirect to /login when on admin subdomain without platform context", async () => {
      // Arrange
      const request = new Request("http://admin.test.com");
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("/login");
      }

      expect(isAdminSubdomain).toHaveBeenCalledWith(request);
      expect(getPlatformContext).toHaveBeenCalledWith(request);
    });
  });
});
