import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../../lib/db/mutations.public", () => ({
  getBookingDetails: vi.fn().mockResolvedValue(null),
  getEnrollmentDetails: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../components/ui", () => ({
  StatusBadge: vi.fn(),
  Badge: vi.fn(),
}));

import { db } from "../../../../../lib/db";
import { getSubdomainFromHost } from "../../../../../lib/utils/url";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";
import { getBookingDetails, getEnrollmentDetails } from "../../../../../lib/db/mutations.public";
import { loader } from "../../../../../app/routes/site/book/confirm";

describe("site/book/confirm route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop" };
  const mockBooking = {
    id: "b-1",
    bookingNumber: "BK-ABC123",
    status: "pending",
    paymentStatus: "pending",
    participants: 2,
    subtotal: "300.00",
    tax: "0.00",
    total: "300.00",
    currency: "USD",
    specialRequests: null,
    createdAt: "2025-06-15T10:00:00Z",
    customer: {
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      phone: "555-1234",
    },
    trip: {
      id: "trip-1",
      date: "2025-07-15",
      startTime: "08:00",
      endTime: "12:00",
      tourName: "Reef Explorer",
      primaryImage: null,
    },
  };
  const mockEnrollment = {
    id: "enr-1",
    status: "enrolled",
    paymentStatus: "pending",
    price: "500.00",
    currency: "USD",
    notes: null,
    enrolledAt: "2025-06-15T10:00:00Z",
    customer: {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@test.com",
      phone: null,
    },
    course: { name: "PADI Open Water" },
    session: {
      startDate: "2025-08-01",
      startTime: "09:00",
      endDate: "2025-08-04",
      location: null,
      instructorName: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chain implementations after clearAllMocks
    (db.select as Mock).mockReturnThis();
    (db.from as Mock).mockReturnThis();
    (db.where as Mock).mockReturnThis();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (db.limit as Mock).mockResolvedValue([mockOrg]);
    (getCustomerBySession as Mock).mockResolvedValue(null);
    (getBookingDetails as Mock).mockResolvedValue(null);
    (getEnrollmentDetails as Mock).mockResolvedValue(null);
  });

  describe("loader", () => {
    it("throws 400 when booking id is missing", async () => {
      const request = new Request("https://demo.divestreams.com/site/book/confirm");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when org not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request(
        "https://unknown.divestreams.com/site/book/confirm?id=b-1&ref=BK-123"
      );
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

    it("returns booking confirmation data", async () => {
      (getBookingDetails as Mock).mockResolvedValue(mockBooking);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?id=b-1&ref=BK-ABC123"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.confirmationType).toBe("booking");
      expect(result.booking).toEqual(mockBooking);
      expect(result.organizationName).toBe("Demo Dive Shop");
      expect(result.isLoggedIn).toBe(false);
    });

    it("throws 404 when booking not found", async () => {
      (getBookingDetails as Mock).mockResolvedValue(null);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?id=nonexistent&ref=BK-000"
      );
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

    it("returns enrollment confirmation data when type=enrollment", async () => {
      (getEnrollmentDetails as Mock).mockResolvedValue(mockEnrollment);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?type=enrollment&id=enr-1&ref=BK-ENR"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.confirmationType).toBe("enrollment");
      expect(result.enrollment).toEqual(mockEnrollment);
      expect(result.bookingRef).toBe("BK-ENR");
      expect(result.organizationName).toBe("Demo Dive Shop");
    });

    it("throws 404 when enrollment not found", async () => {
      (getEnrollmentDetails as Mock).mockResolvedValue(null);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?type=enrollment&id=nonexistent"
      );
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

    it("returns isLoggedIn=true when customer session exists", async () => {
      (getCustomerBySession as Mock).mockResolvedValue({ id: "cust-1" });
      (getBookingDetails as Mock).mockResolvedValue(mockBooking);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?id=b-1&ref=BK-ABC123"
      );
      request.headers.append("Cookie", "customer_session=valid-token");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.isLoggedIn).toBe(true);
    });

    it("returns isLoggedIn=false when no customer session", async () => {
      (getCustomerBySession as Mock).mockResolvedValue(null);
      (getBookingDetails as Mock).mockResolvedValue(mockBooking);

      const request = new Request(
        "https://demo.divestreams.com/site/book/confirm?id=b-1&ref=BK-ABC123"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.isLoggedIn).toBe(false);
    });
  });
});
