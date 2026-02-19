import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit Tests for Public Site Booking Page Action (KAN-638)
 *
 * Tests the booking form action handler for both trip bookings
 * and training course enrollments.
 */

// ============================================================================
// MOCKS
// ============================================================================

// Hoisted values used inside vi.mock factories
const { mockRedirect, queryResults, createChainableDbMock } = vi.hoisted(() => {
  const mockRedirect = vi.fn();

  // Shared queue of results: each call to a terminal method (limit, returning,
  // or awaiting where) shifts the next result off this queue.
  const queryResults: any[][] = [];

  function createChainableDbMock() {
    const handler: ProxyHandler<any> = {
      get(_target, prop) {
        if (prop === "then") {
          // Make the proxy thenable - resolve with next queued result
          const result = queryResults.shift() || [];
          return (resolve: any) => resolve(result);
        }
        if (prop === "transaction") {
          return (fn: any) => {
            // Create a new proxy for the transaction context
            const txProxy = new Proxy({}, handler);
            return fn(txProxy);
          };
        }
        // All other methods return the proxy for chaining
        return (..._args: any[]) => new Proxy({}, handler);
      },
    };

    return new Proxy({}, handler);
  }

  return { mockRedirect, queryResults, createChainableDbMock };
});

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string, init?: ResponseInit) => {
      mockRedirect(url, init);
      return new Response(null, {
        status: 302,
        headers: { Location: url },
      });
    },
  };
});

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "ABCD"),
}));

vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn(() => "demo"),
}));

vi.mock("../../../../lib/jobs", () => ({
  getEmailQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../../lib/db", () => ({
  db: createChainableDbMock(),
}));

// Mock schema - provide column references as strings
vi.mock("../../../../lib/db/schema", () => {
  const createTable = (name: string, columns: string[]) => {
    const table: any = {};
    for (const col of columns) {
      table[col] = `${name}.${col}`;
    }
    return table;
  };

  return {
    trips: createTable("trips", [
      "id", "tourId", "date", "startTime", "endTime", "maxParticipants",
      "price", "status", "isPublic", "organizationId",
    ]),
    tours: createTable("tours", [
      "id", "name", "description", "type", "price", "currency", "duration",
      "maxParticipants", "includesEquipment", "includesMeals",
      "includesTransport", "isActive",
    ]),
    bookings: createTable("bookings", [
      "id", "organizationId", "bookingNumber", "tripId", "customerId",
      "participants", "status", "subtotal", "discount", "tax", "total",
      "currency", "paymentStatus", "specialRequests", "equipmentRental",
      "source",
    ]),
    customers: createTable("customers", [
      "id", "organizationId", "email", "firstName", "lastName", "phone",
      "dateOfBirth", "updatedAt",
    ]),
    equipment: createTable("equipment", [
      "id", "organizationId", "name", "category", "rentalPrice",
      "isRentable", "status", "isPublic",
    ]),
    organization: createTable("organization", [
      "id", "name", "slug", "customDomain",
    ]),
    trainingCourses: createTable("trainingCourses", [
      "id", "organizationId", "name", "description", "price", "currency",
      "durationDays", "maxStudents", "equipmentIncluded", "isActive",
      "isPublic", "agencyId", "levelId", "depositAmount",
    ]),
    trainingSessions: createTable("trainingSessions", [
      "id", "organizationId", "courseId", "startDate", "endDate",
      "startTime", "maxStudents", "priceOverride", "status",
      "enrolledCount", "completedCount", "location", "instructorName",
    ]),
    trainingEnrollments: createTable("trainingEnrollments", [
      "id", "organizationId", "sessionId", "customerId", "status",
      "paymentStatus", "amountPaid", "notes", "enrolledAt",
    ]),
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: any[]) => ({ type: "and", conditions: args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({
      type: "sql",
      strings,
      values,
    }),
    {
      join: vi.fn(),
    }
  ),
}));

import { action } from "../../../../app/routes/site/book/$type.$id";

// ============================================================================
// HELPERS
// ============================================================================

function makeActionArgs(
  type: string,
  id: string,
  formData: FormData,
  host = "demo.divestreams.com"
) {
  const request = new Request(`https://${host}/site/book/${type}/${id}`, {
    method: "POST",
    body: formData,
  });

  return {
    request,
    params: { type, id },
    context: {},
    unstable_pattern: "",
  } as any;
}

function makeBookingFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const defaults: Record<string, string> = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "555-1234",
    participants: "2",
    specialRequests: "None",
  };

  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    formData.append(key, value);
  }
  return formData;
}

