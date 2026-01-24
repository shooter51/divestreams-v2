import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/customers/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/customers/$id.tsx", () => {
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
    it("should fetch customer with bookings and communications", async () => {
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
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-16"),
      };

      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          date: new Date("2024-02-01"),
          tourName: "Reef Dive",
          status: "confirmed",
          total: "200.00",
        },
      ];

      const mockCommunications = [
        {
          id: "comm-1",
          type: "email",
          subject: "Booking Confirmation",
          sentAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-15"),
        },
      ];

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getCustomerBookings).mockResolvedValue(mockBookings as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockCommunications),
      };

      const mockDb = { select: vi.fn().mockReturnValue(mockSelectBuilder) };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/tenant/customers/cust-456");
      const result = await loader({ request, params: { id: mockCustomerId }, context: {} });

      expect(queries.getCustomerById).toHaveBeenCalledWith(mockOrganizationId, mockCustomerId);
      expect(queries.getCustomerBookings).toHaveBeenCalledWith(mockOrganizationId, mockCustomerId);
      expect(result.customer).toBeDefined();
      expect(result.customer.firstName).toBe("John");
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].date).toBe("2024-02-01");
      expect(result.communications).toHaveLength(1);
    });

    it("should throw 400 if customer ID is missing", async () => {
      const request = new Request("http://test.com/tenant/customers/");

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

      const request = new Request("http://test.com/tenant/customers/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Customer not found");
      }
    });

    it("should handle missing communications table gracefully", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "555-1234",
        certificationLevel: "Open Water",
        emergencyContactName: null,
        emergencyContactPhone: null,
        medicalInfo: null,
        preferences: null,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-16"),
      };

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getCustomerBookings).mockResolvedValue([]);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Table does not exist")),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/tenant/customers/cust-456");
      const result = await loader({ request, params: { id: mockCustomerId }, context: {} });

      expect(result.communications).toEqual([]);
    });

    it("should format dates correctly", async () => {
      const mockCustomer = {
        id: mockCustomerId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "555-1234",
        certificationLevel: "Rescue Diver",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "555-5678",
        medicalInfo: null,
        preferences: null,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-16"),
      };

      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          date: new Date("2024-02-01"),
          tourName: "Reef Dive",
          status: "confirmed",
          total: "200.00",
        },
      ];

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getCustomerBookings).mockResolvedValue(mockBookings as any);

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectBuilder as any);

      const request = new Request("http://test.com/tenant/customers/cust-456");
      const result = await loader({ request, params: { id: mockCustomerId }, context: {} });

      expect(result.customer.createdAt).toBe("2024-01-15");
      expect(result.customer.updatedAt).toBe("2024-01-16");
      expect(result.bookings[0].date).toBe("2024-02-01");
    });
  });

  describe("action", () => {
    it("should delete customer and redirect", async () => {
      vi.mocked(queries.deleteCustomer).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("http://test.com/tenant/customers/cust-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(queries.deleteCustomer).toHaveBeenCalledWith(mockOrganizationId, mockCustomerId);

      // Check redirect
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/customers");
    });

    it("should send email and return success", async () => {
      const formData = new FormData();
      formData.append("intent", "send-email");
      formData.append("subject", "Test Email");
      formData.append("body", "This is a test email");
      formData.append("customerEmail", "john@example.com");

      const request = new Request("http://test.com/tenant/customers/cust-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(result).toEqual({ success: true, message: expect.any(String) });
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/customers/cust-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockCustomerId }, context: {} });

      expect(result).toBeNull();
    });
  });
});
