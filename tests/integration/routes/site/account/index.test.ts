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
    total: "total",
    participants: "participants",
    customerId: "customerId",
    organizationId: "organizationId",
    tripId: "tripId",
    paymentStatus: "paymentStatus",
  },
  trips: { id: "id", date: "date", startTime: "startTime", tourId: "tourId" },
  tours: { id: "id", name: "name", type: "type" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ type: "sql", strings, values })),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

vi.mock("../../../../components/ui", () => ({
  StatusBadge: () => null,
}));

import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { db } from "../../../../../lib/db";
import { loader } from "../../../../../app/routes/site/account/index";

describe("site/account/index route", () => {
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
    // Default: mock all db queries to return empty/zero
    (db.limit as Mock).mockResolvedValue([]);
    (db.where as Mock).mockResolvedValue([{ count: 0 }]);
  });

  describe("loader", () => {
    it("throws 401 when no session cookie", async () => {
      const request = new Request("https://demo.divestreams.com/site/account");

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

    it("throws 401 when customer session is invalid", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/site/account");
      request.headers.append("Cookie", "customer_session=bad-token");

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

    it("returns customer and dashboard data when authenticated", async () => {
      // Mock the db calls for stats and next booking
      let callCount = 0;
      (db.where as Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          // Stats queries
          return [{ count: callCount === 1 ? 3 : 5, total: "450.00" }];
        }
        // Next booking query - returns the orderBy chain
        return db;
      });
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/account");
      request.headers.append("Cookie", "customer_session=valid-token");

      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.customer).toMatchObject({
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
      });
    });
  });
});
