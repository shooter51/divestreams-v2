/**
 * Google Calendar OAuth Connect Route Tests
 *
 * Tests the OAuth connection initiation that redirects to Google consent screen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../../app/routes/api/integrations/google/connect";

// Mock modules
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  getSubdomainFromRequest: vi.fn(),
}));

vi.mock("../../../../../../lib/integrations/google-calendar.server", () => ({
  getGoogleAuthUrl: vi.fn(),
}));

// Import mocked modules
import { requireOrgContext, getSubdomainFromRequest } from "../../../../../../lib/auth/org-context.server";
import { getGoogleAuthUrl } from "../../../../../../lib/integrations/google-calendar.server";

describe("Route: api/integrations/google/connect.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to Google auth URL without subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getGoogleAuthUrl as any).mockReturnValue("https://accounts.google.com/o/oauth2/auth?...");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(requireOrgContext).toHaveBeenCalledWith(request);
      expect(getGoogleAuthUrl).toHaveBeenCalledWith("org-123", undefined);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://accounts.google.com/o/oauth2/auth?...");
    });

    it("should redirect to Google auth URL with subdomain", async () => {
      // Arrange
      const request = new Request("http://test-org.test.com/api/integrations/google/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-456", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getGoogleAuthUrl as any).mockReturnValue("https://accounts.google.com/o/oauth2/auth?state=test-org");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getGoogleAuthUrl).toHaveBeenCalledWith("org-456", "test-org");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://accounts.google.com/o/oauth2/auth?state=test-org");
    });

    it("should redirect to integrations page with error when getGoogleAuthUrl throws Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-789", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getGoogleAuthUrl as any).mockImplementation(() => {
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

    it("should redirect to integrations page with generic error when getGoogleAuthUrl throws non-Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/integrations/google/connect");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-999", name: "Test Org" },
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (getGoogleAuthUrl as any).mockImplementation(() => {
        throw "String error";
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?error=Failed%20to%20connect%20to%20Google%20Calendar"
      );
    });
  });
});
