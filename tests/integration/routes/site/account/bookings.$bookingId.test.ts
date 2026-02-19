import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    bookingNumber: "bookingNumber",
    status: "status",
    paymentStatus: "paymentStatus",
    total: "total",
    subtotal: "subtotal",
    discount: "discount",
    tax: "tax",
    currency: "currency",
    participants: "participants",
    createdAt: "createdAt",
    cancelledAt: "cancelledAt",
    cancellationReason: "cancellationReason",
    specialRequests: "specialRequests",
    customerId: "customerId",
    organizationId: "organizationId",
    tripId: "tripId",
    updatedAt: "updatedAt",
  },
  trips: { id: "id", date: "date", startTime: "startTime", endTime: "endTime", tourId: "tourId" },
  tours: { id: "id", name: "name", type: "type", description: "description" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

vi.mock("../../../../../lib/integrations/google-calendar-bookings.server", () => ({
  syncBookingCancellationToCalendar: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../../../../../lib/db";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { loader, action } from "../../../../../app/routes/site/account/bookings.$bookingId";

describe("site/account/bookings.$bookingId route", () => {
  const mockCustomer = {
    id: "cust-1",
    firstName: "John",
    organizationId: "org-1",
  };

  const mockBookingResult = [{
    id: "booking-1",
    bookingNumber: "BK-001",
    status: "confirmed",
    paymentStatus: "paid",
    total: "150.00",
    subtotal: "150.00",
    discount: "0",
    tax: "0",
    currency: "USD",
    participants: 2,
    createdAt: new Date("2025-01-15"),
    cancelledAt: null,
    cancellationReason: null,
    specialRequests: null,
    tripId: "trip-1",
    tripDate: "2025-06-15",
    tripStartTime: "08:00",
    tripEndTime: "16:00",
    tourId: "tour-1",
    tourName: "Reef Dive",
    tourType: "single_dive",
    tourDescription: "Amazing reef dive",
  }];

  beforeEach(() => {
    vi.clearAllMocks();
    (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
  });

  describe("loader", () => {
    it("throws 404 when no bookingId param", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/bookings/");
      request.headers.append("Cookie", "customer_session=valid-token");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("throws 401 when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1");

      try {
        await loader({
          request,
          params: { bookingId: "booking-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(401);
      }
    });

    it("returns booking detail data for valid request", async () => {
      (db.limit as Mock).mockResolvedValue(mockBookingResult);

      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: { bookingId: "booking-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.booking.id).toBe("booking-1");
      expect(result.booking.trip.tour.name).toBe("Reef Dive");
    });

    it("throws 404 when booking not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/account/bookings/nonexistent");
      request.headers.append("Cookie", "customer_session=valid-token");

      try {
        await loader({
          request,
          params: { bookingId: "nonexistent" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });
  });

  describe("action", () => {
    it("returns 401 when no session cookie", async () => {
      const formData = new FormData();
      formData.set("_action", "cancel");
      formData.set("reason", "Schedule conflict");

      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { bookingId: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as Response).status).toBe(401);
    });

    it("returns 400 when cancellation reason is missing", async () => {
      const formData = new FormData();
      formData.set("_action", "cancel");

      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: { bookingId: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as Response).status).toBe(400);
      const body = await (result as Response).json();
      expect(body.error).toBe("Cancellation reason is required");
    });

    it("returns 400 for already cancelled bookings", async () => {
      (db.limit as Mock).mockResolvedValue([{
        id: "booking-1",
        status: "canceled",
        tripId: "trip-1",
        organizationId: "org-1",
      }]);

      const formData = new FormData();
      formData.set("_action", "cancel");
      formData.set("reason", "Schedule conflict");

      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: { bookingId: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as Response).status).toBe(400);
    });

    it("cancels booking successfully", async () => {
      (db.limit as Mock).mockResolvedValue([{
        id: "booking-1",
        status: "confirmed",
        tripId: "trip-1",
        organizationId: "org-1",
      }]);
      // Mock the update chain: first .where() call returns db (for select chain to .limit()),
      // second .where() call resolves (for update chain)
      (db.set as Mock).mockReturnThis();
      (db.where as Mock)
        .mockReturnValueOnce(db)           // select().from().where() -> returns db so .limit() works
        .mockResolvedValueOnce(undefined); // update().set().where() -> resolves

      const formData = new FormData();
      formData.set("_action", "cancel");
      formData.set("reason", "Schedule conflict");

      const request = new Request("https://demo.divestreams.com/site/account/bookings/booking-1", {
        method: "POST",
        body: formData,
      });
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await action({
        request,
        params: { bookingId: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as Response).status).toBe(200);
      const body = await (result as Response).json();
      expect(body.success).toBe(true);
    });
  });
});
