import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/bookings/index";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("app/routes/tenant/bookings/index.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
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

      const mockCount = [{ value: 1 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

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
      const mockBookings: unknown[] = [];
      const mockCount = [{ value: 0 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings?status=confirmed");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.status).toBe("confirmed");
      expect(result.bookings).toHaveLength(0);
    });

    it("should handle pagination correctly", async () => {
      const mockBookings: unknown[] = [];
      const mockCount = [{ value: 50 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings?page=2");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3); // 50 total / 20 per page = 2.5 rounded up to 3
      expect(mockSelectBuilder.offset).toHaveBeenCalledWith(20); // Page 2 = offset 20
    });

    it("should include search parameter in results", async () => {
      const mockBookings: unknown[] = [];
      const mockCount = [{ value: 0 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings?search=john");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.search).toBe("john");
    });

    it("should calculate stats correctly", async () => {
      const mockBookings = [
        {
          id: "booking-1",
          bookingNumber: "BK-001",
          status: "confirmed",
          participants: 2,
          total: "200.00",
          paidAmount: "200.00",
          createdAt: new Date(),
          customerId: "cust-1",
          customerFirstName: "John",
          customerLastName: "Doe",
          customerEmail: "john@example.com",
          tripId: "trip-1",
          tripDate: new Date(),
          tripTime: "09:00",
          tourName: "Reef Dive",
        },
        {
          id: "booking-2",
          bookingNumber: "BK-002",
          status: "pending",
          participants: 1,
          total: "100.00",
          paidAmount: "50.00",
          createdAt: new Date(),
          customerId: "cust-2",
          customerFirstName: "Jane",
          customerLastName: "Smith",
          customerEmail: "jane@example.com",
          tripId: "trip-2",
          tripDate: new Date(),
          tripTime: "14:00",
          tourName: "Wreck Dive",
        },
      ];

      const mockCount = [{ value: 2 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.stats.upcoming).toBe(1); // 1 confirmed booking
      expect(result.stats.pendingPayment).toBe(1); // 1 booking with partial payment
    });

    it("should handle freemium limits", async () => {
      const mockBookings: unknown[] = [];
      const mockCount = [{ value: 0 }];
      const mockMonthlyCount = [{ value: 95 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      const mockMonthlyCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockMonthlyCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else if (selectCallCount === 2) {
          return mockCountBuilder as unknown;
        } else {
          return mockMonthlyCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: false,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

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
          tripDate: "2024-02-01", // String date
          tripTime: "09:00",
          tourName: "Reef Dive",
        },
      ];

      const mockCount = [{ value: 1 }];

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockBookings),
      };

      const mockCountBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockCount),
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockSelectBuilder as unknown;
        } else {
          return mockCountBuilder as unknown;
        }
      });

      vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
        org: { id: mockOrganizationId, name: "Test Org", subdomain: "test" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 100 },
        isPremium: false,
      } as unknown);

      const request = new Request("http://test.com/tenant/bookings");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.bookings[0].trip.date).toBe("2024-02-01");
    });
  });
});
