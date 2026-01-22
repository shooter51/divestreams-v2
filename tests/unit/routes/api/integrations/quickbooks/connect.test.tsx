/**
 * QuickBooks OAuth Connect Route Tests
 *
 * Tests the OAuth connection initiation that redirects to QuickBooks authorization page.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../../app/routes/api/integrations/quickbooks/connect";

// Mock modules
vi.mock("../../../../../../lib/integrations/quickbooks.server", () => ({
  getQuickBooksAuthUrl: vi.fn(),
}));

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  getSubdomainFromRequest: vi.fn(),
}));

// Import mocked modules
import { getQuickBooksAuthUrl } from "../../../../../../lib/integrations/quickbooks.server";
import { requireOrgContext, getSubdomainFromRequest } from "../../../../../../lib/auth/org-context.server";

describe("Route: api/integrations/quickbooks/connect.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "http://localhost:5173";
  });

  describe("loader", () => {
    it("should redirect to QuickBooks auth URL without subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/quickbooks/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getQuickBooksAuthUrl as any).mockReturnValue("https://appcenter.intuit.com/app/connect/oauth2?...");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(requireOrgContext).toHaveBeenCalledWith(request);
      expect(getQuickBooksAuthUrl).toHaveBeenCalledWith("org-123", undefined);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://appcenter.intuit.com/app/connect/oauth2?...");
    });

    it("should redirect to QuickBooks auth URL with subdomain", async () => {
      // Arrange
      const request = new Request("http://test-org.test.com/api/integrations/quickbooks/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-456", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getQuickBooksAuthUrl as any).mockReturnValue("https://appcenter.intuit.com/app/connect/oauth2?state=test-org");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getQuickBooksAuthUrl).toHaveBeenCalledWith("org-456", "test-org");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://appcenter.intuit.com/app/connect/oauth2?state=test-org");
    });

    it("should redirect to integrations page with error when getQuickBooksAuthUrl throws Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/quickbooks/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-789", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getQuickBooksAuthUrl as any).mockImplementation(() => {
        throw new Error("OAuth configuration missing");
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?error=OAuth%20configuration%20missing"
      );
    });

    it("should redirect to integrations page with generic error when getQuickBooksAuthUrl throws non-Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/quickbooks/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-999", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getQuickBooksAuthUrl as any).mockImplementation(() => {
        throw "String error";
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?error=Failed%20to%20start%20QuickBooks%20authorization"
      );
    });

    it("should use subdomain in error redirect URL", async () => {
      // Arrange
      const request = new Request("http://test-org.test.com/api/integrations/quickbooks/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-111", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getQuickBooksAuthUrl as any).mockImplementation(() => {
        throw new Error("Configuration error");
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://test-org.localhost:5173/app/settings/integrations?error=Configuration%20error"
      );
    });
  });
});
