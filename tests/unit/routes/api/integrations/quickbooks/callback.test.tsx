/**
 * QuickBooks OAuth Callback Route Tests
 *
 * Tests the OAuth callback handler for QuickBooks integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../../app/routes/api/integrations/quickbooks/callback";

// Mock modules
vi.mock("../../../../../../lib/integrations/quickbooks.server", () => ({
  parseOAuthState: vi.fn(),
  handleQuickBooksCallback: vi.fn(),
}));

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

// Import mocked modules
import {
  parseOAuthState,
  handleQuickBooksCallback,
} from "../../../../../../lib/integrations/quickbooks.server";
import { getSubdomainFromRequest } from "../../../../../../lib/auth/org-context.server";

describe("Route: api/integrations/quickbooks/callback.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "http://localhost:5173";
  });

  describe("loader", () => {
    it("should handle OAuth error - access_denied", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?error=access_denied"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?error=You%20declined%20the%20QuickBooks%20access%20request."
      );
    });

    it("should handle OAuth error - with description", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?error=server_error&error_description=Service%20unavailable"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Service%20unavailable"
      );
    });

    it("should handle missing code parameter", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?state=some-state&realmId=123"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Missing%20authorization%20code"
      );
    });

    it("should handle missing state parameter", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&realmId=123"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Missing%20state%20parameter"
      );
    });

    it("should handle missing realmId parameter", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=some-state"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Missing%20company%20ID%20(realmId)"
      );
    });

    it("should handle invalid state - missing orgId", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=invalid-state&realmId=123"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: null });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Invalid%20state%3A%20missing%20organization%20ID"
      );
    });

    it("should handle successful callback without subdomain", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=valid-state&realmId=123456"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-123" });
      (handleQuickBooksCallback as any).mockResolvedValue(undefined);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(parseOAuthState).toHaveBeenCalledWith("valid-state");
      expect(handleQuickBooksCallback).toHaveBeenCalledWith("test-code", "123456", "org-123", undefined);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?success=QuickBooks%20connected%20successfully!"
      );
    });

    it("should handle successful callback with subdomain", async () => {
      // Arrange
      const request = new Request(
        "http://test-org.test.com/api/integrations/quickbooks/callback?code=test-code&state=valid-state&realmId=789"
      );
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (parseOAuthState as any).mockReturnValue({ orgId: "org-456" });
      (handleQuickBooksCallback as any).mockResolvedValue(undefined);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(handleQuickBooksCallback).toHaveBeenCalledWith("test-code", "789", "org-456", "test-org");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://test-org.localhost:5173/app/settings/integrations?success=QuickBooks%20connected%20successfully!"
      );
    });

    it("should handle handleQuickBooksCallback error", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=valid-state&realmId=999"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-789" });
      (handleQuickBooksCallback as any).mockRejectedValue(new Error("Token exchange failed"));

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Token%20exchange%20failed"
      );
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=valid-state&realmId=111"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-999" });
      (handleQuickBooksCallback as any).mockRejectedValue("String error");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Failed%20to%20connect%20QuickBooks"
      );
    });

    it("should handle parseOAuthState errors", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/quickbooks/callback?code=test-code&state=malformed-state&realmId=222"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockImplementation(() => {
        throw new Error("Invalid state format");
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Invalid%20state%20format"
      );
    });
  });
});
