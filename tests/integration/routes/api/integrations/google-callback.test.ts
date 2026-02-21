import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/integrations/google/callback";

/**
 * Integration tests for api/integrations/google/callback route
 * Tests Google OAuth callback handling
 */

// Mock Google Calendar integration
vi.mock("../../../../../lib/integrations/google-calendar.server", () => ({
  parseOAuthState: vi.fn(),
  handleGoogleCallback: vi.fn(),
}));

// Mock subdomain helper
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

import {
  parseOAuthState,
  handleGoogleCallback,
} from "../../../../../lib/integrations/google-calendar.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

describe("api/integrations/google/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromRequest as Mock).mockReturnValue("test-org");
  });

  describe("GET /api/integrations/google/callback", () => {
    it("redirects with error when OAuth error parameter is present", async () => {
      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?error=access_denied"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/tenant/settings/integrations");
      expect(response.headers.get("Location")).toContain("error=");
      expect(response.headers.get("Location")).toContain("declined");
    });

    it("redirects with error when code parameter is missing", async () => {
      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?state=test-state"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=");
      expect(response.headers.get("Location")).toContain("authorization%20code");
    });

    it("redirects with error when state parameter is missing", async () => {
      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?code=test-code"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=");
      expect(response.headers.get("Location")).toContain("state%20parameter");
    });

    it("redirects with success when callback succeeds", async () => {
      (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
      (handleGoogleCallback as Mock).mockResolvedValue(undefined);

      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?code=auth-code-123&state=valid-state"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/tenant/settings/integrations");
      expect(response.headers.get("Location")).toContain("success=");
      expect(response.headers.get("Location")).toContain("Calendar%20connected");
    });

    it("calls handleGoogleCallback with correct parameters", async () => {
      (parseOAuthState as Mock).mockReturnValue({ orgId: "org-abc" });
      (handleGoogleCallback as Mock).mockResolvedValue(undefined);

      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?code=code-xyz&state=state-123"
      );
      await loader({ request, params: {}, context: {} } as unknown);

      expect(handleGoogleCallback).toHaveBeenCalledWith("code-xyz", "org-abc", "test-org");
    });

    it("redirects with error when state parsing fails", async () => {
      (parseOAuthState as Mock).mockReturnValue({ orgId: null });

      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?code=code&state=invalid"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=");
    });

    it("redirects with error when handleGoogleCallback throws", async () => {
      (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
      (handleGoogleCallback as Mock).mockRejectedValue(new Error("Token exchange failed"));

      const request = new Request(
        "https://test-org.divestreams.com/api/integrations/google/callback?code=code&state=state"
      );
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=");
      expect(response.headers.get("Location")).toContain("Token%20exchange%20failed");
    });
  });
});
