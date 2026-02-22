/**
 * Contract tests: POST /tenant/bookings/new
 *
 * Validates response shapes for the booking creation action — specifically:
 *
 * 1. Schema validation errors return { errors, values } (not 500)
 * 2. "Customer not found" returns a field error (not 500)
 * 3. "Trip not found" returns a field error (not 500)
 * 4. "No spots" race condition returns a field-level error (not 500)
 *    This is the critical contract: createBooking() throws when two users
 *    book the last spot concurrently; the action MUST surface it as a
 *    user-visible field error rather than crashing.
 * 5. Email delivery failure does NOT fail the booking — success redirect
 *    is still returned.
 * 6. Happy path returns a 302 redirect to /tenant/bookings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
  getTrips: vi.fn(),
  getEquipment: vi.fn(),
  createBooking: vi.fn(),
  getCustomerById: vi.fn(),
  getTripById: vi.fn(),
}));

vi.mock("../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
}));

import { action } from "../../app/routes/tenant/bookings/new";
import { requireOrgContext } from "../../lib/auth/org-context.server";
import {
  createBooking,
  getCustomerById,
  getTripById,
} from "../../lib/db/queries.server";
import { triggerBookingConfirmation } from "../../lib/email/triggers";

const TRIP_UUID = "a1b2c3d4-0000-0000-0000-000000000001";
const CUSTOMER_UUID = "a1b2c3d4-0000-0000-0000-000000000002";

const mockCustomer = {
  id: CUSTOMER_UUID,
  firstName: "Alice",
  lastName: "Diver",
  email: "alice@example.com",
};

const mockTrip = {
  id: TRIP_UUID,
  tourName: "Morning 2-Tank Dive",
  date: "2026-06-01",
  startTime: "08:00",
  price: 120,
  spotsAvailable: 4,
};

const mockOrgContext = {
  user: { id: "user-1", name: "Staff", email: "staff@demo.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", slug: "demo", name: "Demo Dive Shop" },
  membership: { role: "owner" },
  subscription: null,
};

function makeValidFormData(): FormData {
  const fd = new FormData();
  fd.append("tripId", TRIP_UUID);
  fd.append("customerId", CUSTOMER_UUID);
  fd.append("participants", "2");
  fd.append("source", "direct");
  return fd;
}

function makeRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/bookings/new", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

describe("Contract: POST /tenant/bookings/new", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCustomerById as Mock).mockResolvedValue(mockCustomer);
    (getTripById as Mock).mockResolvedValue(mockTrip);
    (createBooking as Mock).mockResolvedValue({
      id: "booking-1",
      bookingNumber: "BK-0001",
    });
    (triggerBookingConfirmation as Mock).mockResolvedValue(undefined);
  });

  describe("Validation errors", () => {
    it("returns { errors, values } when tripId is missing", async () => {
      const fd = new FormData();
      fd.append("customerId", CUSTOMER_UUID);
      fd.append("participants", "1");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("values");
      expect(result).not.toBeInstanceOf(Response);
    });

    it("returns { errors, values } when customerId is missing", async () => {
      const fd = new FormData();
      fd.append("tripId", TRIP_UUID);
      fd.append("participants", "1");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("values");
    });

    it("returns { errors, values } when IDs are not valid UUIDs", async () => {
      const fd = new FormData();
      fd.append("tripId", "not-a-uuid");
      fd.append("customerId", "also-not-a-uuid");
      fd.append("participants", "1");
      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("errors");
      expect(result).not.toBeInstanceOf(Response);
    });
  });

  describe("Not-found errors", () => {
    it("returns { errors: { customerId } } when customer does not exist", async () => {
      (getCustomerById as Mock).mockResolvedValue(null);

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors).toHaveProperty("customerId");
      expect(result).not.toBeInstanceOf(Response);
    });

    it("returns { errors: { tripId } } when trip does not exist", async () => {
      (getTripById as Mock).mockResolvedValue(null);

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      expect(result).toHaveProperty("errors");
      expect((result as { errors: Record<string, string> }).errors).toHaveProperty("tripId");
      expect(result).not.toBeInstanceOf(Response);
    });
  });

  describe("Race condition: no spots available", () => {
    it("returns { errors: { tripId }, values } when createBooking throws a 'spots' error", async () => {
      (createBooking as Mock).mockRejectedValue(
        new Error("No spots available on this trip")
      );

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      // Contract: must NOT be a 500/throw — must return user-facing field error
      expect(result).not.toBeInstanceOf(Response);
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("values");

      const errors = (result as { errors: Record<string, string> }).errors;
      expect(errors).toHaveProperty("tripId");
      expect(errors.tripId).toContain("spots");
    });

    it("re-throws non-spots errors (unknown failures go to error boundary)", async () => {
      (createBooking as Mock).mockRejectedValue(new Error("DB connection lost"));

      await expect(
        action(actionArgs(makeRequest(makeValidFormData())))
      ).rejects.toThrow("DB connection lost");
    });
  });

  describe("Email resilience", () => {
    it("returns a success redirect even when confirmation email throws", async () => {
      (triggerBookingConfirmation as Mock).mockRejectedValue(
        new Error("SMTP server down")
      );

      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      // Contract: email failure must NOT fail the booking
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });
  });

  describe("Success", () => {
    it("redirects to /tenant/bookings on successful booking", async () => {
      const result = await action(actionArgs(makeRequest(makeValidFormData())));

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);

      const location = (result as Response).headers.get("Location") ?? "";
      expect(location).toContain("/tenant/bookings");
    });
  });
});
