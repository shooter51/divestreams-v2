import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader, action } from "../../../../../app/routes/tenant/bookings/$id";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");

describe("app/routes/tenant/bookings/$id.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockBookingId = "booking-456";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as unknown);
  });

  describe("loader", () => {
    it("should fetch booking with full details and payments", async () => {
      const mockBooking = {
        id: mockBookingId,
        bookingNumber: "BK-001",
        status: "confirmed",
        participants: 2,
        total: "200.00",
        paidAmount: "100.00",
        balanceDue: "100.00",
        subtotal: "180.00",
        discount: "0.00",
        specialRequests: "Vegetarian meal",
        internalNotes: "VIP customer",
        source: "website",
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-16"),
        customer: {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
        },
        trip: {
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Reef Dive",
          date: new Date("2024-02-01"),
          startTime: "09:00",
          endTime: "12:00",
          boatName: "Sea Explorer",
        },
        pricing: {
          basePrice: "90.00",
          participants: 2,
          subtotal: "180.00",
          equipmentTotal: "20.00",
          discount: "0.00",
          total: "200.00",
        },
        participantDetails: [
          { name: "John Doe", certLevel: "Advanced Open Water" },
          { name: "Jane Doe", certLevel: "Open Water" },
        ],
        equipmentRental: [
          { item: "BCD", quantity: 2, price: 10 },
        ],
      };

      const mockPayments = [
        {
          id: "pay-1",
          amount: "100.00",
          method: "card",
          date: new Date("2024-01-15"),
          note: "Deposit",
        },
      ];

      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(mockBooking as unknown);
      vi.mocked(queries.getPaymentsByBookingId).mockResolvedValue(mockPayments as unknown);

      const request = new Request("http://test.com/tenant/bookings/booking-456");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.getBookingWithFullDetails).toHaveBeenCalledWith(mockOrganizationId, mockBookingId);
      expect(queries.getPaymentsByBookingId).toHaveBeenCalledWith(mockOrganizationId, mockBookingId);
      expect(result.booking).toBeDefined();
      expect(result.booking.bookingNumber).toBe("BK-001");
      expect(result.booking.payments).toHaveLength(1);
      expect(result.booking.payments[0].date).toBe("2024-01-15");
      expect(result.booking.createdAt).toBe("2024-01-15");
      expect(result.booking.trip.date).toBe("2024-02-01");
    });

    it("should throw 400 if booking ID is missing", async () => {
      const request = new Request("http://test.com/tenant/bookings/");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
        expect(await (error as Response).text()).toBe("Booking ID is required");
      }
    });

    it("should throw 404 if booking not found", async () => {
      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(null);
      vi.mocked(queries.getPaymentsByBookingId).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/nonexistent");

      try {
        await loader({ request, params: { id: "nonexistent" }, context: {} });
        expect.fail("Should have thrown Response");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect(await (error as Response).text()).toBe("Booking not found");
      }
    });

    it("should handle null dates gracefully", async () => {
      const mockBooking = {
        id: mockBookingId,
        bookingNumber: "BK-002",
        status: "pending",
        participants: 1,
        total: "100.00",
        paidAmount: "0.00",
        balanceDue: "100.00",
        createdAt: null,
        updatedAt: null,
        customer: {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
        },
        trip: {
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Reef Dive",
          date: null,
          startTime: "09:00",
        },
        pricing: {
          basePrice: "100.00",
          participants: 1,
          subtotal: "100.00",
          equipmentTotal: "0.00",
          discount: "0.00",
          total: "100.00",
        },
        participantDetails: [],
        equipmentRental: [],
      };

      vi.mocked(queries.getBookingWithFullDetails).mockResolvedValue(mockBooking as unknown);
      vi.mocked(queries.getPaymentsByBookingId).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/booking-456");
      const result = await loader({ request, params: { id: mockBookingId }, context: {} });

      expect(result.booking.createdAt).toBeNull();
      expect(result.booking.updatedAt).toBeNull();
      expect(result.booking.trip.date).toBeNull();
    });
  });

  describe("action", () => {
    it("should cancel booking when intent is cancel", async () => {
      vi.mocked(queries.updateBookingStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "cancel");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.updateBookingStatus).toHaveBeenCalledWith(mockOrganizationId, mockBookingId, "cancelled");
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
      expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(`/tenant/bookings/${mockBookingId}`);
    });

    it("should confirm booking when intent is confirm", async () => {
      vi.mocked(queries.updateBookingStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "confirm");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.updateBookingStatus).toHaveBeenCalledWith(mockOrganizationId, mockBookingId, "confirmed");
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
      expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(`/tenant/bookings/${mockBookingId}`);
    });

    it("should complete booking when intent is complete", async () => {
      vi.mocked(queries.updateBookingStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "complete");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.updateBookingStatus).toHaveBeenCalledWith(mockOrganizationId, mockBookingId, "completed");
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
      expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(`/tenant/bookings/${mockBookingId}`);
    });

    it("should mark as no-show when intent is no-show", async () => {
      vi.mocked(queries.updateBookingStatus).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "no-show");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.updateBookingStatus).toHaveBeenCalledWith(mockOrganizationId, mockBookingId, "no_show");
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
      expect(getRedirectPathname((result as Response).headers.get("Location"))).toBe(`/tenant/bookings/${mockBookingId}`);
    });

    it("should add payment when intent is add-payment with valid data", async () => {
      vi.mocked(queries.recordPayment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "50.00");
      formData.append("paymentMethod", "card");
      formData.append("notes", "Partial payment");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.recordPayment).toHaveBeenCalledWith(mockOrganizationId, {
        bookingId: mockBookingId,
        amount: 50.00,
        paymentMethod: "card",
        notes: "Partial payment",
      });
      expect(result).toEqual({ paymentAdded: true, message: "Payment of $50.00 recorded successfully" });
    });

    it("should return error if payment amount is invalid", async () => {
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "0.50"); // Invalid: between 0 and 1
      formData.append("paymentMethod", "card");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.recordPayment).not.toHaveBeenCalled();
      expect(result).toEqual({ error: "Payment amount must be at least $1 (or $0)" });
    });

    it("should return error if payment method is missing", async () => {
      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "50.00");
      formData.append("paymentMethod", "");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.recordPayment).not.toHaveBeenCalled();
      expect(result).toEqual({ error: "Payment method is required" });
    });

    it("should handle add-payment with no notes", async () => {
      vi.mocked(queries.recordPayment).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("intent", "add-payment");
      formData.append("amount", "100.00");
      formData.append("paymentMethod", "cash");
      formData.append("notes", "");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(queries.recordPayment).toHaveBeenCalledWith(mockOrganizationId, {
        bookingId: mockBookingId,
        amount: 100.00,
        paymentMethod: "cash",
        notes: undefined,
      });
      expect(result).toEqual({ paymentAdded: true, message: "Payment of $100.00 recorded successfully" });
    });

    it("should send confirmation email when intent is send-confirmation", async () => {
      const formData = new FormData();
      formData.append("intent", "send-confirmation");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(result).toEqual({ emailSent: true });
    });

    it("should return null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = new Request("http://test.com/tenant/bookings/booking-456", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: mockBookingId }, context: {} });

      expect(result).toBeNull();
    });
  });
});