/** Queue results that the mock DB will return in order */
function queueResults(...results: any[][]) {
  queryResults.length = 0; // clear
  for (const r of results) {
    queryResults.push(r);
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe("Booking Action - $type.$id.tsx (KAN-638)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockClear();
    queryResults.length = 0;
  });

  // --------------------------------------------------------------------------
  // Validation Tests
  // --------------------------------------------------------------------------

  describe("validation", () => {
    it("returns errors when guest user omits required fields", async () => {
      // Org lookup
      queueResults(
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }]
      );

      const formData = new FormData();
      formData.append("participants", "1");

      const result = await action(makeActionArgs("trip", "trip-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors).toBeDefined();
      expect(data.errors.firstName).toBe("First name is required");
      expect(data.errors.lastName).toBe("Last name is required");
      expect(data.errors.email).toBe("Email is required");
    });

    it("returns error for invalid email format", async () => {
      queueResults(
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }]
      );

      const formData = makeBookingFormData({ email: "not-an-email" });
      const result = await action(makeActionArgs("trip", "trip-1", formData));

      const data = result as { errors: Record<string, string> };
      expect(data.errors).toBeDefined();
      expect(data.errors.email).toBe("Please enter a valid email address");
    });

    it("returns error when course has no session selected", async () => {
      queueResults(
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }]
      );

      const formData = makeBookingFormData();
      const result = await action(makeActionArgs("course", "course-1", formData));

      const data = result as { errors: Record<string, string> };
      expect(data.errors).toBeDefined();
      expect(data.errors.sessionId).toBe("Please select a session date");
    });

    it("returns error when organization is not found", async () => {
      queueResults([]); // No org found

      const formData = makeBookingFormData();
      const result = await action(makeActionArgs("trip", "trip-1", formData));

      const data = result as { errors: Record<string, string> };
      expect(data.errors._form).toBe("Organization not found");
    });
  });

  // --------------------------------------------------------------------------
  // Training Course Enrollment Tests (KAN-638 core fix)
  // --------------------------------------------------------------------------

  describe("training course enrollment", () => {
    it("creates enrollment for training course session and redirects to confirmation", async () => {
      queueResults(
        // 1. Org lookup
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Training session lookup - found
        [{
          id: "session-1",
          courseId: "course-1",
          startDate: "2026-06-15",
          startTime: "09:00",
          maxStudents: 10,
          status: "scheduled",
        }],
        // 3. Customer lookup - not found
        [],
        // 4. Customer insert returning
        [{ id: "new-cust-1" }],
        // 5. Course details
        [{
          id: "course-1",
          name: "Open Water Diver",
          price: "450.00",
          currency: "USD",
          maxStudents: 10,
        }],
        // 6. Enrollment count
        [{ count: 3 }],
        // 7. Enrollment inserts (2 participants)
        [{ id: "enrollment-1" }],
        [{ id: "enrollment-2" }],
        // 8. Session enrolledCount update
        [],
      );

      const formData = makeBookingFormData({
        sessionId: "session-1",
        participants: "2",
      });

      const result = await action(makeActionArgs("course", "course-1", formData));

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);

      const location = response.headers.get("Location");
      expect(location).toContain("/site/book/confirm");
      expect(location).toContain("type=enrollment");
      expect(location).toContain("id=enrollment-1");
    });

    it("returns error when training session is full", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Training session
        [{
          id: "session-1",
          courseId: "course-1",
          startDate: "2026-06-15",
          startTime: "09:00",
          maxStudents: 5,
          status: "scheduled",
        }],
        // 3. Customer lookup - existing
        [{ id: "existing-cust-1" }],
        // 4. Customer update
        [],
        // 5. Course details
        [{
          id: "course-1",
          name: "Open Water Diver",
          price: "450.00",
          currency: "USD",
          maxStudents: 5,
        }],
        // 6. Enrollment count - full
        [{ count: 5 }],
      );

      const formData = makeBookingFormData({
        sessionId: "session-1",
        participants: "1",
      });

      const result = await action(makeActionArgs("course", "course-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors.participants).toContain("0 spots available");
    });

    it("returns error when training session is in the past", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Training session - past date
        [{
          id: "session-1",
          courseId: "course-1",
          startDate: "2020-01-01",
          startTime: "09:00",
          maxStudents: 10,
          status: "scheduled",
        }],
        // 3. Customer lookup - existing
        [{ id: "existing-cust-1" }],
        // 4. Customer update
        [],
        // 5. Course details
        [{
          id: "course-1",
          name: "Open Water Diver",
          price: "450.00",
          currency: "USD",
          maxStudents: 10,
        }],
        // 6. Enrollment count
        [{ count: 0 }],
      );

      const formData = makeBookingFormData({
        sessionId: "session-1",
        participants: "1",
      });

      const result = await action(makeActionArgs("course", "course-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors._form).toBe("Cannot book past sessions");
    });

    it("returns error when training course is not found", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Training session found
        [{
          id: "session-1",
          courseId: "course-1",
          startDate: "2026-06-15",
          startTime: "09:00",
          maxStudents: 10,
          status: "scheduled",
        }],
        // 3. Customer lookup - existing
        [{ id: "existing-cust-1" }],
        // 4. Customer update
        [],
        // 5. Course details - NOT FOUND
        [],
      );

      const formData = makeBookingFormData({
        sessionId: "session-1",
        participants: "1",
      });

      const result = await action(makeActionArgs("course", "course-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors._form).toBe("Course not found");
    });
  });

  // --------------------------------------------------------------------------
  // Trip Booking (existing flow - regression test)
  // --------------------------------------------------------------------------

  describe("trip booking", () => {
    it("creates booking for trip and redirects to confirmation", async () => {
      queueResults(
        // 1. Org lookup
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Customer lookup - existing
        [{ id: "existing-cust-1" }],
        // 3. Customer update
        [],
        // --- inside transaction ---
        // 4. Trip data (SELECT ... FOR UPDATE)
        [{
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Morning Reef Dive",
          tripPrice: "75.00",
          tourPrice: "75.00",
          currency: "USD",
          tripMaxParticipants: 12,
          tourMaxParticipants: 12,
          status: "scheduled",
          date: "2026-07-20",
          startTime: "08:00",
        }],
        // 5. Booking count
        [{ total: 4 }],
        // 6. Insert booking returning
        [{
          id: "booking-1",
          bookingNumber: "BK-TEST-ABCD",
        }],
      );

      const formData = makeBookingFormData({ participants: "2" });
      const result = await action(makeActionArgs("trip", "trip-1", formData));

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);

      const location = response.headers.get("Location");
      expect(location).toContain("/site/book/confirm");
      expect(location).toContain("id=booking-1");
      expect(location).toContain("ref=BK-TEST-ABCD");
      // Should NOT contain type=enrollment for trip bookings
      expect(location).not.toContain("type=enrollment");
    });

    it("returns error when trip session is not found in transaction", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Customer
        [{ id: "existing-cust-1" }],
        // 3. Customer update
        [],
        // 4. Trip lookup in tx - NOT FOUND
        [],
      );

      const formData = makeBookingFormData({ participants: "1" });
      const result = await action(makeActionArgs("trip", "trip-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors._form).toContain("not found");
    });

    it("returns error when trip has insufficient spots", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Customer
        [{ id: "existing-cust-1" }],
        // 3. Customer update
        [],
        // 4. Trip data
        [{
          id: "trip-1",
          tourId: "tour-1",
          tourName: "Morning Reef Dive",
          tripPrice: "75.00",
          tourPrice: "75.00",
          currency: "USD",
          tripMaxParticipants: 6,
          tourMaxParticipants: 6,
          status: "scheduled",
          date: "2026-07-20",
          startTime: "08:00",
        }],
        // 5. Booking count - 5 already booked, requesting 3
        [{ total: 5 }],
      );

      const formData = makeBookingFormData({ participants: "3" });
      const result = await action(makeActionArgs("trip", "trip-1", formData));

      expect(result).not.toBeInstanceOf(Response);
      const data = result as { errors: Record<string, string> };
      expect(data.errors.participants).toContain("1 spots available");
    });
  });

  // --------------------------------------------------------------------------
  // Tours-based course booking (session from trips table, not trainingSessions)
  // --------------------------------------------------------------------------

  describe("tours-based course booking", () => {
    it("falls through to trip-based booking when session is not in trainingSessions", async () => {
      queueResults(
        // 1. Org
        [{ id: "org-1", name: "Test Dive Shop", slug: "demo" }],
        // 2. Training session lookup - NOT found
        [],
        // 3. Customer lookup
        [{ id: "existing-cust-1" }],
        // 4. Customer update
        [],
        // --- inside transaction ---
        // 5. Trip data
        [{
          id: "trip-session-1",
          tourId: "tour-1",
          tourName: "Discover Scuba",
          tripPrice: "150.00",
          tourPrice: "150.00",
          currency: "USD",
          tripMaxParticipants: 8,
          tourMaxParticipants: 8,
          status: "scheduled",
          date: "2026-08-01",
          startTime: "10:00",
        }],
        // 6. Booking count
        [{ total: 2 }],
        // 7. Insert booking
        [{
          id: "booking-2",
          bookingNumber: "BK-COURSE-ABCD",
        }],
      );

      const formData = makeBookingFormData({
        sessionId: "trip-session-1",
        participants: "1",
      });

      const result = await action(makeActionArgs("course", "tour-1", formData));

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);

      const location = response.headers.get("Location");
      expect(location).toContain("/site/book/confirm");
      expect(location).toContain("id=booking-2");
      expect(location).not.toContain("type=enrollment");
    });
  });
});
