import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/bookings/index";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
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

vi.mock("../../../../lib/db/schema", () => ({
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

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

const mockOrgContext = {
  user: { id: "user-1", name: "Test User", email: "test@example.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  subscription: null,
  limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
  usage: { customers: 0, tours: 0, bookingsThisMonth: 5 },
  canAddCustomer: true,
  canAddTour: true,
  canAddBooking: true,
  isPremium: false,
};

/**
 * Sets up db.select mock for the loader's 6 queries:
 * 1. bookingList  (select/from/leftJoin×3/where/orderBy/limit/offset → rows)
 * 2. totalCount   (select/from/where → [{ value }])
 * 3. statsToday   (select/from/leftJoin/where → [{ value }])  ─┐
 * 4. statsUpcoming (select/from/where → [{ value }])           ├─ Promise.all
 * 5. statsPending  (select/from/where → [{ value }])          ─┘
 * 6. monthlyCount  (select/from/where → [{ value }])
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
    bookingListQuery,        // 1. booking list
    countOnly(total),        // 2. total count
    todayQuery,              // 3. stats today (has leftJoin)
    countOnly(statsUpcoming),// 4. stats upcoming
    countOnly(statsPending), // 5. stats pending payment
    countOnly(monthly),      // 6. monthly count
  ];

  let callCount = 0;
  (db.select as Mock).mockImplementation(() => {
    const q = queries[callCount] ?? countOnly(0);
    callCount++;
    return q;
  });

  return bookingListQuery;
}

describe("tenant/bookings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  const makeRequest = (url = "https://demo.divestreams.com/tenant/bookings") =>
    ({ request: new Request(url), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

  describe("loader", () => {
    it("requires organization context", async () => {
      setupDbMock({});
      const request = new Request("https://demo.divestreams.com/tenant/bookings");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);
      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches bookings with organization filter", async () => {
      setupDbMock({});
      const result = await loader(makeRequest());
      expect(db.select).toHaveBeenCalled();
      expect(result.bookings).toBeDefined();
    });

    it("filters by status when provided", async () => {
      setupDbMock({});
      const result = await loader(makeRequest("https://demo.divestreams.com/tenant/bookings?status=confirmed"));
      expect(result.status).toBe("confirmed");
    });

    it("paginates correctly", async () => {
      const bookingListQuery = setupDbMock({ total: 100, monthly: 5 });
      const result = await loader(makeRequest("https://demo.divestreams.com/tenant/bookings?page=3"));
      expect(result.page).toBe(3);
      expect(bookingListQuery.offset).toHaveBeenCalled();
    });

    it("returns formatted bookings with customer info", async () => {
      const today = new Date();
      const mockRows = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "customer-1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Morning Dive",
          tripDate: today,
          tripTime: "08:00",
          participants: 2,
          total: 150.0,
          status: "confirmed",
          paidAmount: 150.0,
          createdAt: new Date("2024-01-10"),
        },
      ];

      setupDbMock({ bookings: mockRows, total: 1, monthly: 1 });
      const result = await loader(makeRequest());

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toMatchObject({
        id: "booking-1",
        bookingNumber: "BK-001",
        customer: { id: "customer-1", firstName: "John", lastName: "Smith", email: "john@example.com" },
        trip: { id: "trip-1", tourName: "Morning Dive", startTime: "08:00" },
        participants: 2,
        total: "150.00",
        status: "confirmed",
        paidAmount: "150.00",
      });
    });

    it("returns stats with today's bookings count", async () => {
      setupDbMock({ statsToday: 1, statsUpcoming: 1, monthly: 1 });
      const result = await loader(makeRequest());
      expect(result.stats).toBeDefined();
      expect(result.stats.today).toBe(1);
      expect(result.stats.upcoming).toBe(1);
    });

    it("calculates pending payment count correctly", async () => {
      setupDbMock({ statsPending: 1, total: 2, monthly: 2 });
      const result = await loader(makeRequest());
      expect(result.stats.pendingPayment).toBe(1);
    });

    it("returns empty array when no bookings exist", async () => {
      setupDbMock({});
      const result = await loader(makeRequest());
      expect(result.bookings).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.stats.today).toBe(0);
      expect(result.stats.upcoming).toBe(0);
      expect(result.stats.pendingPayment).toBe(0);
    });

    it("returns pagination info", async () => {
      setupDbMock({ total: 100, monthly: 5 });
      const result = await loader(makeRequest("https://demo.divestreams.com/tenant/bookings?page=2"));
      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
    });

    it("returns search and status filter values", async () => {
      setupDbMock({});
      const result = await loader(makeRequest("https://demo.divestreams.com/tenant/bookings?search=john&status=pending"));
      expect(result.search).toBe("john");
      expect(result.status).toBe("pending");
    });

    it("returns freemium data", async () => {
      setupDbMock({ monthly: 8 });
      const result = await loader(makeRequest());
      expect(result.canAddBooking).toBe(true);
      expect(result.usage).toBe(8);
      expect(result.limit).toBe(20);
      expect(result.isPremium).toBe(false);
    });
  });
});
