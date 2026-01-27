import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { action } from "../../../../../app/routes/tenant/customers/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");

// Mock require-feature.server - requireLimit returns available capacity
vi.mock("../../../../../lib/require-feature.server", () => ({
  requireLimit: vi.fn().mockResolvedValue({ current: 0, limit: 50, remaining: 50 }),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  DEFAULT_PLAN_LIMITS: { free: { users: 1, customers: 50, toursPerMonth: 5, storageGb: 0.5 } },
}));

describe("app/routes/tenant/customers/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      user: { id: "user-123", email: "test@example.com" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 50 },
      isPremium: false,
    } as any);
  });

  describe("action", () => {
    it("should create customer and redirect", async () => {
      vi.mocked(queries.createCustomer).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "555-1234");
      formData.append("certificationLevel", "Advanced Open Water");
      formData.append("emergencyContactName", "Jane Doe");
      formData.append("emergencyContactPhone", "555-5678");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createCustomer).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "555-1234",
        })
      );

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe("/tenant/customers");
    });

    it("should return error for missing first name", async () => {
      const formData = new FormData();
      formData.append("firstName", "");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("firstName", "First name is required");
    });

    it("should return error for missing last name", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "");
      formData.append("email", "john@example.com");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("lastName", "Last name is required");
    });

    it("should return error for missing email", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Email is required");
    });

    it("should return error for invalid email format", async () => {
      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "invalid-email");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Invalid email address");
    });

    it("should handle optional certification fields", async () => {
      vi.mocked(queries.createCustomer).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("certAgency", "");
      formData.append("certLevel", "");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createCustomer).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          certifications: undefined,
        })
      );
    });

    it("should parse certifications correctly", async () => {
      vi.mocked(queries.createCustomer).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("certAgency", "PADI");
      formData.append("certLevel", "Advanced Open Water");
      formData.append("certNumber", "12345");

      const request = new Request("http://test.com/tenant/customers/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createCustomer).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          certifications: [
            { agency: "PADI", level: "Advanced Open Water", number: "12345" },
          ],
        })
      );
    });
  });
});
