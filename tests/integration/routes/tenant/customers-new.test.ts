import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../helpers/redirect";

// Mock react-router redirect - must be before importing route
const mockRedirect = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string, init?: ResponseInit) => {
      mockRedirect(url, init);
      const headers = new Headers(init?.headers);
      headers.set("location", url);
      const response = new Response(null, {
        status: 302,
        headers,
      });
      // Return response (React Router v7 actions use return redirect(), not throw)
      return response;
    },
  };
});

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/db/queries.server", () => ({
  createCustomer: vi.fn(),
}));

vi.mock("../../../../lib/require-feature.server", () => ({
  requireLimit: vi.fn().mockResolvedValue({ current: 0, limit: 50, remaining: 50 }),
}));

vi.mock("../../../../lib/plan-features", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
  };
});

// Mock the db module to prevent real DB calls (user email check)
vi.mock("../../../../lib/db", () => {
  const mockSelectBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // No existing user found
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(mockSelectBuilder),
    },
  };
});

import { action, loader } from "../../../../app/routes/tenant/customers/new";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { createCustomer } from "../../../../lib/db/queries.server";

describe("tenant/customers/new route", () => {
  const mockTenantContext = {
    tenant: {
      id: "tenant-1",
      subdomain: "demo",
      schemaName: "tenant_demo",
      name: "Demo Dive Shop",
      subscriptionStatus: "active",
      trialEndsAt: null,
    },
    organizationId: "org-uuid-123",
  };

  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid-123", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: {
      plan: "free",
      planDetails: {
        features: {},
        limits: { users: 1, customers: 50, toursPerMonth: 5, storageGb: 0.5 },
      },
    },
    limits: { customers: 50, tours: 5 },
    usage: { customers: 0, tours: 0 },
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("action", () => {
    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      (createCustomer as Mock).mockResolvedValue({ id: "cust-1" });

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns error when firstName is missing", async () => {
      const formData = new FormData();
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.firstName).toBe("First name is required");
    });

    it("returns error when lastName is missing", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("email", "john@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.lastName).toBe("Last name is required");
    });

    it("returns error when email is missing", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.email).toBe("Email is required");
    });

    it("returns error for invalid email", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "notanemail");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.email).toBe("Invalid email address");
    });

    it("returns multiple errors when multiple fields invalid", async () => {
      const formData = new FormData();

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.firstName).toBe("First name is required");
      expect(errors.lastName).toBe("Last name is required");
      expect(errors.email).toBe("Email is required");
    });

    it("creates customer with minimal required fields", async () => {
      (createCustomer as Mock).mockResolvedValue({ id: "cust-1" });

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect(getRedirectPathname((response as Response).headers.get("location"))).toBe("/tenant/customers");

      expect(createCustomer).toHaveBeenCalledWith("org-uuid-123", expect.objectContaining({
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
      }));
    });

    it("creates customer with all optional fields", async () => {
      (createCustomer as Mock).mockResolvedValue({ id: "cust-1" });

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "+1-555-0101");
      formData.append("dateOfBirth", "1990-05-15");
      formData.append("emergencyContactName", "Jane Doe");
      formData.append("emergencyContactPhone", "+1-555-0102");
      formData.append("emergencyContactRelation", "Spouse");
      formData.append("medicalConditions", "None");
      formData.append("medications", "None");
      formData.append("certAgency", "PADI");
      formData.append("certLevel", "Advanced Open Water");
      formData.append("certNumber", "12345678");
      formData.append("address", "123 Main St");
      formData.append("city", "Miami");
      formData.append("state", "FL");
      formData.append("postalCode", "33101");
      formData.append("country", "USA");
      formData.append("notes", "VIP customer");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(createCustomer).toHaveBeenCalledWith("org-uuid-123", expect.objectContaining({
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+1-555-0101",
        dateOfBirth: "1990-05-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "+1-555-0102",
        emergencyContactRelation: "Spouse",
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        notes: "VIP customer",
        certifications: [{ agency: "PADI", level: "Advanced Open Water", number: "12345678" }],
      }));
    });

    it("creates customer without certifications when partial cert info", async () => {
      (createCustomer as Mock).mockResolvedValue({ id: "cust-1" });

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("certAgency", "PADI");
      // Missing certLevel - should not create certification

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(createCustomer).toHaveBeenCalledWith("org-uuid-123", expect.objectContaining({
        certifications: undefined,
      }));
    });

    it("handles database error gracefully", async () => {
      (createCustomer as Mock).mockRejectedValue(new Error("Database connection failed"));

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.form).toBe("Failed to create customer. Please try again.");
    });

    it("preserves form values on error", async () => {
      (createCustomer as Mock).mockRejectedValue(new Error("Database error"));

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "+1-555-0101");

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("values");
      const values = (result as { values: Record<string, string> }).values;
      expect(values.firstName).toBe("John");
      expect(values.lastName).toBe("Doe");
      expect(values.email).toBe("john@example.com");
      expect(values.phone).toBe("+1-555-0101");
    });

    it("preserves form values on validation error", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      // Missing lastName and email

      const request = new Request("https://demo.divestreams.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("values");
      expect((result as { values: Record<string, string> }).values.firstName).toBe("John");
    });
  });
});
