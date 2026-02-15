import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/integrations/mailchimp/callback";

/**
 * Integration tests for api/integrations/mailchimp/callback route
 * Tests Mailchimp OAuth callback handling
 */

vi.mock("../../../../../lib/integrations/mailchimp.server", () => ({
  parseOAuthState: vi.fn(),
  handleMailchimpCallback: vi.fn(),
}));

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

import {
  parseOAuthState,
  handleMailchimpCallback,
} from "../../../../../lib/integrations/mailchimp.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

describe("api/integrations/mailchimp/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromRequest as Mock).mockReturnValue("test-org");
  });

  it("redirects with error when OAuth error parameter is present", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?error=access_denied"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
    expect(response.headers.get("Location")).toContain("declined");
  });

  it("redirects with error when code is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?state=test"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with error when state is missing", async () => {
    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?code=test"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });

  it("redirects with success when callback succeeds", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleMailchimpCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?code=auth-code&state=valid-state"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("success=");
    expect(response.headers.get("Location")).toContain("Mailchimp");
  });

  it("calls handleMailchimpCallback with correct parameters", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-abc" });
    (handleMailchimpCallback as Mock).mockResolvedValue(undefined);

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?code=code-xyz&state=state-123"
    );
    await loader({ request, params: {}, context: {} } as any);

    expect(handleMailchimpCallback).toHaveBeenCalledWith("code-xyz", "org-abc", "test-org");
  });

  it("redirects with error when callback fails", async () => {
    (parseOAuthState as Mock).mockReturnValue({ orgId: "org-123" });
    (handleMailchimpCallback as Mock).mockRejectedValue(new Error("Invalid API key"));

    const request = new Request(
      "https://test-org.divestreams.com/api/integrations/mailchimp/callback?code=c&state=s"
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=");
  });
});
