import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../../helpers/redirect";
import { loader, action } from "../../../../../../app/routes/tenant/customers/$id/edit";
import * as orgContext from "../../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../../lib/db/queries.server";
import * as tenantServer from "../../../../../../lib/db/tenant.server";
import * as validation from "../../../../../../lib/validation";

// Mock dependencies
vi.mock("../../../../../../lib/auth/org-context.server");
vi.mock("../../../../../../lib/db/queries.server");
vi.mock("../../../../../../lib/db/tenant.server");
vi.mock("../../../../../../lib/validation");

describe("app/routes/tenant/customers/$id/edit.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockCustomerId = "cust-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: { id: "tenant-123", subdomain: "test", name: "Test Org", createdAt: new Date() },
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch customer for editing", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "555-1234",
        certificationLevel: "Advanced Open Water",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "555-5678",
        medicalInfo: "No allergies",
        preferences: "Morning dives",
      };

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);

      const request = new Request("http://test.com/tenant/customers/cust-456/edit");
      const result = await loader({ request, params: { id: mockCustomerId }, context: {} });

      expect(queries.getCustomerById).toHaveBeenCalledWith(mockOrganizationId, mockCustomerId);
      expect(result.customer.id).toBe(mockCustomerId);
      expect(result.customer.firstName).toBe("John");
      expect(result.customer.lastName).toBe("Doe");
      expect(result.customer.email).toBe("john@example.com");
    });

    it("should throw 400 if customer ID is missing", async () => {
      const request = new Request("http://test.com/tenant/customers//edit");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Customer ID required");
      }
    });

    it("should throw 404 if customer not found", async () => {
      vi.mocked(queries.getCustomerById).mockResolvedValue(null);

      const request = new Request("http://test.com/tenant/customers/nonexistent/edit");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Customer not found");
      }
    });
  });

  describe("action", () => {
    it("should update customer and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "555-1234",
          emergencyContactName: "Jane Doe",
          emergencyContactPhone: "555-5678",
          medicalConditions: "No allergies",
          medications: null,
          notes: null,
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      const mockSchema = {
        customers: {
          organizationId: Symbol("organizationId"),
          id: Symbol("id"),
        },
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as any);

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john.doe@example.com");
      formData.append("phone", "555-1234");

      const request = new Request("http://test.com/tenant/customers/cust-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(tenantServer.getTenantDb).toHaveBeenCalledWith(mockOrganizationId);
      expect(mockDb.update).toHaveBeenCalledWith(mockSchema.customers);

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/customers/${mockCustomerId}`);
    });

    it("should return validation errors for missing required fields", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          firstName: "Required",
          lastName: "Required",
          email: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        firstName: "",
        lastName: "",
        email: "",
      });

      const formData = new FormData();
      formData.append("firstName", "");
      formData.append("lastName", "");
      formData.append("email", "");

      const request = new Request("http://test.com/tenant/customers/cust-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("firstName", "Required");
    });

    it("should return validation error for invalid email", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          email: "Invalid email format",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        firstName: "John",
        lastName: "Doe",
        email: "invalid-email",
      });

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "invalid-email");

      const request = new Request("http://test.com/tenant/customers/cust-456/edit", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Invalid email format");
    });

    it("should handle optional fields correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
          emergencyContactName: null,
          emergencyContactPhone: null,
          medicalConditions: null,
          medications: null,
          notes: null,
        } as any,
      });

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      const mockSchema = {
        customers: {
          organizationId: Symbol("organizationId"),
          id: Symbol("id"),
        },
      };

      vi.mocked(tenantServer.getTenantDb).mockReturnValue({
        db: mockDb,
        schema: mockSchema,
      } as any);

      const formData = new FormData();
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "555-1234");

      const request = new Request("http://test.com/tenant/customers/cust-456/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: mockCustomerId }, context: {} });

      const setCallArgs = mockDb.set.mock.calls[0][0];
      expect(setCallArgs.firstName).toBe("John");
      expect(setCallArgs.lastName).toBe("Doe");
      expect(setCallArgs.email).toBe("john@example.com");
      expect(setCallArgs.phone).toBe("555-1234");
    });
  });
});
