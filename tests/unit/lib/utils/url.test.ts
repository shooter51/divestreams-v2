/**
 * URL Utilities Tests
 *
 * Tests for URL helper functions used in multi-tenant routing.
 * These functions always default to production URLs unless APP_URL is explicitly set.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("URL Utilities", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear module cache to pick up env changes
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("Default behavior (no APP_URL)", () => {
    beforeEach(() => {
      delete process.env.APP_URL;
    });

    it("should return production base domain by default", async () => {
      const { getBaseDomain } = await import("../../../../lib/utils/url");
      expect(getBaseDomain()).toBe("divestreams.com");
    });

    it("should return production app URL by default", async () => {
      const { getAppUrl } = await import("../../../../lib/utils/url");
      expect(getAppUrl()).toBe("https://divestreams.com");
    });

    it("should generate tenant URL with subdomain", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("https://demo.divestreams.com");
    });

    it("should generate tenant URL with path", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo", "/dashboard")).toBe("https://demo.divestreams.com/dashboard");
    });
  });

  describe("Custom APP_URL (non-localhost)", () => {
    beforeEach(() => {
      process.env.APP_URL = "https://staging.divestreams.io";
    });

    it("should use custom APP_URL for base domain", async () => {
      const { getBaseDomain } = await import("../../../../lib/utils/url");
      expect(getBaseDomain()).toBe("staging.divestreams.io");
    });

    it("should use custom APP_URL for app URL", async () => {
      const { getAppUrl } = await import("../../../../lib/utils/url");
      expect(getAppUrl()).toBe("https://staging.divestreams.io");
    });

    it("should generate tenant URL with custom domain", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("https://demo.staging.divestreams.io");
    });
  });

  describe("Localhost rejection", () => {
    it("should reject localhost APP_URL and use production", async () => {
      process.env.APP_URL = "http://localhost:5173";
      const { getAppUrl } = await import("../../../../lib/utils/url");
      expect(getAppUrl()).toBe("https://divestreams.com");
    });

    it("should reject localhost in any form", async () => {
      process.env.APP_URL = "http://localhost:3000";
      const { getBaseDomain } = await import("../../../../lib/utils/url");
      expect(getBaseDomain()).toBe("divestreams.com");
    });

    it("should reject localhost without port", async () => {
      process.env.APP_URL = "http://localhost";
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("https://demo.divestreams.com");
    });

    it("should reject https localhost", async () => {
      process.env.APP_URL = "https://localhost:5173";
      const { getAppUrl } = await import("../../../../lib/utils/url");
      expect(getAppUrl()).toBe("https://divestreams.com");
    });
  });

  describe("getTenantUrl edge cases", () => {
    beforeEach(() => {
      delete process.env.APP_URL;
    });

    it("should handle empty subdomain", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("")).toBe("https://.divestreams.com");
    });

    it("should handle subdomain with hyphens", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("my-dive-shop")).toBe("https://my-dive-shop.divestreams.com");
    });

    it("should handle empty path as default", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("https://demo.divestreams.com");
    });

    it("should handle root path", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo", "/")).toBe("https://demo.divestreams.com/");
    });

    it("should handle nested paths", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo", "/bookings/new")).toBe("https://demo.divestreams.com/bookings/new");
    });

    it("should handle paths with query strings", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo", "/search?q=dive")).toBe("https://demo.divestreams.com/search?q=dive");
    });

    it("should handle numeric subdomain", async () => {
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("shop123")).toBe("https://shop123.divestreams.com");
    });
  });

  describe("Protocol handling", () => {
    it("should preserve https protocol", async () => {
      process.env.APP_URL = "https://custom.domain.com";
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toMatch(/^https:\/\//);
    });

    it("should preserve http protocol if set", async () => {
      process.env.APP_URL = "http://staging.example.com";
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("http://demo.staging.example.com");
    });
  });

  describe("Port handling", () => {
    it("should preserve port in custom URL", async () => {
      process.env.APP_URL = "https://staging.example.com:8443";
      const { getTenantUrl } = await import("../../../../lib/utils/url");
      expect(getTenantUrl("demo")).toBe("https://demo.staging.example.com:8443");
    });

    it("should preserve port in base domain", async () => {
      process.env.APP_URL = "https://staging.example.com:8443";
      const { getBaseDomain } = await import("../../../../lib/utils/url");
      expect(getBaseDomain()).toBe("staging.example.com:8443");
    });
  });
});
