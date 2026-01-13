import { describe, it, expect } from "vitest";
import {
  isAdminSubdomain,
  getSubdomainFromRequest,
} from "../../../../lib/auth/org-context.server";

describe("org-context.server - admin subdomain helpers", () => {
  describe("isAdminSubdomain", () => {
    it("returns true for admin.localhost", () => {
      const request = new Request("http://admin.localhost:5173/dashboard");
      expect(isAdminSubdomain(request)).toBe(true);
    });

    it("returns true for admin.divestreams.com", () => {
      const request = new Request("https://admin.divestreams.com/dashboard");
      expect(isAdminSubdomain(request)).toBe(true);
    });

    it("returns false for tenant subdomain on localhost", () => {
      const request = new Request("http://demo.localhost:5173/app");
      expect(isAdminSubdomain(request)).toBe(false);
    });

    it("returns false for tenant subdomain in production", () => {
      const request = new Request("https://demo.divestreams.com/app");
      expect(isAdminSubdomain(request)).toBe(false);
    });

    it("returns false for main domain", () => {
      const request = new Request("https://divestreams.com");
      expect(isAdminSubdomain(request)).toBe(false);
    });

    it("returns false for www subdomain", () => {
      const request = new Request("https://www.divestreams.com");
      expect(isAdminSubdomain(request)).toBe(false);
    });
  });

  describe("getSubdomainFromRequest", () => {
    it("extracts subdomain from localhost URL", () => {
      const request = new Request("http://demo.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("demo");
    });

    it("extracts subdomain from production URL", () => {
      const request = new Request("https://testshop.divestreams.com/app");
      expect(getSubdomainFromRequest(request)).toBe("testshop");
    });

    it("returns null for plain localhost", () => {
      const request = new Request("http://localhost:5173");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for main domain without subdomain", () => {
      const request = new Request("https://divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("returns null for www subdomain", () => {
      const request = new Request("https://www.divestreams.com");
      expect(getSubdomainFromRequest(request)).toBeNull();
    });

    it("handles admin subdomain", () => {
      const request = new Request("http://admin.localhost:5173/dashboard");
      expect(getSubdomainFromRequest(request)).toBe("admin");
    });

    it("handles subdomains with hyphens", () => {
      const request = new Request("http://my-dive-shop.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("my-dive-shop");
    });

    it("handles subdomains with numbers", () => {
      const request = new Request("http://shop123.localhost:5173/app");
      expect(getSubdomainFromRequest(request)).toBe("shop123");
    });
  });
});
