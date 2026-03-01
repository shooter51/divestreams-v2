/**
 * Contract tests for tenant layout loader (KAN-677)
 *
 * Validates the API response shape of the tenant layout loader,
 * ensuring the user object includes email for sidebar display.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/utils/url", () => ({
  getBaseDomain: vi.fn(() => "divestreams.com"),
}));

vi.mock("../../lib/security/csrf.server", () => ({
  generateCsrfToken: vi.fn(() => "csrf-token"),
}));

import { loader } from "../../app/routes/tenant/layout";
import { requireOrgContext } from "../../lib/auth/org-context.server";

function loaderArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof loader>[0];
}

describe("Contract: Tenant Layout Loader Response", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: {
      status: "active",
      trialEndsAt: null,
      planDetails: {
        displayName: "Free",
        features: {},
        limits: {},
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  it("returns an object with the expected top-level keys", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result).toHaveProperty("tenant");
    expect(result).toHaveProperty("user");
    expect(result).toHaveProperty("membership");
    expect(result).toHaveProperty("features");
    expect(result).toHaveProperty("limits");
    expect(result).toHaveProperty("planName");
    expect(result).toHaveProperty("csrfToken");
  });

  it("user object contains name and email (both strings)", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result.user).toEqual({
      name: expect.any(String),
      email: expect.any(String),
    });
    expect(Object.keys(result.user)).toHaveLength(2);
  });

  it("user.email matches the authenticated user email", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result.user.email).toBe("test@example.com");
    expect(result.user.name).toBe("Test User");
  });

  it("membership object contains role (string)", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result.membership).toEqual({
      role: expect.any(String),
    });
  });

  it("tenant object has expected shape", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result.tenant).toEqual({
      name: expect.any(String),
      subdomain: expect.any(String),
      subscriptionStatus: expect.any(String),
      trialDaysLeft: expect.any(Number),
      baseDomain: expect.any(String),
    });
  });

  it("does not expose user.id or other sensitive fields", async () => {
    const request = new Request("https://demo.divestreams.com/tenant");
    const result = await loader(loaderArgs(request));

    expect(result.user).not.toHaveProperty("id");
    expect(result.user).not.toHaveProperty("password");
    expect(result.user).not.toHaveProperty("hashedPassword");
  });
});
