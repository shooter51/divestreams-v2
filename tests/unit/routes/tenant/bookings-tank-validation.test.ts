/**
 * DS-6wqg: Tank & gas selection not enforced on booking forms
 *
 * Tests that server-side validation rejects bookings when:
 * - The tour has requiresTankSelection: true
 * - No tank/gas selection data is provided in the form
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
  getTrips: vi.fn(),
  getEquipment: vi.fn(),
  createBooking: vi.fn(),
  getCustomerById: vi.fn(),
  getTripById: vi.fn(),
}));

vi.mock("../../../../lib/email/triggers", () => ({
  triggerBookingConfirmation: vi.fn(),
  getNotificationSettings: vi.fn(() => ({ emailBookingConfirmation: false })),
}));

import { action } from "../../../../app/routes/tenant/bookings/new";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  createBooking,
  getCustomerById,
  getTripById,
} from "../../../../lib/db/queries.server";

const TRIP_UUID = "a1b2c3d4-0000-0000-0000-000000000001";
const CUSTOMER_UUID = "a1b2c3d4-0000-0000-0000-000000000002";

const mockCustomer = {
  id: CUSTOMER_UUID,
  firstName: "Alice",
  lastName: "Diver",
  email: "alice@example.com",
};

const mockOrgContext = {
  user: { id: "user-1", name: "Staff", email: "staff@demo.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", slug: "demo", name: "Demo Dive Shop", metadata: {} },
  membership: { role: "owner" },
  subscription: null,
};

function makeRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/bookings/new", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

describe("DS-6wqg: Tank & gas selection validation on tenant booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCustomerById as Mock).mockResolvedValue(mockCustomer);
    (createBooking as Mock).mockResolvedValue({
      id: "booking-1",
      bookingNumber: "BK-0001",
    });
  });

  it("returns validation error when tour requires tank selection but none provided", async () => {
    // Tour with requiresTankSelection: true
    const tripWithTankRequired = {
      id: TRIP_UUID,
      tourName: "Morning 2-Tank Dive",
      date: "2026-06-01",
      startTime: "08:00",
      price: 120,
      spotsAvailable: 4,
      requiresTankSelection: true,
    };
    (getTripById as Mock).mockResolvedValue(tripWithTankRequired);

    const fd = new FormData();
    fd.append("tripId", TRIP_UUID);
    fd.append("customerId", CUSTOMER_UUID);
    fd.append("participants", "2");
    fd.append("source", "direct");
    // No tankSelection data provided

    const result = await action(actionArgs(makeRequest(fd)));

    // Should return a validation error, NOT a redirect
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toHaveProperty("errors");
    const errors = (result as { errors: Record<string, string> }).errors;
    expect(errors).toHaveProperty("tankSelection");
    expect(errors.tankSelection).toMatch(/tank|gas/i);
  });

  it("allows booking when tour requires tank selection and data is provided", async () => {
    const tripWithTankRequired = {
      id: TRIP_UUID,
      tourName: "Morning 2-Tank Dive",
      date: "2026-06-01",
      startTime: "08:00",
      price: 120,
      spotsAvailable: 4,
      requiresTankSelection: true,
    };
    (getTripById as Mock).mockResolvedValue(tripWithTankRequired);

    const fd = new FormData();
    fd.append("tripId", TRIP_UUID);
    fd.append("customerId", CUSTOMER_UUID);
    fd.append("participants", "2");
    fd.append("source", "direct");
    fd.append("tankSelection", JSON.stringify([
      { tankSize: "AL80", gasType: "air" },
      { tankSize: "AL80", gasType: "nitrox32" },
    ]));

    const result = await action(actionArgs(makeRequest(fd)));

    // Should succeed — redirect
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it("allows booking when tour does NOT require tank selection", async () => {
    const tripWithoutTankRequired = {
      id: TRIP_UUID,
      tourName: "Snorkel Tour",
      date: "2026-06-01",
      startTime: "08:00",
      price: 60,
      spotsAvailable: 10,
      requiresTankSelection: false,
    };
    (getTripById as Mock).mockResolvedValue(tripWithoutTankRequired);

    const fd = new FormData();
    fd.append("tripId", TRIP_UUID);
    fd.append("customerId", CUSTOMER_UUID);
    fd.append("participants", "1");
    fd.append("source", "direct");
    // No tankSelection — should be fine since tour doesn't require it

    const result = await action(actionArgs(makeRequest(fd)));

    // Should succeed — redirect
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });
});
