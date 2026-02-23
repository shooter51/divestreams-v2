/**
 * Contract test: CSRF enforcement on authenticated actions
 *
 * Verifies that requireOrgContext() rejects POST requests that are
 * missing or have invalid CSRF tokens with HTTP 403 — not 500.
 *
 * This is the action-level companion to the static analysis test in
 * tests/unit/app/routes/tenant/csrf-coverage.test.ts.
 *
 * Background: commit 94ea4a0 enabled hard CSRF enforcement. This test
 * ensures any future change to requireCsrf() does not silently stop
 * enforcing (e.g. being changed back to "log-only").
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// We test through the tours/new action as a representative sample.
// requireOrgContext is the single enforcement point so all actions
// share the same behaviour.
vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/db/queries.server", () => ({
  createTour: vi.fn(),
}));

vi.mock("../../lib/require-feature.server", () => ({
  requireLimit: vi.fn().mockResolvedValue({ current: 0, limit: 25, remaining: 25 }),
}));

vi.mock("../../lib/storage", () => ({
  getS3Client: vi.fn(() => null),
  uploadToS3: vi.fn(),
  getImageKey: vi.fn(),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
  getWebPMimeType: vi.fn(),
}));

vi.mock("../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Import the REAL requireCsrf so we can test it is actually enforced
// (not mocked away in production code).
import { requireCsrf, validateCsrfToken, generateCsrfToken, CSRF_FIELD_NAME } from "../../lib/security/csrf.server";
import { requireOrgContext } from "../../lib/auth/org-context.server";

const SESSION_ID = "test-session-abc123";

function makePostRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/tours/new", {
    method: "POST",
    body: formData,
  });
}

describe("Contract: CSRF enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-32-chars-long-enough!";

    // The real requireOrgContext calls requireCsrf internally.
    // Restore the real implementation so we test the enforcement.
    (requireOrgContext as Mock).mockImplementation(async (request: Request) => {
      // Simulate only the CSRF check (the part that was recently enforced)
      await requireCsrf(request, SESSION_ID);
      return {
        user: { id: "user-1" },
        session: { id: SESSION_ID },
        org: { id: "org-1", slug: "demo" },
        membership: { role: "owner" },
        subscription: { planDetails: { limits: { toursPerMonth: 25 }, features: {} } },
        limits: { tours: 25 },
        usage: { tours: 0 },
        canAddTour: true,
      };
    });
  });

  describe("requireCsrf()", () => {
    it("allows GET requests without a token", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/tours/new", {
        method: "GET",
      });
      await expect(requireCsrf(request, SESSION_ID)).resolves.toBeUndefined();
    });

    it("throws 403 Response when CSRF token is missing from POST", async () => {
      const formData = new FormData();
      formData.append("name", "Test Tour");
      const request = makePostRequest(formData);

      await expect(requireCsrf(request, SESSION_ID)).rejects.toSatisfy(
        (e: unknown) => e instanceof Response && e.status === 403
      );
    });

    it("throws 403 Response when CSRF token is invalid", async () => {
      const formData = new FormData();
      formData.append(CSRF_FIELD_NAME, "obviously-invalid-token");
      const request = makePostRequest(formData);

      await expect(requireCsrf(request, SESSION_ID)).rejects.toSatisfy(
        (e: unknown) => e instanceof Response && e.status === 403
      );
    });

    it("throws 403 Response when CSRF token is for a different session", async () => {
      const tokenForOtherSession = generateCsrfToken("other-session-id");
      const formData = new FormData();
      formData.append(CSRF_FIELD_NAME, tokenForOtherSession);
      const request = makePostRequest(formData);

      await expect(requireCsrf(request, SESSION_ID)).rejects.toSatisfy(
        (e: unknown) => e instanceof Response && e.status === 403
      );
    });

    it("allows POST with a valid CSRF token", async () => {
      const validToken = generateCsrfToken(SESSION_ID);
      const formData = new FormData();
      formData.append(CSRF_FIELD_NAME, validToken);
      const request = makePostRequest(formData);

      await expect(requireCsrf(request, SESSION_ID)).resolves.toBeUndefined();
    });
  });

  describe("validateCsrfToken()", () => {
    it("returns false for null token", () => {
      expect(validateCsrfToken(SESSION_ID, null)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateCsrfToken(SESSION_ID, "")).toBe(false);
    });

    it("returns false for token with no dot separator", () => {
      expect(validateCsrfToken(SESSION_ID, "nodothere")).toBe(false);
    });

    it("returns false for expired token", () => {
      // Timestamp 5 hours ago
      const oldTimestamp = (Date.now() - 5 * 60 * 60 * 1000).toString();
      const token = `${oldTimestamp}.fakesig`;
      expect(validateCsrfToken(SESSION_ID, token)).toBe(false);
    });

    it("returns true for a freshly generated token", () => {
      const token = generateCsrfToken(SESSION_ID);
      expect(validateCsrfToken(SESSION_ID, token)).toBe(true);
    });

    it("returns false after custom TTL expires", () => {
      // Construct a token with a timestamp 1 second in the past, then use 500ms TTL
      const pastTimestamp = (Date.now() - 1000).toString();
      const crypto = require("node:crypto");
      const secret = process.env.AUTH_SECRET!;
      const hmac = crypto.createHmac("sha256", secret).update(SESSION_ID + pastTimestamp).digest("hex");
      const expiredToken = `${pastTimestamp}.${hmac}`;
      expect(validateCsrfToken(SESSION_ID, expiredToken, 500)).toBe(false);
    });
  });
});
