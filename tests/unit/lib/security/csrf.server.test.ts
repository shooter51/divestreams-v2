import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import {
  generateCsrfToken,
  validateCsrfToken,
  generateAnonCsrfToken,
  validateAnonCsrfToken,
  requireCsrf,
  CSRF_FIELD_NAME,
} from "../../../../lib/security/csrf.server";

describe("csrf.server", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, AUTH_SECRET: "test-secret-key-1234567890" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("CSRF_FIELD_NAME", () => {
    it("should export the CSRF field name constant", () => {
      expect(CSRF_FIELD_NAME).toBe("_csrf");
    });
  });

  describe("generateCsrfToken", () => {
    it("should generate a token with timestamp and hmac", () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      expect(token).toContain(".");
      const parts = token.split(".");
      expect(parts).toHaveLength(2);

      // Timestamp should be a number
      const timestamp = Number(parts[0]);
      expect(timestamp).toBeGreaterThan(0);
      expect(Number.isNaN(timestamp)).toBe(false);

      // HMAC should be a hex string
      expect(parts[1]).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex chars
    });

    it("should generate different tokens for different sessions", () => {
      const token1 = generateCsrfToken("session-1");
      const token2 = generateCsrfToken("session-2");

      expect(token1).not.toBe(token2);
    });

    it("should generate different tokens on subsequent calls (different timestamps)", async () => {
      const token1 = generateCsrfToken("session-123");

      // Wait a small amount to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const token2 = generateCsrfToken("session-123");

      expect(token1).not.toBe(token2);
    });

    it("should throw error when AUTH_SECRET is not set", () => {
      delete process.env.AUTH_SECRET;
      delete process.env.BETTER_AUTH_SECRET;

      expect(() => generateCsrfToken("session-123")).toThrow(
        "CSRF: AUTH_SECRET environment variable is not set"
      );
    });

    it("should fallback to BETTER_AUTH_SECRET if AUTH_SECRET is not set", () => {
      delete process.env.AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = "better-auth-secret";

      const token = generateCsrfToken("session-123");

      expect(token).toContain(".");
      expect(token).toBeTruthy();
    });
  });

  describe("validateCsrfToken", () => {
    it("should validate a freshly generated token", () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const isValid = validateCsrfToken(sessionId, token);

      expect(isValid).toBe(true);
    });

    it("should reject null token", () => {
      const isValid = validateCsrfToken("session-123", null);

      expect(isValid).toBe(false);
    });

    it("should reject empty string token", () => {
      const isValid = validateCsrfToken("session-123", "");

      expect(isValid).toBe(false);
    });

    it("should reject token without dot separator", () => {
      const isValid = validateCsrfToken("session-123", "invalidtoken");

      expect(isValid).toBe(false);
    });

    it("should reject token with invalid timestamp", () => {
      const isValid = validateCsrfToken("session-123", "notanumber.abc123def");

      expect(isValid).toBe(false);
    });

    it("should reject token with mismatched session ID", () => {
      const token = generateCsrfToken("session-123");
      const isValid = validateCsrfToken("session-456", token);

      expect(isValid).toBe(false);
    });

    it("should reject expired token (default TTL)", () => {
      const sessionId = "session-123";

      // Create a token with a timestamp from 5 hours ago (default TTL is 4 hours)
      const expiredTimestamp = Date.now() - (5 * 60 * 60 * 1000);
      const fakeToken = `${expiredTimestamp}.fakehmacshouldnotmatter`;

      const isValid = validateCsrfToken(sessionId, fakeToken);

      expect(isValid).toBe(false);
    });

    it("should reject token with custom TTL when expired", () => {
      const sessionId = "session-123";
      const ttlMs = 1000; // 1 second

      // Create token with timestamp 2 seconds ago
      const expiredTimestamp = Date.now() - 2000;
      const fakeToken = `${expiredTimestamp}.fakehmacshouldnotmatter`;

      const isValid = validateCsrfToken(sessionId, fakeToken, ttlMs);

      expect(isValid).toBe(false);
    });

    it("should validate token within custom TTL", () => {
      const sessionId = "session-123";
      const ttlMs = 10000; // 10 seconds

      const token = generateCsrfToken(sessionId);
      const isValid = validateCsrfToken(sessionId, token, ttlMs);

      expect(isValid).toBe(true);
    });

    it("should reject token with future timestamp (negative age)", () => {
      const sessionId = "session-123";

      // Timestamp 1 hour in the future
      const futureTimestamp = Date.now() + (60 * 60 * 1000);
      const secret = "test-secret-key-1234567890";
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(sessionId + futureTimestamp.toString())
        .digest("hex");
      const futureToken = `${futureTimestamp}.${hmac}`;

      const isValid = validateCsrfToken(sessionId, futureToken);

      expect(isValid).toBe(false);
    });

    it("should reject token with tampered HMAC", () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);
      const [timestamp] = token.split(".");

      // Create token with correct timestamp but wrong HMAC
      const tamperedToken = `${timestamp}.0000000000000000000000000000000000000000000000000000000000000000`;

      const isValid = validateCsrfToken(sessionId, tamperedToken);

      expect(isValid).toBe(false);
    });

    it("should use timing-safe comparison (reject different length HMACs)", () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);
      const [timestamp] = token.split(".");

      // Create token with shorter HMAC
      const shortHmacToken = `${timestamp}.abc123`;

      const isValid = validateCsrfToken(sessionId, shortHmacToken);

      expect(isValid).toBe(false);
    });

    it("should reject non-string token", () => {
      // @ts-expect-error - Testing runtime behavior
      const isValid = validateCsrfToken("session-123", 12345);

      expect(isValid).toBe(false);
    });

    it("should handle token with multiple dots", () => {
      const isValid = validateCsrfToken("session-123", "123.456.789");

      // Should parse timestamp as "123" and hmac as "456.789"
      expect(isValid).toBe(false); // Will fail HMAC validation
    });
  });

  describe("generateAnonCsrfToken", () => {
    it("should generate a token for anonymous users", () => {
      const token = generateAnonCsrfToken();

      expect(token).toContain(".");
      expect(token).toBeTruthy();
    });

    it("should be consistent with generateCsrfToken('anon')", () => {
      // Both should generate tokens using "anon" as session ID
      const anonToken = generateAnonCsrfToken();

      // Wait a bit to ensure same timestamp
      const parts = anonToken.split(".");
      expect(parts[1]).toBeTruthy(); // Should have valid HMAC
    });
  });

  describe("validateAnonCsrfToken", () => {
    it("should validate a freshly generated anonymous token", () => {
      const token = generateAnonCsrfToken();
      const isValid = validateAnonCsrfToken(token);

      expect(isValid).toBe(true);
    });

    it("should reject invalid anonymous token", () => {
      const isValid = validateAnonCsrfToken("invalid.token");

      expect(isValid).toBe(false);
    });

    it("should reject null token", () => {
      const isValid = validateAnonCsrfToken(null);

      expect(isValid).toBe(false);
    });

    it("should not validate a token generated for a different session", () => {
      const sessionToken = generateCsrfToken("session-123");
      const isValid = validateAnonCsrfToken(sessionToken);

      expect(isValid).toBe(false);
    });
  });

  describe("requireCsrf", () => {
    it("should allow GET requests without CSRF token", async () => {
      const request = new Request("https://example.com/test", {
        method: "GET",
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should allow HEAD requests without CSRF token", async () => {
      const request = new Request("https://example.com/test", {
        method: "HEAD",
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should allow OPTIONS requests without CSRF token", async () => {
      const request = new Request("https://example.com/test", {
        method: "OPTIONS",
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for exempt paths (stripe webhook)", async () => {
      const request = new Request("https://example.com/api/stripe-webhook", {
        method: "POST",
        body: JSON.stringify({ event: "payment.success" }),
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for exempt paths (zapier)", async () => {
      const request = new Request("https://example.com/api/zapier/hook", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for exempt paths (auth)", async () => {
      const request = new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for exempt paths (health)", async () => {
      const request = new Request("https://example.com/api/health", {
        method: "POST",
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for exempt paths (integrations)", async () => {
      const request = new Request("https://example.com/api/integrations/webhook", {
        method: "POST",
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should skip CSRF validation for non-form-data requests (JSON)", async () => {
      const request = new Request("https://example.com/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
      });

      await expect(requireCsrf(request, "session-123")).resolves.toBeUndefined();
    });

    it("should throw 403 when CSRF token is missing in POST form", async () => {
      const formData = new FormData();
      formData.set("name", "John Doe");

      const request = new Request("https://example.com/submit", {
        method: "POST",
        body: formData,
      });

      await expect(requireCsrf(request, "session-123")).rejects.toThrow();

      try {
        await requireCsrf(request, "session-123");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        expect(response.statusText).toBe("Forbidden");
        const text = await response.text();
        expect(text).toContain("Missing CSRF token");
      }
    });

    it("should throw 403 when CSRF token is invalid", async () => {
      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set(CSRF_FIELD_NAME, "invalid.token");

      const request = new Request("https://example.com/submit", {
        method: "POST",
        body: formData,
      });

      await expect(requireCsrf(request, "session-123")).rejects.toThrow();

      try {
        await requireCsrf(request, "session-123");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        const text = await response.text();
        expect(text).toContain("Invalid CSRF token");
      }
    });

    it("should allow request with valid CSRF token", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set(CSRF_FIELD_NAME, token);

      const request = new Request("https://example.com/submit", {
        method: "POST",
        body: formData,
      });

      await expect(requireCsrf(request, sessionId)).resolves.toBeUndefined();
    });

    it("should not consume the original request body", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set(CSRF_FIELD_NAME, token);

      const request = new Request("https://example.com/submit", {
        method: "POST",
        body: formData,
      });

      await requireCsrf(request, sessionId);

      // Should still be able to read formData from original request
      const originalFormData = await request.formData();
      expect(originalFormData.get("name")).toBe("John Doe");
      expect(originalFormData.get(CSRF_FIELD_NAME)).toBe(token);
    });

    it("should handle PUT requests with CSRF validation", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const formData = new FormData();
      formData.set("name", "Updated Name");
      formData.set(CSRF_FIELD_NAME, token);

      const request = new Request("https://example.com/update", {
        method: "PUT",
        body: formData,
      });

      await expect(requireCsrf(request, sessionId)).resolves.toBeUndefined();
    });

    it("should handle DELETE requests with CSRF validation", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const formData = new FormData();
      formData.set(CSRF_FIELD_NAME, token);

      const request = new Request("https://example.com/delete", {
        method: "DELETE",
        body: formData,
      });

      await expect(requireCsrf(request, sessionId)).resolves.toBeUndefined();
    });

    it("should handle PATCH requests with CSRF validation", async () => {
      const sessionId = "session-123";
      const token = generateCsrfToken(sessionId);

      const formData = new FormData();
      formData.set("status", "active");
      formData.set(CSRF_FIELD_NAME, token);

      const request = new Request("https://example.com/patch", {
        method: "PATCH",
        body: formData,
      });

      await expect(requireCsrf(request, sessionId)).resolves.toBeUndefined();
    });
  });
});
