import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "booking-1", bookingNumber: "BK-123" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  trips: { id: "id", organizationId: "organizationId", tourId: "tourId", date: "date", startTime: "startTime", endTime: "endTime", maxParticipants: "maxParticipants", price: "price", isPublic: "isPublic", status: "status" },
  tours: { id: "id", name: "name", description: "description", type: "type", maxParticipants: "maxParticipants", price: "price", currency: "currency", duration: "duration", includesEquipment: "includesEquipment", includesMeals: "includesMeals", includesTransport: "includesTransport", isActive: "isActive", organizationId: "organizationId" },
  bookings: { id: "id", tripId: "tripId", status: "status", participants: "participants", organizationId: "organizationId", bookingNumber: "bookingNumber", customerId: "customerId" },
  customers: { id: "id", organizationId: "organizationId", email: "email", firstName: "firstName", lastName: "lastName", phone: "phone" },
  equipment: { id: "id", organizationId: "organizationId", name: "name", category: "category", rentalPrice: "rentalPrice", isRentable: "isRentable", status: "status", isPublic: "isPublic" },
  organization: { id: "id", slug: "slug", customDomain: "customDomain", name: "name" },
  trainingCourses: { id: "id", organizationId: "organizationId", name: "name", description: "description", price: "price", currency: "currency", durationDays: "durationDays", maxStudents: "maxStudents", equipmentIncluded: "equipmentIncluded", isActive: "isActive", isPublic: "isPublic" },
  trainingSessions: { id: "id", organizationId: "organizationId", courseId: "courseId", startDate: "startDate", startTime: "startTime", endDate: "endDate", maxStudents: "maxStudents", priceOverride: "priceOverride", status: "status", enrolledCount: "enrolledCount" },
  trainingEnrollments: { id: "id", organizationId: "organizationId", sessionId: "sessionId", customerId: "customerId", status: "status", paymentStatus: "paymentStatus", amountPaid: "amountPaid", notes: "notes" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  sql: Object.assign(vi.fn(() => "sql"), { join: vi.fn() }),
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn().mockResolvedValue(null),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("ABCD"),
}));

