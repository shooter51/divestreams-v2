/**
 * Admin Plan Edit/Create Route Tests
 *
 * Tests the subscription plan editor route loader and action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/admin/plans.$id";

// Mock modules
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  subscriptionPlans: {
    id: "id",
    name: "name",
    displayName: "displayName",
    monthlyPrice: "monthlyPrice",
    yearlyPrice: "yearlyPrice",
    features: "features",
    limits: "limits",
    isActive: "isActive",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Import mocked modules
import { db } from "../../../../lib/db";

describe("Route: admin/plans.$id.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/admin/plans.$id");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Edit Plan - DiveStreams Admin" }]);
    });
  });

  describe("loader", () => {
    const mockPlan = {
      id: "plan-1",
      name: "starter",
      displayName: "Starter",
      monthlyPrice: 4900,
      yearlyPrice: 47000,
      monthlyPriceId: "price_monthly_123",
      yearlyPriceId: "price_yearly_123",
      features: ["Up to 3 users", "Basic support"],
      limits: {
        users: 3,
        customers: 100,
        toursPerMonth: 10,
        storageGb: 5,
      },
      isActive: true,
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    };

    it("should handle 'new' plan", async () => {
      // Arrange
      const params = { id: "new" };

      // Act
      const result = await loader({ params, request: {} as any, context: {} });

      // Assert
      expect(result).toEqual({
        plan: null,
        isNew: true,
      });
      expect(db.select).not.toHaveBeenCalled();
    });

    it("should load existing plan by id", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPlan]),
          }),
        }),
      });

      const params = { id: "plan-1" };

      // Act
      const result = await loader({ params, request: {} as any, context: {} });

      // Assert
      expect(result).toEqual({
        plan: mockPlan,
        isNew: false,
      });
      expect(db.select).toHaveBeenCalled();
    });

    it("should throw 404 when plan not found", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const params = { id: "nonexistent" };

      // Act & Assert
      try {
        await loader({ params, request: {} as any, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should handle plan with null price IDs", async () => {
      // Arrange
      const planWithoutPriceIds = {
        ...mockPlan,
        monthlyPriceId: null,
        yearlyPriceId: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([planWithoutPriceIds]),
          }),
        }),
      });

      const params = { id: "plan-1" };

      // Act
      const result = await loader({ params, request: {} as any, context: {} });

      // Assert
      expect(result.plan.monthlyPriceId).toBeNull();
      expect(result.plan.yearlyPriceId).toBeNull();
    });
  });

  describe("action", () => {
    describe("Validation", () => {
      it("should validate required name field", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("displayName", "Starter");
        formData.set("monthlyPrice", "49.00");
        formData.set("yearlyPrice", "470.00");
        formData.set("features", "");
        // name is missing

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("errors");
        expect((result as any).errors.name).toBe("Name is required");
      });

      it("should validate required displayName field", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "starter");
        formData.set("monthlyPrice", "49.00");
        formData.set("yearlyPrice", "470.00");
        formData.set("features", "");
        // displayName is missing

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("errors");
        expect((result as any).errors.displayName).toBe(
          "Display name is required"
        );
      });

      it("should validate monthly price is valid number", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "starter");
        formData.set("displayName", "Starter");
        formData.set("monthlyPrice", "invalid");
        formData.set("yearlyPrice", "470.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("errors");
        expect((result as any).errors.monthlyPrice).toBe(
          "Invalid monthly price"
        );
      });

      it("should validate yearly price is valid number", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "starter");
        formData.set("displayName", "Starter");
        formData.set("monthlyPrice", "49.00");
        formData.set("yearlyPrice", "not-a-number");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("errors");
        expect((result as any).errors.yearlyPrice).toBe("Invalid yearly price");
      });

      it("should return all validation errors at once", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("monthlyPrice", "invalid");
        formData.set("yearlyPrice", "also-invalid");
        formData.set("features", "");
        // name and displayName missing

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("errors");
        const errors = (result as any).errors;
        expect(errors.name).toBe("Name is required");
        expect(errors.displayName).toBe("Display name is required");
        expect(errors.monthlyPrice).toBe("Invalid monthly price");
        expect(errors.yearlyPrice).toBe("Invalid yearly price");
      });
    });

    describe("Create New Plan", () => {
      beforeEach(() => {
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });
      });

      it("should create new plan with all fields", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "  STARTER  "); // Test trim and lowercase
        formData.set("displayName", "Starter Plan");
        formData.set("monthlyPrice", "49.99");
        formData.set("yearlyPrice", "479.99");
        formData.set("monthlyPriceId", "price_monthly_123");
        formData.set("yearlyPriceId", "price_yearly_123");
        formData.set("features", "Feature 1\nFeature 2\n\nFeature 3");
        formData.set("limitUsers", "3");
        formData.set("limitCustomers", "100");
        formData.set("limitTours", "10");
        formData.set("limitStorage", "5");
        formData.set("isActive", "on");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.insert).toHaveBeenCalled();
        const insertCall = (db.insert as any).mock.results[0].value;
        expect(insertCall.values).toHaveBeenCalledWith({
          name: "starter", // lowercase and trimmed
          displayName: "Starter Plan",
          monthlyPrice: 4999, // converted to cents
          yearlyPrice: 47999, // converted to cents
          monthlyPriceId: "price_monthly_123",
          yearlyPriceId: "price_yearly_123",
          features: ["Feature 1", "Feature 2", "Feature 3"], // empty lines removed
          limits: {
            users: 3,
            customers: 100,
            toursPerMonth: 10,
            storageGb: 5,
          },
          isActive: true,
        });
        expect(result).toHaveProperty("status", 302);
      });

      it("should handle empty optional fields", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "basic");
        formData.set("displayName", "Basic");
        formData.set("monthlyPrice", "0.00");
        formData.set("yearlyPrice", "0.00");
        formData.set("monthlyPriceId", "");
        formData.set("yearlyPriceId", "");
        formData.set("features", "");
        formData.set("limitUsers", "");
        formData.set("limitCustomers", "");
        formData.set("limitTours", "");
        formData.set("limitStorage", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const insertCall = (db.insert as any).mock.results[0].value;
        expect(insertCall.values).toHaveBeenCalledWith({
          name: "basic",
          displayName: "Basic",
          monthlyPrice: 0,
          yearlyPrice: 0,
          monthlyPriceId: null, // empty string becomes null
          yearlyPriceId: null,
          features: [], // empty string results in empty array
          limits: {
            users: -1, // default value
            customers: -1,
            toursPerMonth: -1,
            storageGb: -1,
          },
          isActive: false, // checkbox not checked
        });
      });

      it("should redirect to /plans on success", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "starter");
        formData.set("displayName", "Starter");
        formData.set("monthlyPrice", "49.00");
        formData.set("yearlyPrice", "470.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("status", 302);
        expect((result as any).headers.get("Location")).toBe("/plans");
      });
    });

    describe("Update Existing Plan", () => {
      beforeEach(() => {
        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });
      });

      it("should update existing plan", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "pro");
        formData.set("displayName", "Professional");
        formData.set("monthlyPrice", "99.00");
        formData.set("yearlyPrice", "950.00");
        formData.set("monthlyPriceId", "price_monthly_456");
        formData.set("yearlyPriceId", "price_yearly_456");
        formData.set("features", "Feature A\nFeature B");
        formData.set("limitUsers", "10");
        formData.set("limitCustomers", "500");
        formData.set("limitTours", "-1");
        formData.set("limitStorage", "50");
        formData.set("isActive", "on");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "plan-123" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(db.update).toHaveBeenCalled();
        const updateCall = (db.update as any).mock.results[0].value;
        expect(updateCall.set).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "pro",
            displayName: "Professional",
            monthlyPrice: 9900,
            yearlyPrice: 95000,
            monthlyPriceId: "price_monthly_456",
            yearlyPriceId: "price_yearly_456",
            features: ["Feature A", "Feature B"],
            limits: {
              users: 10,
              customers: 500,
              toursPerMonth: -1,
              storageGb: 50,
            },
            isActive: true,
            updatedAt: expect.any(Date),
          })
        );
        expect(result).toHaveProperty("status", 302);
      });

      it("should set updatedAt timestamp", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "enterprise");
        formData.set("displayName", "Enterprise");
        formData.set("monthlyPrice", "199.00");
        formData.set("yearlyPrice", "1900.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "plan-456" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const updateCall = (db.update as any).mock.results[0].value;
        const setArg = updateCall.set.mock.calls[0][0];
        expect(setArg.updatedAt).toBeInstanceOf(Date);
      });

      it("should redirect to /plans on success", async () => {
        // Arrange
        const formData = new FormData();
        formData.set("name", "business");
        formData.set("displayName", "Business");
        formData.set("monthlyPrice", "149.00");
        formData.set("yearlyPrice", "1400.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "plan-789" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toHaveProperty("status", 302);
        expect((result as any).headers.get("Location")).toBe("/plans");
      });
    });

    describe("Error Handling", () => {
      it("should handle database errors on create", async () => {
        // Arrange
        (db.insert as any).mockReturnValue({
          values: vi
            .fn()
            .mockRejectedValue(new Error("Database connection failed")),
        });

        const formData = new FormData();
        formData.set("name", "starter");
        formData.set("displayName", "Starter");
        formData.set("monthlyPrice", "49.00");
        formData.set("yearlyPrice", "470.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { form: "Failed to save plan. Please try again." },
        });
      });

      it("should handle database errors on update", async () => {
        // Arrange
        (db.update as any).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockRejectedValue(new Error("Constraint violation")),
          }),
        });

        const formData = new FormData();
        formData.set("name", "pro");
        formData.set("displayName", "Professional");
        formData.set("monthlyPrice", "99.00");
        formData.set("yearlyPrice", "950.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "plan-123" };

        // Act
        const result = await action({ request, params, context: {} });

        // Assert
        expect(result).toEqual({
          errors: { form: "Failed to save plan. Please try again." },
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle prices with fractional cents (rounds)", async () => {
        // Arrange
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("name", "test");
        formData.set("displayName", "Test");
        formData.set("monthlyPrice", "49.995"); // Should round to 50.00
        formData.set("yearlyPrice", "470.994"); // Should round to 470.99
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const insertCall = (db.insert as any).mock.results[0].value;
        const values = insertCall.values.mock.calls[0][0];
        expect(values.monthlyPrice).toBe(5000); // Math.round(49.995 * 100) = 5000
        expect(values.yearlyPrice).toBe(47099); // Math.round(470.994 * 100) = 47099
      });

      it("should handle features with only whitespace", async () => {
        // Arrange
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("name", "test");
        formData.set("displayName", "Test");
        formData.set("monthlyPrice", "10.00");
        formData.set("yearlyPrice", "100.00");
        formData.set("features", "  \n  \n  "); // Only whitespace

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const insertCall = (db.insert as any).mock.results[0].value;
        const values = insertCall.values.mock.calls[0][0];
        expect(values.features).toEqual([]); // All whitespace removed
      });

      it("should handle name with uppercase and whitespace", async () => {
        // Arrange
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("name", "  PROFESSIONAL-PLAN  ");
        formData.set("displayName", "Professional Plan");
        formData.set("monthlyPrice", "99.00");
        formData.set("yearlyPrice", "950.00");
        formData.set("features", "");

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const insertCall = (db.insert as any).mock.results[0].value;
        const values = insertCall.values.mock.calls[0][0];
        expect(values.name).toBe("professional-plan"); // lowercase and trimmed
      });

      it("should handle isActive checkbox unchecked", async () => {
        // Arrange
        (db.insert as any).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const formData = new FormData();
        formData.set("name", "inactive");
        formData.set("displayName", "Inactive Plan");
        formData.set("monthlyPrice", "29.00");
        formData.set("yearlyPrice", "280.00");
        formData.set("features", "");
        // isActive not set (checkbox unchecked)

        const request = new Request("http://test.com", {
          method: "POST",
          body: formData,
        });

        const params = { id: "new" };

        // Act
        await action({ request, params, context: {} });

        // Assert
        const insertCall = (db.insert as any).mock.results[0].value;
        const values = insertCall.values.mock.calls[0][0];
        expect(values.isActive).toBe(false);
      });
    });
  });
});
