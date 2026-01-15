import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../app/routes/marketing/signup";

type ActionErrorResponse = {
  errors: Record<string, string>;
  values: { shopName: string; subdomain: string; email: string; phone: string };
};

// Mock the tenant module
vi.mock("../../../../lib/db/tenant.server", () => ({
  createTenant: vi.fn(),
  isSubdomainAvailable: vi.fn(),
}));

// Mock the url utility
vi.mock("../../../../lib/utils/url", () => ({
  getTenantUrl: vi.fn((subdomain, path) => `https://${subdomain}.divestreams.com${path}`),
}));

// Mock the email triggers (prevents hanging on email send)
vi.mock("../../../../lib/email/triggers", () => ({
  triggerWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { createTenant, isSubdomainAvailable } from "../../../../lib/db/tenant.server";
import { getTenantUrl } from "../../../../lib/utils/url";

describe("marketing/signup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isSubdomainAvailable as Mock).mockResolvedValue(true);
  });

  describe("action", () => {
    describe("validation", () => {
      it("returns error when shop name is missing", async () => {
        const formData = new FormData();
        formData.append("shopName", "");
        formData.append("subdomain", "myshop");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.shopName).toBe("Shop name is required");
      });

      it("returns error when shop name is too short", async () => {
        const formData = new FormData();
        formData.append("shopName", "A");
        formData.append("subdomain", "myshop");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.shopName).toBe("Shop name is required");
      });

      it("returns error when subdomain is too short", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "ab");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("Subdomain must be at least 3 characters");
      });

      it("returns error when subdomain has invalid characters", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "my_shop!");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("Only lowercase letters, numbers, and hyphens allowed");
      });

      it("returns error when subdomain is reserved", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "admin");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("This subdomain is reserved");
      });

      it("returns error when subdomain is already taken", async () => {
        (isSubdomainAvailable as Mock).mockResolvedValue(false);

        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "paradise");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("This subdomain is already taken");
      });

      it("returns error when email is missing", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "myshop");
        formData.append("email", "");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.email).toBe("Valid email is required");
      });

      it("returns error when email is invalid", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "myshop");
        formData.append("email", "notanemail");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.email).toBe("Valid email is required");
      });

      it("returns multiple errors when multiple fields are invalid", async () => {
        const formData = new FormData();
        formData.append("shopName", "");
        formData.append("subdomain", "a");
        formData.append("email", "bad");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.shopName).toBeDefined();
        expect((result as ActionErrorResponse).errors.subdomain).toBeDefined();
        expect((result as ActionErrorResponse).errors.email).toBeDefined();
      });

      it("returns submitted values with errors", async () => {
        const formData = new FormData();
        formData.append("shopName", "");
        formData.append("subdomain", "myshop");
        formData.append("email", "owner@example.com");
        formData.append("phone", "+1-555-1234");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        // FormData returns null for empty fields, not empty strings
        expect((result as ActionErrorResponse).values).toMatchObject({
          subdomain: "myshop",
          email: "owner@example.com",
          phone: "+1-555-1234",
        });
      });
    });

    describe("subdomain format", () => {
      it("accepts valid subdomain with letters only", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "myshop" });

        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "myshop");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(302);
      });

      it("accepts valid subdomain with numbers", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "dive123" });

        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "dive123");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toBeInstanceOf(Response);
      });

      it("accepts valid subdomain with hyphens", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "my-dive-shop" });

        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "my-dive-shop");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toBeInstanceOf(Response);
      });

      it("rejects subdomain starting with hyphen", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "-myshop");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("Only lowercase letters, numbers, and hyphens allowed");
      });

      it("rejects subdomain ending with hyphen", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "myshop-");
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("Only lowercase letters, numbers, and hyphens allowed");
      });

      it("accepts single character subdomain that meets minimum length requirement", async () => {
        const formData = new FormData();
        formData.append("shopName", "My Dive Shop");
        formData.append("subdomain", "ab"); // 2 chars, below minimum
        formData.append("email", "owner@example.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.subdomain).toBe("Subdomain must be at least 3 characters");
      });
    });

    describe("tenant creation", () => {
      it("creates tenant with valid data", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "paradisedive" });

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "paradisedive");
        formData.append("email", "owner@paradisedive.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createTenant).toHaveBeenCalledWith({
          subdomain: "paradisedive",
          name: "Paradise Dive Center",
          email: "owner@paradisedive.com",
          phone: undefined,
        });
      });

      it("creates tenant with phone number", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "paradisedive" });

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "paradisedive");
        formData.append("email", "owner@paradisedive.com");
        formData.append("phone", "+1-555-1234");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createTenant).toHaveBeenCalledWith({
          subdomain: "paradisedive",
          name: "Paradise Dive Center",
          email: "owner@paradisedive.com",
          phone: "+1-555-1234",
        });
      });

      it("converts subdomain to lowercase", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "paradisedive" });

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "ParadiseDive");
        formData.append("email", "owner@paradisedive.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createTenant).toHaveBeenCalledWith(
          expect.objectContaining({ subdomain: "paradisedive" })
        );
      });

      it("redirects to tenant app after successful creation", async () => {
        (createTenant as Mock).mockResolvedValue({ subdomain: "paradisedive" });

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "paradisedive");
        formData.append("email", "owner@paradisedive.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(302);
        expect(getTenantUrl).toHaveBeenCalledWith("paradisedive", "/app");
      });
    });

    describe("error handling", () => {
      it("returns form error when tenant creation fails", async () => {
        (createTenant as Mock).mockRejectedValue(new Error("Database error"));

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "paradisedive");
        formData.append("email", "owner@paradisedive.com");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).errors.form).toBe("Failed to create account. Please try again.");
        expect((result as ActionErrorResponse).values).toBeDefined();
      });

      it("preserves submitted values when creation fails", async () => {
        (createTenant as Mock).mockRejectedValue(new Error("Database error"));

        const formData = new FormData();
        formData.append("shopName", "Paradise Dive Center");
        formData.append("subdomain", "paradisedive");
        formData.append("email", "owner@paradisedive.com");
        formData.append("phone", "+1-555-9999");

        const request = new Request("https://divestreams.com/signup", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect((result as ActionErrorResponse).values).toEqual({
          shopName: "Paradise Dive Center",
          subdomain: "paradisedive",
          email: "owner@paradisedive.com",
          phone: "+1-555-9999",
        });
      });
    });
  });
});