vi.mock("../../../../../lib/jobs", () => ({
  getEmailQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { db } from "../../../../../lib/db";
import { getSubdomainFromHost } from "../../../../../lib/utils/url";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { loader, action } from "../../../../../app/routes/site/book/$type.$id";

describe("site/book/$type.$id route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop" };
  const mockTrip = {
    id: "trip-1",
    tourId: "tour-1",
    tourName: "Reef Dive",
    tourDescription: "Amazing reef dive",
    tourType: "fun_dive",
    date: "2026-07-15",
    startTime: "08:00",
    endTime: "12:00",
    tripMaxParticipants: 10,
    tourMaxParticipants: 12,
    tripPrice: "150.00",
    tourPrice: "130.00",
    currency: "USD",
    duration: 4,
    includesEquipment: false,
    includesMeals: false,
    includesTransport: false,
  };

  const mockCourse = {
    id: "course-1",
    name: "PADI Open Water",
    description: "Learn to dive",
    type: "course",
    price: "500.00",
    currency: "USD",
    duration: 4,
    maxParticipants: 8,
    includesEquipment: true,
    includesMeals: false,
    includesTransport: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chain implementations after clearAllMocks
    (db.select as Mock).mockImplementation(() => db);
    (db.from as Mock).mockImplementation(() => db);
    (db.innerJoin as Mock).mockImplementation(() => db);
    (db.insert as Mock).mockImplementation(() => db);
    (db.values as Mock).mockImplementation(() => db);
    (db.update as Mock).mockImplementation(() => db);
    (db.set as Mock).mockImplementation(() => db);
    (db.for as Mock).mockImplementation(() => db);
    // where() returns an empty awaitable array with chain methods
    (db.where as Mock).mockImplementation(() =>
      Object.assign([], { limit: db.limit, for: db.for, orderBy: db.orderBy })
    );
    (db.limit as Mock).mockReturnThis();
    (db.orderBy as Mock).mockReturnThis();
    (db.returning as Mock).mockResolvedValue([{ id: "booking-1", bookingNumber: "BK-123" }]);
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (getCustomerBySession as Mock).mockResolvedValue(null);
  });

  describe("loader", () => {
    it("throws 400 for invalid booking type", async () => {
      const request = new Request("https://demo.divestreams.com/site/book/invalid/123");
      try {
        await loader({
          request,
          params: { type: "invalid", id: "123" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when organization is not found", async () => {
      (db.limit as Mock).mockResolvedValueOnce([]);

      const request = new Request("https://unknown.divestreams.com/site/book/trip/trip-1");
      try {
        await loader({
          request,
          params: { type: "trip", id: "trip-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns trip data for type=trip with valid trip", async () => {
      // Org query: select().from().where().limit(1)
      // Equipment query: select().from().where().orderBy()
      // Trip query: select().from().innerJoin().where().limit(1)
      // Booking count: select().from().where() -- no limit!
      let limitCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCount++;
        if (limitCount === 1) return Promise.resolve([mockOrg]); // org
        if (limitCount === 2) return Promise.resolve([mockTrip]); // trip+tour join
        return Promise.resolve([{ total: 2 }]); // fallback
      });
      (db.orderBy as Mock).mockResolvedValue([]); // equipment

      // The booking count query ends at where() with no limit.
      // where() returns [] by default. We need the 4th where call to return [{ total: 2 }].
      let whereCount = 0;
      (db.where as Mock).mockImplementation(() => {
        whereCount++;
        if (whereCount === 4) {
          // booking count query - no chaining needed, just return awaitable array
          return [{ total: 2 }];
        }
        // All other where calls need chaining
        return Object.assign([], { limit: db.limit, for: db.for, orderBy: db.orderBy });
      });

      const request = new Request("https://demo.divestreams.com/site/book/trip/trip-1");
      const result = await loader({
        request,
        params: { type: "trip", id: "trip-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.type).toBe("trip");
      expect(result.trip).toBeDefined();
      expect(result.trip!.id).toBe("trip-1");
      expect(result.trip!.tourName).toBe("Reef Dive");
      expect(result.trip!.availableSpots).toBe(8); // 10 max - 2 booked
      expect(result.customer).toBeNull();
      expect(result.organizationName).toBe("Demo Dive Shop");
      expect(result.organizationId).toBe("org-1");
    });

    it("throws 404 for trip that is in the past", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      const pastTrip = { ...mockTrip, date: pastDate.toISOString().split("T")[0] };

      let callCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockOrg]); // org
        if (callCount === 2) return Promise.resolve([pastTrip]); // trip with past date
        return Promise.resolve([{ total: 0 }]);
      });
      (db.orderBy as Mock).mockResolvedValue([]); // equipment

      const request = new Request("https://demo.divestreams.com/site/book/trip/trip-1");
      try {
        await loader({
          request,
          params: { type: "trip", id: "trip-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns course data for type=course", async () => {
      let limitCount = 0;
      (db.limit as Mock).mockImplementation(() => {
        limitCount++;
        if (limitCount === 1) return Promise.resolve([mockOrg]); // org
        if (limitCount === 2) return Promise.resolve([mockCourse]); // trainingCourses lookup
        return Promise.resolve([{ total: 0 }]); // any subsequent booking counts
      });
      // Equipment query (orderBy is terminal for equipment)
      (db.orderBy as Mock).mockImplementation(() => {
        // First orderBy call is for equipment, subsequent for sessions
        return Promise.resolve([]);
      });

      const request = new Request("https://demo.divestreams.com/site/book/course/course-1");
      const result = await loader({
        request,
        params: { type: "course", id: "course-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.type).toBe("course");
      expect(result.course).toBeDefined();
      expect(result.course!.id).toBe("course-1");
      expect(result.course!.name).toBe("PADI Open Water");
      expect(result.customer).toBeNull();
      expect(result.organizationName).toBe("Demo Dive Shop");
    });
  });

  describe("action", () => {
    it("returns validation errors when required fields missing", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("participants", "1");
      // Missing firstName, lastName, email

      const request = new Request("https://demo.divestreams.com/site/book/trip/trip-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { type: "trip", id: "trip-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.firstName).toBe("First name is required");
      expect(errors.lastName).toBe("Last name is required");
      expect(errors.email).toBe("Email is required");
    });

    it("returns validation errors for invalid email", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("firstName", "John");
      formData.set("lastName", "Doe");
      formData.set("email", "invalid-email");
      formData.set("participants", "1");

      const request = new Request("https://demo.divestreams.com/site/book/trip/trip-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { type: "trip", id: "trip-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.email).toBe("Please enter a valid email address");
    });

    it("returns error when participants < 1", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("firstName", "John");
      formData.set("lastName", "Doe");
      formData.set("email", "john@test.com");
      formData.set("participants", "-1");

      const request = new Request("https://demo.divestreams.com/site/book/trip/trip-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { type: "trip", id: "trip-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.participants).toBe("At least 1 participant is required");
    });

    it("returns error when session not selected for course booking", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("firstName", "John");
      formData.set("lastName", "Doe");
      formData.set("email", "john@test.com");
      formData.set("participants", "1");
      // No sessionId for course

      const request = new Request("https://demo.divestreams.com/site/book/course/course-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { type: "course", id: "course-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      expect(result).toHaveProperty("errors");
      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors.sessionId).toBe("Please select a session date");
    });
  });
});
