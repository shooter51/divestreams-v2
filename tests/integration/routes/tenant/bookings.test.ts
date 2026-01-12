import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { loader } from "../../../../app/routes/tenant/bookings/index";

// Mock the tenant-auth module
vi.mock("../../../../lib/auth/tenant-auth.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock the queries module
vi.mock("../../../../lib/db/queries.server", () => ({
  getBookings: vi.fn(),
}));

import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getBookings } from "../../../../lib/db/queries.server";

describe("tenant/bookings route", () => {
  const mockTenant = {
    id: "tenant-uuid",
    subdomain: "demo",
    name: "Demo Dive Shop",
    schemaName: "tenant_demo",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireTenant as Mock).mockResolvedValue({ tenant: mockTenant });
  });

  describe("loader", () => {
    it("requires tenant authentication", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      await loader({ request, params: {}, context: {} });

      expect(requireTenant).toHaveBeenCalledWith(request);
    });

    it("fetches bookings with default pagination", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      await loader({ request, params: {}, context: {} });

      expect(getBookings).toHaveBeenCalledWith("tenant_demo", {
        status: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it("filters by status when provided", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/bookings?status=confirmed");
      await loader({ request, params: {}, context: {} });

      expect(getBookings).toHaveBeenCalledWith("tenant_demo", {
        status: "confirmed",
        limit: 20,
        offset: 0,
      });
    });

    it("paginates correctly", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/bookings?page=3");
      await loader({ request, params: {}, context: {} });

      expect(getBookings).toHaveBeenCalledWith("tenant_demo", {
        status: undefined,
        limit: 20,
        offset: 40,
      });
    });

    it("returns formatted bookings with customer info", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "customer-1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Morning Dive",
          tripDate: new Date("2024-01-15"),
          tripTime: "08:00",
          participants: 2,
          total: 150.0,
          status: "confirmed",
          paidAmount: 150.0,
          createdAt: new Date("2024-01-10"),
        },
      ];

      (getBookings as Mock).mockResolvedValue({ bookings: mockBookings, total: 1 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toMatchObject({
        id: "booking-1",
        bookingNumber: "BK-001",
        customer: {
          id: "customer-1",
          firstName: "John",
          lastName: "Smith",
          email: "john@example.com",
        },
        trip: {
          id: "trip-1",
          tourName: "Morning Dive",
          startTime: "08:00",
        },
        participants: 2,
        total: "150.00",
        status: "confirmed",
        paidAmount: "150.00",
      });
    });

    it("returns stats with today's bookings count", async () => {
      const today = new Date();
      const mockBookings = [
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
          createdAt: new Date(),
        },
      ];

      (getBookings as Mock).mockResolvedValue({ bookings: mockBookings, total: 1 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.stats).toBeDefined();
      expect(result.stats.today).toBe(1);
      expect(result.stats.upcoming).toBe(1);
    });

    it("calculates pending payment count correctly", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          customerId: "c1",
          customerFirstName: "John",
          customerLastName: "Smith",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tourName: "Dive",
          tripDate: new Date(),
          tripTime: "08:00",
          participants: 1,
          total: 100.0,
          status: "confirmed",
          paidAmount: 50.0, // Partial payment
          createdAt: new Date(),
        },
        {
          id: "booking-2",
          bookingNumber: "BK-002",
          customerId: "c2",
          customerFirstName: "Jane",
          customerLastName: "Doe",
          customerEmail: "jane@example.com",
          tripId: "trip-2",
          tourName: "Dive",
          tripDate: new Date(),
          tripTime: "10:00",
          participants: 1,
          total: 100.0,
          status: "cancelled", // Cancelled - should not count
          paidAmount: 0,
          createdAt: new Date(),
        },
      ];

      (getBookings as Mock).mockResolvedValue({ bookings: mockBookings, total: 2 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.stats.pendingPayment).toBe(1);
    });

    it("returns empty array when no bookings exist", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.bookings).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.stats.today).toBe(0);
      expect(result.stats.upcoming).toBe(0);
      expect(result.stats.pendingPayment).toBe(0);
    });

    it("returns pagination info", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 100 });

      const request = new Request("https://demo.divestreams.com/app/bookings?page=2");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.page).toBe(2);
      expect(result.total).toBe(100);
    });

    it("returns search and status filter values", async () => {
      (getBookings as Mock).mockResolvedValue({ bookings: [], total: 0 });

      const request = new Request("https://demo.divestreams.com/app/bookings?search=john&status=pending");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("john");
      expect(result.status).toBe("pending");
    });
  });
});
