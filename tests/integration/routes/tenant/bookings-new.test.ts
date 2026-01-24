import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

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
  requireTenant: vi.fn(),
}));

vi.mock("../../../../lib/validation", () => ({
  bookingSchema: {
    safeParse: vi.fn(),
  },
  validateFormData: vi.fn(),
  getFormValues: vi.fn((formData: FormData) => {
    const values: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") values[key] = value;
    });
    return values;
  }),
}));

vi.mock("../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
  getTrips: vi.fn(),
  getEquipment: vi.fn(),
  createBooking: vi.fn(),
  getCustomerById: vi.fn(),
  getTripById: vi.fn(),
}));

vi.mock("../../../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
}));

import { loader, action } from "../../../../app/routes/tenant/bookings/new";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { validateFormData, getFormValues } from "../../../../lib/validation";
import {
  getCustomers,
  getTrips,
  getEquipment,
  createBooking,
  getCustomerById,
  getTripById,
} from "../../../../lib/db/queries.server";
import { triggerBookingConfirmation } from "../../../../lib/email/triggers";

describe("tenant/bookings/new route", () => {
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

  const mockCustomers = [
    { id: "cust-1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    { id: "cust-2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
  ];

  const mockTrips = [
    {
      id: "trip-1",
      tourName: "Morning Dive",
      date: "2025-02-01",
      startTime: "08:00",
      maxParticipants: 10,
      bookedParticipants: 2,
      price: 99.0,
    },
    {
      id: "trip-2",
      tourName: "Sunset Dive",
      date: "2025-02-01",
      startTime: "17:00",
      maxParticipants: 8,
      bookedParticipants: 8,
      price: 129.0,
    },
  ];

  const mockEquipment = [
    { id: "eq-1", name: "BCD", rentalPrice: 25.0 },
    { id: "eq-2", name: "Regulator", rentalPrice: 20.0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    (requireTenant as Mock).mockResolvedValue(mockTenantContext);
    (getCustomers as Mock).mockResolvedValue({ customers: mockCustomers });
    (getTrips as Mock).mockResolvedValue(mockTrips);
    (getEquipment as Mock).mockResolvedValue(mockEquipment);
  });

  describe("loader", () => {
    it("requires tenant context", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new");

      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireTenant).toHaveBeenCalledWith(request);
    });

    it("fetches customers, trips, and equipment", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new");

      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getCustomers).toHaveBeenCalledWith("org-uuid-123", expect.anything());
      expect(getTrips).toHaveBeenCalledWith("org-uuid-123", expect.anything());
      expect(getEquipment).toHaveBeenCalledWith("org-uuid-123", expect.anything());
    });

    it("returns customers list", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.customers).toHaveLength(2);
      expect(result.customers[0]).toMatchObject({
        id: "cust-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });
    });

    it("returns upcoming trips with availability", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // Only trip-1 should be included (trip-2 has no availability)
      expect(result.upcomingTrips).toHaveLength(1);
      expect(result.upcomingTrips[0]).toMatchObject({
        id: "trip-1",
        tourName: "Morning Dive",
        spotsAvailable: 8,
      });
    });

    it("returns rental equipment", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.rentalEquipment).toHaveLength(2);
      expect(result.rentalEquipment[0]).toMatchObject({
        id: "eq-1",
        name: "BCD",
        price: "25.00",
      });
    });

    it("pre-selects customer when customerId in URL", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new?customerId=cust-1");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.selectedCustomer).toMatchObject({
        id: "cust-1",
        firstName: "John",
      });
    });

    it("pre-selects trip when tripId in URL", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new?tripId=trip-1");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.selectedTrip).toMatchObject({
        id: "trip-1",
        tourName: "Morning Dive",
      });
    });

    it("returns undefined for non-existent customer", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new?customerId=nonexistent");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // Returns null or undefined when customer not found in the list
      expect(result.selectedCustomer).toBeFalsy();
    });

    it("returns undefined for non-existent trip", async () => {
      const request = new Request("https://demo.divestreams.com/app/bookings/new?tripId=nonexistent");

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // Returns null or undefined when trip not found in the list
      expect(result.selectedTrip).toBeFalsy();
    });
  });

  describe("action", () => {
    const mockCustomer = { id: "cust-1", firstName: "John", lastName: "Doe", email: "john@example.com" };
    const mockTrip = {
      id: "trip-1",
      tourName: "Morning Dive",
      date: "2025-02-01",
      startTime: "08:00",
      price: 99.0,
    };

    beforeEach(() => {
      (getCustomerById as Mock).mockResolvedValue(mockCustomer);
      (getTripById as Mock).mockResolvedValue(mockTrip);
      (createBooking as Mock).mockResolvedValue({ id: "booking-1", bookingNumber: "BK-2025-0001" });
      (triggerBookingConfirmation as Mock).mockResolvedValue(undefined);
    });

    it("requires tenant context", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "cust-1", participants: 1 },
      });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(requireTenant).toHaveBeenCalled();
    });

    it("returns validation errors when invalid", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: false,
        errors: { tripId: "Trip required", customerId: "Customer required" },
      });
      (getFormValues as Mock).mockReturnValue({});

      const formData = new FormData();

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.tripId).toBe("Trip required");
      expect(errors.customerId).toBe("Customer required");
    });

    it("returns error when customer not found", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "nonexistent", participants: 1 },
      });
      (getCustomerById as Mock).mockResolvedValue(null);
      (getFormValues as Mock).mockReturnValue({ tripId: "trip-1", customerId: "nonexistent" });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "nonexistent");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.customerId).toBe("Customer not found");
    });

    it("returns error when trip not found", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "nonexistent", customerId: "cust-1", participants: 1 },
      });
      (getTripById as Mock).mockResolvedValue(null);
      (getFormValues as Mock).mockReturnValue({ tripId: "nonexistent", customerId: "cust-1" });

      const formData = new FormData();
      formData.append("tripId", "nonexistent");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors.tripId).toBe("Trip not found");
    });

    it("creates booking with correct pricing", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "cust-1", participants: 2 },
      });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "2");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(createBooking).toHaveBeenCalledWith("org-uuid-123", expect.objectContaining({
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        subtotal: 198.0, // 99 * 2
        total: 198.0,
        currency: "USD",
      }));
    });

    it("creates booking with special requests", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: {
          tripId: "trip-1",
          customerId: "cust-1",
          participants: 1,
          specialRequests: "Need extra weight belt",
          source: "website",
        },
      });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");
      formData.append("specialRequests", "Need extra weight belt");
      formData.append("source", "website");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(createBooking).toHaveBeenCalledWith("org-uuid-123", expect.objectContaining({
        specialRequests: "Need extra weight belt",
        source: "website",
      }));
    });

    it("triggers confirmation email on success", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "cust-1", participants: 1 },
      });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(triggerBookingConfirmation).toHaveBeenCalledWith(expect.objectContaining({
        customerEmail: "john@example.com",
        customerName: "John Doe",
        tripName: "Morning Dive",
        tripDate: "2025-02-01",
        bookingNumber: "BK-2025-0001",
        shopName: "Demo Dive Shop",
      }));
    });

    it("redirects to bookings list on success", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "cust-1", participants: 1 },
      });

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("location")).toBe("/tenant/bookings");
    });

    it("continues even if email fails", async () => {
      (validateFormData as Mock).mockReturnValue({
        success: true,
        data: { tripId: "trip-1", customerId: "cust-1", participants: 1 },
      });
      (triggerBookingConfirmation as Mock).mockRejectedValue(new Error("Email service unavailable"));

      const formData = new FormData();
      formData.append("tripId", "trip-1");
      formData.append("customerId", "cust-1");
      formData.append("participants", "1");

      const request = new Request("https://demo.divestreams.com/app/bookings/new", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      // Should still redirect successfully
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("location")).toBe("/tenant/bookings");
    });
  });
});
