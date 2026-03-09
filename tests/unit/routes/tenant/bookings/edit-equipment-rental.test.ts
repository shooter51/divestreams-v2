import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn().mockResolvedValue({
    org: { id: "org-1", name: "Test Org", metadata: {} },
    user: { id: "user-1", role: "owner" },
  }),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries.server", () => ({
  getBookingWithFullDetails: vi.fn(),
  getEquipment: vi.fn(),
}));

vi.mock("../../../../../lib/db/tenant.server", () => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  return {
    getTenantDb: vi.fn(() => ({
      db: {
        update: vi.fn(() => ({
          set: mockSet,
        })),
      },
      schema: {
        bookings: {
          organizationId: "organization_id",
          id: "id",
        },
      },
    })),
  };
});

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path, msg, type) => `${path}?notification=${msg}`),
}));

import { getBookingWithFullDetails, getEquipment } from "../../../../../lib/db/queries.server";
import { loader, action } from "../../../../../app/routes/tenant/bookings/$id/edit";

const mockBookingData = {
  id: "booking-1",
  bookingNumber: "BK-001",
  participants: 2,
  status: "confirmed",
  total: 200,
  subtotal: 180,
  tax: 10,
  discount: 0,
  specialRequests: "",
  internalNotes: null,
  customerId: "cust-1",
  tripId: "trip-1",
  customer: {
    id: "cust-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "555-0100",
  },
  trip: {
    id: "trip-1",
    tourId: "tour-1",
    tourName: "Reef Dive",
    date: "2026-04-01",
    startTime: "09:00",
    endTime: "12:00",
    boatName: "Sea Explorer",
  },
  pricing: {
    basePrice: "90.00",
    participants: 2,
    subtotal: "180.00",
    equipmentTotal: "0.00",
    tax: "10.00",
    discount: "0.00",
    total: "200.00",
  },
  paidAmount: "0.00",
  balanceDue: "200.00",
  participantDetails: [],
  equipmentRental: [],
};

const mockEquipment = [
  { id: "eq-1", name: "BCD", rentalPrice: 25, status: "available", isRentable: true, category: "gear" },
  { id: "eq-2", name: "BCD", rentalPrice: 25, status: "available", isRentable: true, category: "gear" },
  { id: "eq-3", name: "Wetsuit", rentalPrice: 15, status: "available", isRentable: true, category: "gear" },
  { id: "eq-4", name: "Fins", rentalPrice: 10, status: "available", isRentable: true, category: "gear" },
];

describe("Edit Booking - Equipment Rental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getBookingWithFullDetails as Mock).mockResolvedValue(mockBookingData);
    (getEquipment as Mock).mockResolvedValue(mockEquipment);
  });

  describe("loader", () => {
    const makeRequest = () => new Request("https://demo.divestreams.com/tenant/bookings/booking-1/edit");

    it("returns rental equipment grouped by name+price", async () => {
      const result = await loader({
        request: makeRequest(),
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.rentalEquipment).toHaveLength(3); // BCD, Wetsuit, Fins
      const bcd = result.rentalEquipment.find((e: { name: string }) => e.name === "BCD");
      expect(bcd).toBeDefined();
      expect(bcd!.count).toBe(2); // 2 BCDs grouped
      expect(bcd!.price).toBe("25.00");
      expect(bcd!.ids).toHaveLength(2);
    });

    it("returns existing rental names for pre-selection", async () => {
      (getBookingWithFullDetails as Mock).mockResolvedValue({
        ...mockBookingData,
        equipmentRental: [
          { item: "BCD", price: 50 },
          { item: "Wetsuit", price: 30 },
        ],
      });

      const result = await loader({
        request: makeRequest(),
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.existingRentalNames).toEqual(["BCD", "Wetsuit"]);
    });

    it("returns empty existingRentalNames when no equipment rented", async () => {
      const result = await loader({
        request: makeRequest(),
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.existingRentalNames).toEqual([]);
    });

    it("fetches only rentable and available equipment", async () => {
      await loader({
        request: makeRequest(),
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(getEquipment).toHaveBeenCalledWith("org-1", { isRentable: true, status: "available" });
    });
  });

  describe("action", () => {
    it("updates booking with equipment rental data", async () => {
      const formData = new FormData();
      formData.set("participants", "2");
      formData.set("status", "confirmed");
      formData.set("specialRequests", "");
      formData.set("internalNotes", "");
      formData.append("equipment", "eq-1"); // BCD
      formData.append("equipment", "eq-3"); // Wetsuit

      const request = new Request("https://demo.divestreams.com/tenant/bookings/booking-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({
        request,
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      // Verify getEquipment was called to look up item details
      expect(getEquipment).toHaveBeenCalledWith("org-1", { isRentable: true });
    });

    it("sets equipmentRental to null when no equipment selected", async () => {
      const formData = new FormData();
      formData.set("participants", "1");
      formData.set("status", "pending");
      formData.set("specialRequests", "");
      formData.set("internalNotes", "");
      // No equipment checkboxes

      const request = new Request("https://demo.divestreams.com/tenant/bookings/booking-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({
        request,
        params: { id: "booking-1" },
        context: {},
      } as Parameters<typeof action>[0]);

      // getEquipment should NOT be called when no equipment selected
      expect(getEquipment).not.toHaveBeenCalled();
    });
  });
});
