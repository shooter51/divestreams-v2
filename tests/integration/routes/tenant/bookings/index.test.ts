import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/tenant/bookings/index";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
    customerId: "customerId",
    tripId: "tripId",
    participants: "participants",
    total: "total",
    paidAmount: "paidAmount",
    status: "status",
    createdAt: "createdAt",
  },
  customers: { id: "id", firstName: "firstName", lastName: "lastName", email: "email" },
  trips: { id: "id", tourId: "tourId", date: "date", startTime: "startTime" },
  tours: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  or: vi.fn((...conditions) => ({ type: "or", conditions })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  ne: vi.fn((a, b) => ({ type: "ne", field: a, value: b })),
  lt: vi.fn((a, b) => ({ type: "lt", field: a, value: b })),
  ilike: vi.fn((field, pattern) => ({ type: "ilike", field, pattern })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  count: vi.fn(() => ({ type: "count" })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

const mockOrgContext = {
  org: { id: "org-123", name: "Test Org", subdomain: "test" },
  canAddBooking: true,
  limits: { bookingsPerMonth: 100 },
  isPremium: false,
};

/**
 * Sets up db.select mock for the loader's 6 queries:
 * 1. bookingList  (resolves at offset)
 * 2. totalCount   (resolves at where)
 * 3. statsToday   (resolves at where, has leftJoin) ─┐
 * 4. statsUpcoming (resolves at where)               ├─ Promise.all
 * 5. statsPending  (resolves at where)              ─┘
 * 6. monthlyCount  (resolves at where)
 */
function setupDbMock(opts: {
  bookings?: object[];
  total?: number;
  statsToday?: number;
  statsUpcoming?: number;
  statsPending?: number;
  monthly?: number;
}) {
  const {
    bookings: rows = [],
    total = 0,
    statsToday = 0,
    statsUpcoming = 0,
    statsPending = 0,
    monthly = 0,
  } = opts;

  const chainable = (terminal: Record<string, unknown> = {}) => {
    const q: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };
    Object.assign(q, terminal);
    return q as ReturnType<typeof vi.fn> & typeof q;
  };

  const countOnly = (value: number) =>
    chainable({ where: vi.fn().mockResolvedValue([{ value }]) });

  const bookingListQuery = chainable({ offset: vi.fn().mockResolvedValue(rows) });
  const todayQuery = chainable({ where: vi.fn().mockResolvedValue([{ value: statsToday }]) });

  const queries = [
    bookingListQuery,
    countOnly(total),
    todayQuery,
    countOnly(statsUpcoming),
    countOnly(statsPending),
    countOnly(monthly),
  ];

  let callCount = 0;
  (db.select as Mock).mockImplementation(() => {
    const q = queries[callCount] ?? countOnly(0);
    callCount++;
    return q;
  });

  return bookingListQuery;
}

describe("app/routes/tenant/bookings/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("should fetch bookings list with pagination", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          status: "confirmed",
          participants: 2,
          total: "200.00",
          paidAmount: "200.00",
          createdAt: new Date("2024-01-15"),
          customerId: "cust-1",
          customerFirstName: "John",
          customerLastName: "Doe",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tripDate: new Date("2024-02-01"),
          tripTime: "09:00",
          tourName: "Reef Dive",
        },
      ];

      setupDbMock({ bookings: mockBookings, total: 1, monthly: 1 });

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].bookingNumber).toBe("BK-001");
      expect(result.bookings[0].customer.firstName).toBe("John");
      expect(result.bookings[0].trip.tourName).toBe("Reef Dive");
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.canAddBooking).toBe(true);
    });

    it("should filter bookings by status", async () => {
      setupDbMock({});

      const request = new Request("http://test.com/tenant/bookings?status=confirmed");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe("confirmed");
      expect(result.bookings).toHaveLength(0);
    });

    it("should handle pagination correctly", async () => {
      const bookingListQuery = setupDbMock({ total: 50, monthly: 5 });

      const request = new Request("http://test.com/tenant/bookings?page=2");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3); // 50 total / 20 per page = 2.5 → 3
      expect(bookingListQuery.offset).toHaveBeenCalledWith(20); // Page 2 = offset 20
    });

    it("should include search parameter in results", async () => {
      setupDbMock({});

      const request = new Request("http://test.com/tenant/bookings?search=john");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("john");
    });

    it("should calculate stats correctly", async () => {
      setupDbMock({ statsUpcoming: 1, statsPending: 1, total: 2, monthly: 2 });

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.stats.upcoming).toBe(1);
      expect(result.stats.pendingPayment).toBe(1);
    });

    it("should handle freemium limits", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        canAddBooking: false,
        limits: { bookingsPerMonth: 100 },
      });

      setupDbMock({ monthly: 95 });

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.canAddBooking).toBe(false);
      expect(result.usage).toBe(95);
      expect(result.limit).toBe(100);
      expect(result.isPremium).toBe(false);
    });

    it("should handle date formatting edge cases", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          status: "confirmed",
          participants: 2,
          total: "200.00",
          paidAmount: "200.00",
          createdAt: new Date("2024-01-15"),
          customerId: "cust-1",
          customerFirstName: "John",
          customerLastName: "Doe",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tripDate: "2024-02-01", // String date (not a Date object)
          tripTime: "09:00",
          tourName: "Reef Dive",
        },
      ];

      setupDbMock({ bookings: mockBookings, total: 1, monthly: 1 });

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.bookings[0].trip.date).toBe("2024-02-01");
    });
  });
});
