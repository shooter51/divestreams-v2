import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/tenant/bookings/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as validation from "../../../../../lib/validation";
import * as emailTriggers from "../../../../../lib/email/triggers";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/validation");
vi.mock("../../../../../lib/email/triggers");

describe("app/routes/tenant/bookings/new.tsx", () => {
  const mockOrganizationId = "org-123";
  const mockTenant = { id: "tenant-123", subdomain: "test", name: "Test Dive Shop", createdAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orgContext.requireTenant).mockResolvedValue({
      tenant: mockTenant,
      organizationId: mockOrganizationId,
    } as any);
  });

  describe("loader", () => {
    it("should fetch customers, trips, and equipment", async () => {
      const mockCustomers = {
        customers: [
          { id: "cust-1", firstName: "John", lastName: "Doe", email: "john@example.com" },
          { id: "cust-2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
        ],
      };

      const mockTrips = [
        {
          id: "trip-1",
          tourName: "Reef Dive",
          date: new Date("2024-02-01"),
          startTime: "09:00",
          maxParticipants: 10,
          bookedParticipants: 3,
          price: 100,
        },
        {
          id: "trip-2",
          tourName: "Wreck Dive",
          date: "2024-02-05",
          startTime: "14:00",
          maxParticipants: 8,
          bookedParticipants: 8,
          price: 120,
        },
      ];

      const mockEquipment = [
        { id: "eq-1", name: "BCD", rentalPrice: 15 },
        { id: "eq-2", name: "Regulator", rentalPrice: 20 },
      ];

      vi.mocked(queries.getCustomers).mockResolvedValue(mockCustomers as any);
      vi.mocked(queries.getTrips).mockResolvedValue(mockTrips as any);
      vi.mocked(queries.getEquipment).mockResolvedValue(mockEquipment as any);

      const request = new Request("http://test.com/tenant/bookings/new");
      const result = await loader({ request, params: {}, context: {} });

      expect(queries.getCustomers).toHaveBeenCalledWith(mockOrganizationId, { limit: 100 });
      expect(queries.getTrips).toHaveBeenCalledWith(mockOrganizationId, expect.objectContaining({
        status: "scheduled",
        limit: 50,
      }));
      expect(queries.getEquipment).toHaveBeenCalledWith(mockOrganizationId, {
        isRentable: true,
        status: "available",
      });

      expect(result.customers).toHaveLength(2);
      expect(result.upcomingTrips).toHaveLength(1); // Only trip-1 has spots available
      expect(result.upcomingTrips[0].spotsAvailable).toBe(7); // 10 - 3
      expect(result.rentalEquipment).toHaveLength(2);
    });

    it("should pre-select customer from query param", async () => {
      const mockCustomers = {
        customers: [
          { id: "cust-1", firstName: "John", lastName: "Doe", email: "john@example.com" },
        ],
      };

      vi.mocked(queries.getCustomers).mockResolvedValue(mockCustomers as any);
      vi.mocked(queries.getTrips).mockResolvedValue([]);
      vi.mocked(queries.getEquipment).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/new?customerId=cust-1");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.selectedCustomer).toEqual({
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });
    });

    it("should pre-select trip from query param", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          tourName: "Night Dive",
          date: new Date("2024-02-10"),
          startTime: "19:00",
          maxParticipants: 6,
          bookedParticipants: 2,
          price: 150,
        },
      ];

      vi.mocked(queries.getCustomers).mockResolvedValue({ customers: [] } as any);
      vi.mocked(queries.getTrips).mockResolvedValue(mockTrips as any);
      vi.mocked(queries.getEquipment).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/new?tripId=trip-1");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.selectedTrip).toBeDefined();
      expect(result.selectedTrip?.id).toBe("trip-1");
      expect(result.selectedTrip?.tourName).toBe("Night Dive");
    });

    it("should handle trips with null or undefined values", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          tourName: null,
          date: new Date("2024-02-01"),
          startTime: null,
          maxParticipants: null,
          bookedParticipants: null,
          price: null,
        },
      ];

      vi.mocked(queries.getCustomers).mockResolvedValue({ customers: [] } as any);
      vi.mocked(queries.getTrips).mockResolvedValue(mockTrips as any);
      vi.mocked(queries.getEquipment).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/new");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.upcomingTrips[0].tourName).toBe("Trip");
      expect(result.upcomingTrips[0].startTime).toBe("00:00");
      expect(result.upcomingTrips[0].spotsAvailable).toBe(10); // Default max 10 - 0 booked
      expect(result.upcomingTrips[0].price).toBe("0.00");
    });

    it("should filter out trips with no availability", async () => {
      const mockTrips = [
        {
          id: "trip-1",
          tourName: "Full Trip",
          date: new Date("2024-02-01"),
          startTime: "09:00",
          maxParticipants: 5,
          bookedParticipants: 5,
          price: 100,
        },
      ];

      vi.mocked(queries.getCustomers).mockResolvedValue({ customers: [] } as any);
      vi.mocked(queries.getTrips).mockResolvedValue(mockTrips as any);
      vi.mocked(queries.getEquipment).mockResolvedValue([]);

      const request = new Request("http://test.com/tenant/bookings/new");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.upcomingTrips).toHaveLength(0);
    });
  });

  describe("action", () => {
    it("should create booking and redirect on valid data", async () => {
      const mockCustomer = {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const mockTrip = {
        id: "trip-1",
        tourName: "Reef Dive",
        date: new Date("2024-02-01"),
        startTime: "09:00",
        price: 100,
      };

      const mockBooking = {
        id: "booking-1",
        bookingNumber: "BK-001",
      };

      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "trip-1",
          participants: 2,
          specialRequests: "Vegetarian meals",
          source: "direct",
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getTripById).mockResolvedValue(mockTrip as any);
      vi.mocked(queries.createBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(emailTriggers.triggerBookingConfirmation).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("customerId", "cust-1");
      formData.append("tripId", "trip-1");
      formData.append("participants", "2");
      formData.append("specialRequests", "Vegetarian meals");
      formData.append("source", "direct");

      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(validation.validateFormData).toHaveBeenCalled();
      expect(queries.getCustomerById).toHaveBeenCalledWith(mockOrganizationId, "cust-1");
      expect(queries.getTripById).toHaveBeenCalledWith(mockOrganizationId, "trip-1");
      expect(queries.createBooking).toHaveBeenCalledWith(mockOrganizationId, {
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        subtotal: 200, // 100 * 2
        total: 200,
        currency: "USD",
        specialRequests: "Vegetarian meals",
        source: "direct",
      });
      expect(emailTriggers.triggerBookingConfirmation).toHaveBeenCalledWith({
        customerEmail: "john@example.com",
        customerName: "John Doe",
        tripName: "Reef Dive",
        tripDate: "2024-02-01",
        tripTime: "09:00",
        participants: 2,
        totalCents: 20000,
        bookingNumber: "BK-001",
        shopName: "Test Dive Shop",
        tenantId: "tenant-123",
      });

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/tenant/bookings");
    });

    it("should return validation errors on invalid data", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          customerId: "Customer is required",
          tripId: "Trip is required",
        },
      } as any);

      vi.mocked(validation.getFormValues).mockReturnValue({
        customerId: "",
        tripId: "",
      });

      const formData = new FormData();
      formData.append("customerId", "");
      formData.append("tripId", "");

      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({
        errors: {
          customerId: "Customer is required",
          tripId: "Trip is required",
        },
        values: {
          customerId: "",
          tripId: "",
        },
      });
    });

    it("should return error if customer not found", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "nonexistent",
          tripId: "trip-1",
          participants: 1,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(null);
      vi.mocked(queries.getTripById).mockResolvedValue({} as any);
      vi.mocked(validation.getFormValues).mockReturnValue({});

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({
        errors: { customerId: "Customer not found" },
        values: {},
      });
    });

    it("should return error if trip not found", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "nonexistent",
          participants: 1,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue({} as any);
      vi.mocked(queries.getTripById).mockResolvedValue(null);
      vi.mocked(validation.getFormValues).mockReturnValue({});

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toEqual({
        errors: { tripId: "Trip not found" },
        values: {},
      });
    });

    it("should handle email failure gracefully", async () => {
      const mockCustomer = {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const mockTrip = {
        id: "trip-1",
        tourName: "Reef Dive",
        date: new Date("2024-02-01"),
        startTime: "09:00",
        price: 100,
      };

      const mockBooking = {
        id: "booking-1",
        bookingNumber: "BK-001",
      };

      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "trip-1",
          participants: 1,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getTripById).mockResolvedValue(mockTrip as any);
      vi.mocked(queries.createBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(emailTriggers.triggerBookingConfirmation).mockRejectedValue(new Error("Email service down"));

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      // Should still redirect even if email fails
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to queue booking confirmation email:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("should default to 1 participant if not provided", async () => {
      const mockCustomer = {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const mockTrip = {
        id: "trip-1",
        tourName: "Reef Dive",
        date: new Date("2024-02-01"),
        startTime: "09:00",
        price: 100,
      };

      const mockBooking = {
        id: "booking-1",
        bookingNumber: "BK-001",
      };

      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "trip-1",
          participants: null,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getTripById).mockResolvedValue(mockTrip as any);
      vi.mocked(queries.createBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(emailTriggers.triggerBookingConfirmation).mockResolvedValue(undefined);

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBooking).toHaveBeenCalledWith(mockOrganizationId, expect.objectContaining({
        participants: 1,
        subtotal: 100,
        total: 100,
      }));
    });

    it("should default source to 'direct' if not provided", async () => {
      const mockCustomer = {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const mockTrip = {
        id: "trip-1",
        tourName: "Reef Dive",
        date: new Date("2024-02-01"),
        startTime: "09:00",
        price: 100,
      };

      const mockBooking = {
        id: "booking-1",
        bookingNumber: "BK-001",
      };

      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "trip-1",
          participants: 1,
          source: undefined,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getTripById).mockResolvedValue(mockTrip as any);
      vi.mocked(queries.createBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(emailTriggers.triggerBookingConfirmation).mockResolvedValue(undefined);

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createBooking).toHaveBeenCalledWith(mockOrganizationId, expect.objectContaining({
        source: "direct",
      }));
    });

    it("should handle trip date as string in email", async () => {
      const mockCustomer = {
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const mockTrip = {
        id: "trip-1",
        tourName: "Reef Dive",
        date: "2024-02-01", // String instead of Date
        startTime: "09:00",
        price: 100,
      };

      const mockBooking = {
        id: "booking-1",
        bookingNumber: "BK-001",
      };

      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {
          customerId: "cust-1",
          tripId: "trip-1",
          participants: 1,
        },
      } as any);

      vi.mocked(queries.getCustomerById).mockResolvedValue(mockCustomer as any);
      vi.mocked(queries.getTripById).mockResolvedValue(mockTrip as any);
      vi.mocked(queries.createBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(emailTriggers.triggerBookingConfirmation).mockResolvedValue(undefined);

      const formData = new FormData();
      const request = new Request("http://test.com/tenant/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(emailTriggers.triggerBookingConfirmation).toHaveBeenCalledWith(expect.objectContaining({
        tripDate: "2024-02-01",
      }));
    });
  });
});
