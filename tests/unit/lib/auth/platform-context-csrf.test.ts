/**
 * Security test: CSRF enforcement in requirePlatformContext()
 *
 * Platform admin mutation routes call requirePlatformContext() for auth.
 * Unlike tenant routes (which use requireOrgContext → requireCsrf),
 * admin routes currently have no CSRF enforcement. This test verifies
 * that requirePlatformContext() enforces CSRF on POST/mutation requests.
 *
 * TDD: These tests should FAIL before the fix, and PASS after.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so all mocks are created before module imports
const { mockGetSession, mockLimit, dbChain, resetMocks } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockLimit = vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = mockLimit;

  const resetMocks = () => {
    mockGetSession.mockClear();
    mockLimit.mockClear();
    chain.select.mockReturnValue(chain);
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
  };

  return { mockGetSession, mockLimit, dbChain: chain, resetMocks };
});

vi.mock("../../../../lib/auth/index", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: dbChain,
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn((request: Request) => {
    const url = new URL(request.url);
    return url.hostname === "admin.divestreams.com";
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions, op: "and" })),
}));

vi.mock("react-router", () => ({
  redirect: vi.fn((path: string) => {
    throw new Response(null, { status: 302, headers: { Location: path } });
  }),
}));

import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { generateCsrfToken, CSRF_FIELD_NAME } from "../../../../lib/security/csrf.server";

const SESSION_ID = "platform-session-abc123";

const MOCK_USER = { id: "user-platform-1", name: "Platform Admin", email: "admin@divestreams.com" };
const MOCK_ORG = { id: "org-platform", slug: "platform" };
const MOCK_MEMBERSHIP = { id: "mem-1", userId: MOCK_USER.id, organizationId: MOCK_ORG.id, role: "owner" };

function setupAuthenticatedMocks() {
  process.env.AUTH_SECRET = "test-secret-32-chars-long-enough!";

  mockGetSession.mockResolvedValue({
    session: { id: SESSION_ID },
    user: MOCK_USER,
  });

  // First .limit() call returns org, second returns membership, third returns account
  mockLimit
    .mockResolvedValueOnce([MOCK_ORG])         // org lookup
    .mockResolvedValueOnce([MOCK_MEMBERSHIP])  // membership lookup
    .mockResolvedValueOnce([{ id: "acct-1", userId: MOCK_USER.id, forcePasswordChange: false }]); // account lookup
}

describe("requirePlatformContext() — CSRF enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it("allows GET requests without CSRF token (read-only, safe method)", async () => {
    setupAuthenticatedMocks();

    const request = new Request("https://admin.divestreams.com/dashboard", {
      method: "GET",
    });

    await expect(requirePlatformContext(request)).resolves.toBeDefined();
  });

  it("throws 403 when POST request is missing CSRF token", async () => {
    setupAuthenticatedMocks();

    const formData = new FormData();
    formData.set("name", "Test Plan");

    const request = new Request("https://admin.divestreams.com/plans", {
      method: "POST",
      body: formData,
    });

    let thrownError: unknown;
    try {
      await requirePlatformContext(request);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Response);
    const response = thrownError as Response;
    expect(response.status).toBe(403);
  });

  it("throws 403 when POST request has an invalid CSRF token", async () => {
    setupAuthenticatedMocks();

    const formData = new FormData();
    formData.set("name", "Test Plan");
    formData.set(CSRF_FIELD_NAME, "invalid-csrf-token");

    const request = new Request("https://admin.divestreams.com/plans", {
      method: "POST",
      body: formData,
    });

    let thrownError: unknown;
    try {
      await requirePlatformContext(request);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Response);
    const response = thrownError as Response;
    expect(response.status).toBe(403);
  });

  it("allows POST request with a valid CSRF token", async () => {
    setupAuthenticatedMocks();

    const validToken = generateCsrfToken(SESSION_ID);

    const formData = new FormData();
    formData.set("name", "Test Plan");
    formData.set(CSRF_FIELD_NAME, validToken);

    const request = new Request("https://admin.divestreams.com/plans", {
      method: "POST",
      body: formData,
    });

    const context = await requirePlatformContext(request);

    expect(context).toBeDefined();
    expect(context.user.id).toBe(MOCK_USER.id);
  });
});
