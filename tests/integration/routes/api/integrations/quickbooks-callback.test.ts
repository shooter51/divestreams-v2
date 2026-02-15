import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/integrations/quickbooks/callback";

/**
 * Integration tests for api/integrations/quickbooks/callback route
 * Tests QuickBooks OAuth callback handling
 */

vi.mock("../../../../../lib/integrations/quickbooks.server", () => ({
  parseOAuthState: vi.fn(),
  handleQuickBooksCallback: vi.fn(),
}));

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

import {
  parseOAuthState,
  handleQuickBooksCallback,
} from "../../../../../lib/integrations/quickbooks.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

describe("api/integrations/quickbooks/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromRequest as Mock).mockReturnValue("test-org");
  });

  it("redirects with error when OAuth error parameter is present", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?error=access_denied"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
    expect(response.headers.get("Location")).toContain("declined");
  });

  it("redirects with error when code is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?state=test&realmId=123"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with error when state is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?code=test&realmId=123"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with error when realmId is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?code=test&state=test"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with success when callback succeeds", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleQuickBooksCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?code=auth&state=valid&realmId=realm123"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("success=");
    expect(response.headers.get("Location")).toContain("QuickBooks");
  });

  it("calls handleQuickBooksCallback with correct parameters", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-abc" });
    (handleQuickBooksCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?code=code123&state=state456&realmId=realm789"
    );
    await loader({ request, params: {}, context: {} } as any);

    expect(handleQuickBooksCallback).toHaveBeenCalledWith(
      "code123",
      "realm789",
      "org-abc",
      "test-org"
    );
  });

  it("redirects with error when callback fails", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleQuickBooksCallback as Mock).mockRejectedValue(new Error("Token exchange failed"));

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/quickbooks/callback?code=c&state=s&realmId=r"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });
});
