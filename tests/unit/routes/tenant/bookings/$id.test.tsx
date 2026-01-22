/**
 * Tenant Booking Details Route Tests
 *
 * Tests the booking details page loader and action with multiple intents and payment management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/bookings/$id";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock queries
vi.mock("../../../../../lib/db/queries.server", () => ({
  getBookingWithFullDetails: vi.fn(),
  getPaymentsByBookingId: vi.fn(),
  updateBookingStatus: vi.fn(),
  recordPayment: vi.fn(),
}));

// Import mocked modules
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import {
  getBookingWithFullDetails,
  getPaymentsByBookingId,
  updateBookingStatus,
  recordPayment,
} from "../../../../../lib/db/queries.server";

describe("Route: tenant/bookings/$id.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBooking = {
    id: "booking-123",
    status: "confirmed",
    totalAmount: "150.00",
    amountPaid: "50.00",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "+1234567890",
    numberOfPeople: 2,
    notes: "First time divers",
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-15T14:30:00Z"),
    trip: {
      id: "trip-1",
      date: new Date("2024-02-01T09:00:00Z"),
      startTime: "09:00",
      tourName: "Morning Dive",
      price: "75.00",
    },
  };

  const mockPayments = [
    {
      id: "payment-1",
      amount: "50.00",
      paymentMethod: "credit_card",
      date: new Date("2024-01-01T10:30:00Z"),
      notes: "Deposit payment",
    },
  ];

  describe("loader", () => {
    it("should throw 400 when booking ID is missing", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/");
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
      const request = new Request("http://localhost/tenant/bookings/booking-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getBookingWithFullDetails as any).mockResolvedValue(null);
      (getPaymentsByBookingId as any).mockResolvedValue([]);

      // Act & Assert
      try {
        await loader({ request, params: { id: "booking-123" }, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load booking details with payments and format dates", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getBookingWithFullDetails as any).mockResolvedValue(mockBooking);
      (getPaymentsByBookingId as any).mockResolvedValue(mockPayments);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(getBookingWithFullDetails).toHaveBeenCalledWith("org-123", "booking-123");
      expect(getPaymentsByBookingId).toHaveBeenCalledWith("org-123", "booking-123");

      expect(result.booking.id).toBe("booking-123");
      expect(result.booking.status).toBe("confirmed");
      expect(result.booking.customerName).toBe("John Doe");

      // Dates should be formatted as strings
      expect(result.booking.createdAt).toBe("2024-01-01");
      expect(result.booking.updatedAt).toBe("2024-01-15");
      expect(result.booking.trip.date).toBe("2024-02-01");

      // Payments should be included with formatted dates
      expect(result.booking.payments).toHaveLength(1);
      expect(result.booking.payments[0].date).toBe("2024-01-01");
    });

    it("should handle empty payments array", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (getBookingWithFullDetails as any).mockResolvedValue(mockBooking);
      (getPaymentsByBookingId as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result.booking.payments).toEqual([]);
    });

    it("should handle null date values", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings/booking-123");
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      const bookingWithNullDates = {
        ...mockBooking,
        updatedAt: null,
      };

      (getBookingWithFullDetails as any).mockResolvedValue(bookingWithNullDates);
      (getPaymentsByBookingId as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result.booking.updatedAt).toBeNull();
    });
  });

  describe("action", () => {
    it("should cancel booking", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "cancel");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (updateBookingStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(updateBookingStatus).toHaveBeenCalledWith("org-123", "booking-123", "cancelled");
      expect(result).toEqual({ cancelled: true });
    });

    it("should confirm booking", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "confirm");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (updateBookingStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(updateBookingStatus).toHaveBeenCalledWith("org-123", "booking-123", "confirmed");
      expect(result).toEqual({ confirmed: true });
    });

    it("should complete booking", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "complete");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (updateBookingStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(updateBookingStatus).toHaveBeenCalledWith("org-123", "booking-123", "completed");
      expect(result).toEqual({ completed: true });
    });

    it("should mark booking as no-show", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "no-show");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (updateBookingStatus as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(updateBookingStatus).toHaveBeenCalledWith("org-123", "booking-123", "no_show");
      expect(result).toEqual({ noShow: true });
    });

    it("should add payment with valid data", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "100.00");
      formData.append("paymentMethod", "credit_card");
      formData.append("notes", "Final payment");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (recordPayment as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(recordPayment).toHaveBeenCalledWith("org-123", {
        bookingId: "booking-123",
        amount: 100.00,
        paymentMethod: "credit_card",
        notes: "Final payment",
      });
      expect(result).toEqual({
        paymentAdded: true,
        message: "Payment of $100.00 recorded successfully",
      });
    });

    it("should return error when payment amount is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("paymentMethod", "cash");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result).toEqual({ error: "Valid payment amount is required" });
    });

    it("should return error when payment amount is zero", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "0");
      formData.append("paymentMethod", "cash");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result).toEqual({ error: "Valid payment amount is required" });
    });

    it("should return error when payment method is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "50.00");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result).toEqual({ error: "Payment method is required" });
    });

    it("should send confirmation email", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "send-confirmation");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(result).toEqual({ emailSent: true });
    });

    it("should handle payment without notes", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "25.50");
      formData.append("paymentMethod", "cash");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;
      (requireTenant as any).mockResolvedValue({
        organizationId: "org-123",
      });
      (recordPayment as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: { id: "booking-123" }, context: {} });

      // Assert
      expect(recordPayment).toHaveBeenCalledWith("org-123", {
        bookingId: "booking-123",
        amount: 25.50,
        paymentMethod: "cash",
        notes: undefined,
      });
      expect(result).toEqual({
        paymentAdded: true,
        message: "Payment of $25.50 recorded successfully",
      });
    });
  });
});
