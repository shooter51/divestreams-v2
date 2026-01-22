/**
 * Tenant Discounts Route Tests
 *
 * Tests discount code management with validation and CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/discounts";

// Mock auth
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import mocked modules
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("Route: tenant/discounts.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDiscountCodes = [
    {
      id: "discount-1",
      code: "SUMMER20",
      description: "Summer 2024 promotion",
      discountType: "percentage",
      discountValue: "20",
      minBookingAmount: "50.00",
      maxUses: 100,
      usedCount: 15,
      validFrom: new Date("2024-06-01"),
      validTo: new Date("2024-08-31"),
      isActive: true,
      applicableTo: "all",
      createdAt: new Date("2024-05-01"),
      organizationId: "org-123",
    },
    {
      id: "discount-2",
      code: "FIXED10",
      description: "Fixed $10 off",
      discountType: "fixed",
      discountValue: "10.00",
      minBookingAmount: null,
      maxUses: null,
      usedCount: 0,
      validFrom: null,
      validTo: null,
      isActive: true,
      applicableTo: "tours",
      createdAt: new Date("2024-04-15"),
      organizationId: "org-123",
    },
    {
      id: "discount-3",
      code: "EXPIRED",
      description: "Expired discount",
      discountType: "percentage",
      discountValue: "15",
      minBookingAmount: null,
      maxUses: null,
      usedCount: 5,
      validFrom: null,
      validTo: new Date("2024-01-31"),
      isActive: false,
      applicableTo: "all",
      createdAt: new Date("2024-01-01"),
      organizationId: "org-123",
    },
  ];

  describe("loader", () => {
    it("should load all discount codes for organization ordered by createdAt", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/discounts");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: true,
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDiscountCodes),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.discountCodes).toHaveLength(3);
      expect(result.discountCodes[0].code).toBe("SUMMER20");
      expect(result.discountCodes[1].code).toBe("FIXED10");
      expect(result.discountCodes[2].code).toBe("EXPIRED");
      expect(result.isPremium).toBe(true);
    });

    it("should handle empty discount codes list", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/discounts");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        isPremium: false,
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.discountCodes).toEqual([]);
      expect(result.isPremium).toBe(false);
    });
  });

  describe("action - create", () => {
    it("should create discount code with all fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "summer20");
      formData.append("description", "Summer promotion");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "20");
      formData.append("minBookingAmount", "50.00");
      formData.append("maxUses", "100");
      formData.append("validFrom", "2024-06-01T00:00");
      formData.append("validTo", "2024-08-31T23:59");
      formData.append("applicableTo", "tours");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Mock duplicate check - no existing codes
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        code: "SUMMER20", // Uppercased and trimmed
        description: "Summer promotion",
        discountType: "percentage",
        discountValue: "20",
        minBookingAmount: "50.00",
        maxUses: 100,
        validFrom: expect.any(Date),
        validTo: expect.any(Date),
        applicableTo: "tours",
        isActive: true,
      });
      expect(result).toEqual({ success: true, message: "Discount code created" });
    });

    it("should create discount code with minimal fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "BASIC10");
      formData.append("discountType", "fixed");
      formData.append("discountValue", "10");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        code: "BASIC10",
        description: null,
        discountType: "fixed",
        discountValue: "10",
        minBookingAmount: null,
        maxUses: null,
        validFrom: null,
        validTo: null,
        applicableTo: "all", // Default
        isActive: true,
      });
    });

    it("should return error for invalid discount value (non-numeric)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "TEST");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "invalid");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Discount value must be a positive number" });
    });

    it("should return error for zero discount value", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "TEST");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "0");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Discount value must be a positive number" });
    });

    it("should return error for percentage discount over 100%", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "TEST");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "150");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Percentage discount cannot exceed 100%" });
    });

    it("should return error for fixed discount over $100,000", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "TEST");
      formData.append("discountType", "fixed");
      formData.append("discountValue", "150000");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Fixed discount amount is too large (max $100,000)" });
    });

    it("should return error for duplicate discount code", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "SUMMER20");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "20");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Mock duplicate check - existing code found
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDiscountCodes[0]]),
          }),
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "A discount code with this code already exists" });
    });

    it("should uppercase and trim the code", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create");
      formData.append("code", "  summer20  ");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "20");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "SUMMER20", // Trimmed and uppercased
        })
      );
    });
  });

  describe("action - update", () => {
    it("should update discount code with all fields", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "discount-1");
      formData.append("code", "SUMMER25");
      formData.append("description", "Updated summer promotion");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "25");
      formData.append("minBookingAmount", "75.00");
      formData.append("maxUses", "150");
      formData.append("validFrom", "2024-06-01T00:00");
      formData.append("validTo", "2024-09-30T23:59");
      formData.append("applicableTo", "courses");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Mock duplicate check - no conflict
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn(),
      });
      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({
        code: "SUMMER25",
        description: "Updated summer promotion",
        discountType: "percentage",
        discountValue: "25",
        minBookingAmount: "75.00",
        maxUses: 150,
        validFrom: expect.any(Date),
        validTo: expect.any(Date),
        applicableTo: "courses",
        isActive: true,
      });
      expect(result).toEqual({ success: true, message: "Discount code updated" });
    });

    it("should allow updating to same code (no conflict with self)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "discount-1");
      formData.append("code", "SUMMER20"); // Same code
      formData.append("discountType", "percentage");
      formData.append("discountValue", "20");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Mock duplicate check - existing code is same discount
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDiscountCodes[0]]), // Same ID
          }),
        }),
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn(),
      });
      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - Should succeed because it's updating itself
      expect(result).toEqual({ success: true, message: "Discount code updated" });
    });

    it("should return error when updating to existing code from different discount", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "discount-2");
      formData.append("code", "SUMMER20"); // Code from discount-1
      formData.append("discountType", "fixed");
      formData.append("discountValue", "10");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Mock duplicate check - existing code is different discount
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDiscountCodes[0]]), // Different ID
          }),
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "A discount code with this code already exists" });
    });

    it("should handle isActive checkbox unchecked", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "discount-1");
      formData.append("code", "SUMMER20");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "20");
      // isActive not appended (checkbox unchecked)

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn(),
      });
      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it("should return error for validation failures on update", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update");
      formData.append("id", "discount-1");
      formData.append("code", "TEST");
      formData.append("discountType", "percentage");
      formData.append("discountValue", "150"); // Over 100%
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Percentage discount cannot exceed 100%" });
    });
  });

  describe("action - toggle-active", () => {
    it("should deactivate discount code", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      formData.append("id", "discount-1");
      formData.append("isActive", "false");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn(),
      });
      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({ isActive: false });
      expect(result).toEqual({ success: true, message: "Discount code deactivated" });
    });

    it("should activate discount code", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "toggle-active");
      formData.append("id", "discount-3");
      formData.append("isActive", "true");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn(),
      });
      (db.update as any).mockReturnValue({
        set: mockSet,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual({ success: true, message: "Discount code activated" });
    });
  });

  describe("action - delete", () => {
    it("should delete discount code", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", "discount-3");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      const mockWhere = vi.fn();
      (db.delete as any).mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: "Discount code deleted" });
    });
  });

  describe("action - invalid intent", () => {
    it("should return error for invalid intent", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "invalid");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Invalid intent" });
    });
  });
});
