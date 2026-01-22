/**
 * Google Calendar OAuth Callback Route Tests
 *
 * Tests the OAuth callback handler for Google Calendar integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../../app/routes/api/integrations/google/callback";

// Mock modules
vi.mock("../../../../../../lib/integrations/google-calendar.server", () => ({
  parseOAuthState: vi.fn(),
  handleGoogleCallback: vi.fn(),
}));

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

// Import mocked modules
import {
  parseOAuthState,
  handleGoogleCallback,
} from "../../../../../../lib/integrations/google-calendar.server";
import { getSubdomainFromRequest } from "../../../../../../lib/auth/org-context.server";

describe("Route: api/integrations/google/callback.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "http://localhost:5173";
  });

  describe("loader", () => {
    it("should handle OAuth error - access_denied", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?error=access_denied"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?error=You%20declined%20the%20calendar%20access%20request."
      );
    });

    it("should handle OAuth error - other errors", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?error=server_error"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Google%20authorization%20failed%3A%20server_error"
      );
    });

    it("should handle missing code parameter", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?state=some-state"
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
        "http://test.com/api/integrations/google/callback?code=test-code"
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

    it("should handle invalid state - missing orgId", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?code=test-code&state=invalid-state"
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
        "http://test.com/api/integrations/google/callback?code=test-code&state=valid-state"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-123" });
      (handleGoogleCallback as any).mockResolvedValue(undefined);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(parseOAuthState).toHaveBeenCalledWith("valid-state");
      expect(handleGoogleCallback).toHaveBeenCalledWith("test-code", "org-123", undefined);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/app/settings/integrations?success=Google%20Calendar%20connected%20successfully!"
      );
    });

    it("should handle successful callback with subdomain", async () => {
      // Arrange
      const request = new Request(
        "http://test-org.test.com/api/integrations/google/callback?code=test-code&state=valid-state"
      );
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (parseOAuthState as any).mockReturnValue({ orgId: "org-456" });
      (handleGoogleCallback as any).mockResolvedValue(undefined);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(handleGoogleCallback).toHaveBeenCalledWith("test-code", "org-456", "test-org");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://test-org.localhost:5173/app/settings/integrations?success=Google%20Calendar%20connected%20successfully!"
      );
    });

    it("should handle handleGoogleCallback error", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?code=test-code&state=valid-state"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-789" });
      (handleGoogleCallback as any).mockRejectedValue(new Error("Token exchange failed"));

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
        "http://test.com/api/integrations/google/callback?code=test-code&state=valid-state"
      );
      (getSubdomainFromRequest as any).mockReturnValue(null);
      (parseOAuthState as any).mockReturnValue({ orgId: "org-999" });
      (handleGoogleCallback as any).mockRejectedValue("String error");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain(
        "error=Failed%20to%20connect%20Google%20Calendar"
      );
    });

    it("should handle parseOAuthState errors", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/api/integrations/google/callback?code=test-code&state=malformed-state"
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
