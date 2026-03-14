/**
 * DS-ijq9: Trip capacity does not fall back to tour default when trip capacity is unset
 *
 * Tests two aspects of the fix:
 * 1. mapTrip() correctly falls back to tour maxParticipants when trip has none
 * 2. createBooking() validates capacity (including tour fallback) before inserting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapTrip } from "../../../../lib/db/queries/mappers";

// Mock trips.server to control getTripById and getTripBookedParticipants
const mockGetTripById = vi.fn();
const mockGetTripBookedParticipants = vi.fn();
vi.mock("../../../../lib/db/queries/trips.server", () => ({
  getTripById: (...args: unknown[]) => mockGetTripById(...args),
  getTripBookedParticipants: (...args: unknown[]) => mockGetTripBookedParticipants(...args),
}));

// Mock the db module
// .where() must be both chainable AND awaitable (returns [] when terminal)
// because getNextBookingNumber now ends at .where()
vi.mock("../../../../lib/db/index", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  const chainFn = vi.fn().mockReturnValue(self);
  // Make it thenable so `await db.select().from().where()` resolves to []
  self.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
  self.select = chainFn;
  self.from = chainFn;
  self.where = vi.fn().mockReturnValue(self);
  self.innerJoin = chainFn;
  self.leftJoin = chainFn;
  self.insert = chainFn;
  self.values = chainFn;
  self.update = chainFn;
  self.set = chainFn;
  self.orderBy = chainFn;
  self.limit = vi.fn().mockResolvedValue([]);
  self.returning = vi.fn().mockResolvedValue([]);
  self.transaction = vi.fn();
  return { db: self };
});

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
    tripId: "tripId",
    customerId: "customerId",
    participants: "participants",
    status: "status",
    subtotal: "subtotal",
    discount: "discount",
    tax: "tax",
    total: "total",
    currency: "currency",
    paidAmount: "paidAmount",
    paymentStatus: "paymentStatus",
    specialRequests: "specialRequests",
    source: "source",
    participantDetails: "participantDetails",
    equipmentRental: "equipmentRental",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  customers: { id: "id", email: "email", firstName: "firstName", lastName: "lastName" },
  tours: { id: "id", name: "name", maxParticipants: "maxParticipants", price: "price" },
  trips: { id: "id", organizationId: "organizationId", tourId: "tourId", maxParticipants: "maxParticipants", date: "date", startTime: "startTime", price: "price", status: "status" },
  boats: { id: "id", name: "name" },
  transactions: { id: "id", organizationId: "organizationId", bookingId: "bookingId", type: "type", amount: "amount", paymentMethod: "paymentMethod", notes: "notes", createdAt: "createdAt" },
}));

// Mock logger
vi.mock("../../../../lib/logger", () => ({
  dbLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Mock google calendar integration (must return a promise for .catch() chain)
vi.mock("../../../../lib/integrations/google-calendar-bookings.server", () => ({
  syncBookingToCalendar: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../lib/db/queries/reports.server", () => ({
  getOrganizationById: vi.fn().mockResolvedValue({ timezone: "UTC" }),
}));

import { db } from "../../../../lib/db/index";
import { createBooking } from "../../../../lib/db/queries/bookings.server";

// ============================================================================
// Part 1: mapTrip() fallback logic (pure function, no mocks needed)
// ============================================================================

describe("DS-ijq9: Trip capacity fallback to tour default", () => {
  const baseRow = {
    id: "trip-1",
    organizationId: "org-1",
    tourId: "tour-1",
    boatId: null,
    date: "2026-06-01",
    startTime: "09:00",
    endTime: "12:00",
    status: "open",
    price: "75.00",
    notes: null,
    weatherNotes: null,
    isPublic: false,
    isRecurring: false,
    recurrencePattern: null,
    recurringTemplateId: null,
    recurrenceIndex: null,
    recurrenceDays: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    conditions: null,
    staffIds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("returns tour maxParticipants when trip maxParticipants is null", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tour_max_participants: 10,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(10);
  });

  it("returns trip maxParticipants when both are set (trip overrides tour)", () => {
    const row = {
      ...baseRow,
      maxParticipants: 6,
      tour_max_participants: 10,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(6);
  });

  it("returns null when both trip and tour maxParticipants are null", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tour_max_participants: null,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBeNull();
  });

  it("also handles camelCase tourMaxParticipants from Drizzle ORM", () => {
    const row = {
      ...baseRow,
      maxParticipants: null,
      tourMaxParticipants: 8,
    };
    const result = mapTrip(row as Parameters<typeof mapTrip>[0]);
    expect(result.maxParticipants).toBe(8);
  });
});

// ============================================================================
// Part 2: createBooking() capacity validation (server-side enforcement)
// ============================================================================

describe("DS-ijq9: createBooking capacity validation", () => {
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: getNextBookingNumber mock via db chain
    const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    mockDb.select.mockReturnValue(db);
    mockDb.from.mockReturnValue(db);
    mockDb.where.mockReturnValue(db);
    mockDb.orderBy.mockReturnValue(db);
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnValue(db);
    mockDb.values.mockReturnValue(db);
    mockDb.returning.mockResolvedValue([
      {
        id: "booking-1",
        bookingNumber: "BK-1000-ABCD",
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2,
        total: "200.00",
      },
    ]);
  });

  it("rejects booking when trip has no explicit capacity but tour capacity is exceeded", async () => {
    // Trip has null maxParticipants, tour has 10 — getTripById returns
    // the effective maxParticipants=10 via mapTrip fallback
    mockGetTripById.mockResolvedValue({
      id: "trip-1",
      tourId: "tour-1",
      maxParticipants: 10, // effective (from tour fallback)
      price: 100,
    });
    mockGetTripBookedParticipants.mockResolvedValue(9); // 9 already booked

    await expect(
      createBooking(orgId, {
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 2, // requesting 2, only 1 available
        subtotal: 200,
        total: 200,
      })
    ).rejects.toThrow("Only 1 spots available on this trip");
  });

  it("rejects booking when trip is at full capacity", async () => {
    mockGetTripById.mockResolvedValue({
      id: "trip-1",
      tourId: "tour-1",
      maxParticipants: 8,
      price: 100,
    });
    mockGetTripBookedParticipants.mockResolvedValue(8); // fully booked

    await expect(
      createBooking(orgId, {
        tripId: "trip-1",
        customerId: "cust-1",
        participants: 1,
        subtotal: 100,
        total: 100,
      })
    ).rejects.toThrow("Only 0 spots available on this trip");
  });

  it("allows booking when capacity has room", async () => {
    mockGetTripById.mockResolvedValue({
      id: "trip-1",
      tourId: "tour-1",
      maxParticipants: 10,
      price: 100,
    });
    mockGetTripBookedParticipants.mockResolvedValue(5); // 5 booked, 5 available

    const result = await createBooking(orgId, {
      tripId: "trip-1",
      customerId: "cust-1",
      participants: 3, // requesting 3, 5 available
      subtotal: 300,
      total: 300,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("booking-1");
  });

  it("allows booking when no capacity limit is set (null maxParticipants)", async () => {
    mockGetTripById.mockResolvedValue({
      id: "trip-1",
      tourId: "tour-1",
      maxParticipants: null, // no limit on trip or tour
      price: 100,
    });

    // getTripBookedParticipants should NOT be called when there's no limit
    const result = await createBooking(orgId, {
      tripId: "trip-1",
      customerId: "cust-1",
      participants: 50,
      subtotal: 5000,
      total: 5000,
    });

    expect(result).toBeDefined();
    expect(mockGetTripBookedParticipants).not.toHaveBeenCalled();
  });

  it("throws when trip is not found", async () => {
    mockGetTripById.mockResolvedValue(null);

    await expect(
      createBooking(orgId, {
        tripId: "nonexistent",
        customerId: "cust-1",
        participants: 1,
        subtotal: 100,
        total: 100,
      })
    ).rejects.toThrow("Trip not found");
  });
});
