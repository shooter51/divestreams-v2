import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/integrations/xero/callback";

/**
 * Integration tests for api/integrations/xero/callback route
 * Tests Xero OAuth callback handling
 */

vi.mock("../../../../../lib/integrations/xero.server", () => ({
  parseOAuthState: vi.fn(),
  handleXeroCallback: vi.fn(),
}));

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

import {
  parseOAuthState,
  handleXeroCallback,
} from "../../../../../lib/integrations/xero.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

describe("api/integrations/xero/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromRequest as Mock).mockReturnValue("test-org");
  });

  it("redirects with error when OAuth error parameter is present", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?error=access_denied"
    );
    const response = await loader({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
    expect(response.headers.get("Location")).toContain("declined");
  });

  it("redirects with error when code is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?state=test"
    );
    const response = await loader({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with error when state is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?code=test"
    );
    const response = await loader({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with success when callback succeeds", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleXeroCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?code=auth-code&state=valid-state"
    );
    const response = await loader({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("success=");
    expect(response.headers.get("Location")).toContain("Xero");
  });

  it("calls handleXeroCallback with correct parameters", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-abc" });
    (handleXeroCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?code=code-xyz&state=state-123"
    );
    await loader({ request, params: {}, context: {} } as unknown);

    expect(handleXeroCallback).toHaveBeenCalledWith("code-xyz", "org-abc", "test-org");
  });

  it("redirects with error when callback fails", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleXeroCallback as Mock).mockRejectedValue(new Error("API connection failed"));

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/xero/callback?code=c&state=s"
    );
    const response = await loader({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });
});
