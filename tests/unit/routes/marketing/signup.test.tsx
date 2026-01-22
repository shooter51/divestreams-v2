/**
 * Marketing Signup Route Tests
 *
 * Tests the signup form with validation and tenant creation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, action } from "../../../../app/routes/marketing/signup";

// Mock modules
vi.mock("../../../../lib/db/tenant.server", () => ({
  createTenant: vi.fn(),
  isSubdomainAvailable: vi.fn(),
}));

vi.mock("../../../../lib/email/triggers", () => ({
  triggerWelcomeEmail: vi.fn(),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getTenantUrl: vi.fn(),
}));

// Import mocked modules
import { createTenant, isSubdomainAvailable } from "../../../../lib/db/tenant.server";
import { triggerWelcomeEmail } from "../../../../lib/email/triggers";
import { getTenantUrl } from "../../../../lib/utils/url";

describe("Route: marketing/signup.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("meta", () => {
    it("should return title and meta description", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([
        { title: "Start Free Trial - DiveStreams" },
        { name: "description", content: "Start your 14-day free trial of DiveStreams dive shop management software." },
      ]);
    });
  });

  describe("action", () => {
    const mockTenant = {
      id: "tenant-123",
      subdomain: "paradise",
      name: "Paradise Dive Center",
    };

    it("should return validation errors for missing shopName", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "",
          subdomain: "paradise",
          email: "owner@paradise.com",
          phone: "",
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("shopName", "Shop name is required");
    });

    it("should return validation errors for short subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive",
          subdomain: "ab",
          email: "owner@paradise.com",
          phone: "",
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("subdomain", "Subdomain must be at least 3 characters");
    });

    it("should return validation errors for invalid subdomain format", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive",
          subdomain: "Paradise_Dive",
          email: "owner@paradise.com",
          phone: "",
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("subdomain", "Only lowercase letters, numbers, and hyphens allowed");
    });

    it("should return validation errors for reserved subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Admin Dive",
          subdomain: "admin",
          email: "owner@admin.com",
          phone: "",
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("subdomain", "This subdomain is reserved");
    });

    it("should return validation errors for taken subdomain", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive",
          subdomain: "paradise",
          email: "owner@paradise.com",
          phone: "",
        }),
      });
      (isSubdomainAvailable as any).mockResolvedValue(false);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(isSubdomainAvailable).toHaveBeenCalledWith("paradise");
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("subdomain", "This subdomain is already taken");
    });

    it("should return validation errors for invalid email", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive",
          subdomain: "paradise",
          email: "invalid-email",
          phone: "",
        }),
      });
      (isSubdomainAvailable as any).mockResolvedValue(true);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Valid email is required");
    });

    it("should create tenant and redirect on success with welcome email", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive Center",
          subdomain: "paradise",
          email: "owner@paradise.com",
          phone: "+1234567890",
        }),
      });
      (isSubdomainAvailable as any).mockResolvedValue(true);
      (createTenant as any).mockResolvedValue(mockTenant);
      (triggerWelcomeEmail as any).mockResolvedValue(undefined);
      (getTenantUrl as any).mockReturnValue("https://paradise.divestreams.com/app");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(createTenant).toHaveBeenCalledWith({
        subdomain: "paradise",
        name: "Paradise Dive Center",
        email: "owner@paradise.com",
        phone: "+1234567890",
      });
      expect(triggerWelcomeEmail).toHaveBeenCalledWith({
        userEmail: "owner@paradise.com",
        userName: "Paradise Dive Center",
        shopName: "Paradise Dive Center",
        subdomain: "paradise",
        tenantId: "tenant-123",
      });
      expect(getTenantUrl).toHaveBeenCalledWith("paradise", "/app");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("https://paradise.divestreams.com/app");
    });

    it("should create tenant and redirect even if welcome email fails", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive Center",
          subdomain: "paradise",
          email: "owner@paradise.com",
          phone: "",
        }),
      });
      (isSubdomainAvailable as any).mockResolvedValue(true);
      (createTenant as any).mockResolvedValue(mockTenant);
      (triggerWelcomeEmail as any).mockRejectedValue(new Error("Email service unavailable"));
      (getTenantUrl as any).mockReturnValue("https://paradise.divestreams.com/app");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(console.error).toHaveBeenCalledWith(
        "Failed to queue welcome email:",
        expect.any(Error)
      );
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("https://paradise.divestreams.com/app");
    });

    it("should return form error when tenant creation fails", async () => {
      // Arrange
      const request = new Request("http://test.com/signup", {
        method: "POST",
        body: new URLSearchParams({
          shopName: "Paradise Dive Center",
          subdomain: "paradise",
          email: "owner@paradise.com",
          phone: "",
        }),
      });
      (isSubdomainAvailable as any).mockResolvedValue(true);
      (createTenant as any).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "Failed to create account. Please try again.");
      expect(result.values).toEqual({
        shopName: "Paradise Dive Center",
        subdomain: "paradise",
        email: "owner@paradise.com",
        phone: "",
      });
    });
  });
});
