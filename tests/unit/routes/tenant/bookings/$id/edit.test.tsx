/**
 * Tenant Booking Edit Route Tests
 *
 * Tests the booking edit page loader and action with form data updates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../../app/routes/tenant/bookings/$id/edit";

// Mock auth
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock tenant database
vi.mock("../../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../../lib/db/queries.server", () => ({
  getBookingWithFullDetails: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../../../lib/db/tenant.server";
import { getBookingWithFullDetails } from "../../../../../../lib/db/queries.server";

describe("Route: tenant/bookings/$id/edit.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBooking = {
    id: "booking-123",
    bookingNumber: "BK-2024-001",
    status: "confirmed",
    participants: 2,
    specialRequests: "Need vegetarian lunch",
    internalNotes: "First time customers",
    customer: {
      id: "customer-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
    },
    trip: {
      id: "trip-1",
      date: new Date("2024-02-01T09:00:00Z"),
      startTime: "09:00",
      tourName: "Morning Dive",
    },
    pricing: {
      total: "150.00",
    },
  };

  describe("loader", () => {
    it("should throw 400 when booking ID is missing", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when booking not found", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getBookingWithFullDetails as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { id: "booking-123" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load booking edit data with customer and trip details", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getBookingWithFullDetails as any).mockResolvedValue(mockBooking);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(getBookingWithFullDetails).toHaveBeenCalledWith("org-123", "booking-123");
      expect(result.booking.id).toBe("booking-123");
      expect(result.booking.bookingNumber).toBe("BK-2024-001");
      expect(result.booking.customerId).toBe("customer-1");
      expect(result.booking.customerName).toBe("John Doe");
      expect(result.booking.tripId).toBe("trip-1");
      expect(result.booking.tripName).toBe("Morning Dive");
      expect(result.booking.status).toBe("confirmed");
      expect(result.booking.participants).toBe(2);
      expect(result.booking.totalAmount).toBe("150.00");
      expect(result.booking.specialRequests).toBe("Need vegetarian lunch");
      expect(result.booking.internalNotes).toBe("First time customers");
    });

    it("should handle null optional fields with empty strings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const bookingWithNulls = {
        ...mockBooking,
        specialRequests: null,
        internalNotes: null,
      };

      (getBookingWithFullDetails as any).mockResolvedValue(bookingWithNulls);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result.booking.specialRequests).toBe("");
      expect(result.booking.internalNotes).toBe("");
    });

    it("should handle undefined optional fields with empty strings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123/edit");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const bookingWithUndefined = {
        ...mockBooking,
        specialRequests: undefined,
        internalNotes: undefined,
      };

      (getBookingWithFullDetails as any).mockResolvedValue(bookingWithUndefined);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result.booking.specialRequests).toBe("");
      expect(result.booking.internalNotes).toBe("");
    });
  });

  describe("action", () => {
    it("should throw 400 when booking ID is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "2");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act & Assert
      try {
        await action({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should update booking with all fields and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "4");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "Need two vegetarian lunches");
      formData.append("internalNotes", "Returning customers, give priority");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          bookings: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({
        participants: 4,
        status: "confirmed",
        specialRequests: "Need two vegetarian lunches",
        internalNotes: "Returning customers, give priority",
        updatedAt: expect.any(Date),
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/app/bookings/booking-123");
    });

    it("should update booking with participants only and redirect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "3");
      formData.append("status", "pending");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          bookings: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({
        participants: 3,
        status: "pending",
        specialRequests: null, // Missing from formData → null
        internalNotes: null, // Missing from formData → null
        updatedAt: expect.any(Date),
      });
      expect(result.status).toBe(302);
    });

    it("should handle empty specialRequests and internalNotes", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "2");
      formData.append("status", "confirmed");
      formData.append("specialRequests", "");
      formData.append("internalNotes", "");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          bookings: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith({
        participants: 2,
        status: "confirmed",
        specialRequests: "", // Present but empty → ""
        internalNotes: "", // Present but empty → ""
        updatedAt: expect.any(Date),
      });
      expect(result.status).toBe(302);
    });

    it("should parse participants as integer", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "5");
      formData.append("status", "confirmed");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          bookings: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: 5, // Should be integer, not string
        })
      );
    });

    it("should update status to different values", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("participants", "2");
      formData.append("status", "cancelled");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);

      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getTenantDb as any).mockReturnValue({
        db: {
          update: mockUpdate,
        },
        schema: {
          bookings: {
            organizationId: "organizationId",
            id: "id",
          },
        },
      });

      mockUpdate.mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        })
      );
      expect(result.status).toBe(302);
    });
  });
});
