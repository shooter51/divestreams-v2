import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    bookingNumber: "bookingNumber",
    status: "status",
    paymentStatus: "paymentStatus",
    total: "total",
    currency: "currency",
    participants: "participants",
    createdAt: "createdAt",
    customerId: "customerId",
    organizationId: "organizationId",
    tripId: "tripId",
  },
  trips: { id: "id", date: "date", startTime: "startTime", tourId: "tourId" },
  tours: { id: "id", name: "name", type: "type" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  lt: vi.fn((a, b) => ({ type: "lt", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

import { db } from "../../../../../lib/db";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { loader } from "../../../../../app/routes/site/account/bookings";

describe("site/account/bookings route", () => {
  const mockCustomer = {
    id: "cust-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    organizationId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCustomerBySession as Mock).mockResolvedValue(mockCustomer);
  });

  describe("loader", () => {
    it("throws 401 when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site/account/bookings");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(401);
      }
    });

    it("throws 401 when session is invalid", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/site/account/bookings");
      request.headers.append("Cookie", "customer_session=invalid-token");

      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(401);
      }
    });

    it("returns bookings with default 'all' filter", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/account/bookings");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.filter).toBe("all");
      expect(result.bookings).toEqual([]);
    });

    it("applies filter from query params", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/account/bookings?filter=upcoming");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.filter).toBe("upcoming");
    });

    it("maps booking results correctly", async () => {
      const mockBookings = [{
        id: "booking-1",
        bookingNumber: "BK-001",
        status: "confirmed",
        paymentStatus: "paid",
        total: "150.00",
        currency: "USD",
        participants: 2,
        createdAt: new Date("2025-01-15"),
        tripId: "trip-1",
        tripDate: "2025-06-15",
        tripStartTime: "08:00",
        tourId: "tour-1",
        tourName: "Reef Dive",
        tourType: "single_dive",
      }];

      (db.limit as Mock).mockResolvedValue(mockBookings);

      const request = new Request("https://demo.divestreams.com/site/account/bookings");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toMatchObject({
        id: "booking-1",
        bookingNumber: "BK-001",
        status: "confirmed",
        trip: {
          id: "trip-1",
          tour: { name: "Reef Dive" },
        },
      });
    });
  });
});
