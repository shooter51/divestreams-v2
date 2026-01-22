/**
 * Tenant Bookings Index Route Tests
 *
 * Tests the bookings list page loader with filtering, pagination, and freemium limits.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/tenant/bookings/index";

// Mock auth
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked modules
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

describe("Route: tenant/bookings/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBookings = [
    {
      id: "booking-1",
      bookingNumber: "BK-2024-001",
      status: "confirmed",
      participants: 2,
      total: "150.00",
      paidAmount: "150.00",
      createdAt: new Date("2024-01-01T10:00:00Z"),
      customerId: "customer-1",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerEmail: "john@example.com",
      tripId: "trip-1",
      tripDate: new Date("2024-02-01"),
      tripTime: "09:00",
      tourName: "Morning Dive",
    },
    {
      id: "booking-2",
      bookingNumber: "BK-2024-002",
      status: "pending",
      participants: 4,
      total: "300.00",
      paidAmount: "100.00",
      createdAt: new Date("2024-01-02T14:00:00Z"),
      customerId: "customer-2",
      customerFirstName: "Jane",
      customerLastName: "Smith",
      customerEmail: "jane@example.com",
      tripId: "trip-2",
      tripDate: new Date("2024-02-05"),
      tripTime: "14:00",
      tourName: "Afternoon Adventure",
    },
  ];

  describe("loader", () => {
    it("should load bookings list without filters", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          // First call: bookings query with 3 leftJoin calls
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue(mockBookings);
        } else if (selectCallCount === 2) {
          // Second call: total count
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 2 }]);
        } else if (selectCallCount === 3) {
          // Third call: monthly count
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 15 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.bookings).toHaveLength(2);
      expect(result.bookings[0]).toEqual({
        id: "booking-1",
        bookingNumber: "BK-2024-001",
        customer: {
          id: "customer-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
        trip: {
          id: "trip-1",
          tourName: "Morning Dive",
          date: new Date("2024-02-01").toLocaleDateString(),
          startTime: "09:00",
        },
        participants: 2,
        total: "150.00",
        status: "confirmed",
        paidAmount: "150.00",
        createdAt: new Date("2024-01-01T10:00:00Z").toLocaleDateString(),
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.search).toBe("");
      expect(result.status).toBe("");
      expect(result.canAddBooking).toBe(true);
      expect(result.usage).toBe(15);
      expect(result.limit).toBe(50);
      expect(result.isPremium).toBe(false);
    });

    it("should load bookings list with status filter", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings?status=confirmed");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      const confirmedBookings = [mockBookings[0]];

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue(confirmedBookings);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 1 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 15 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].status).toBe("confirmed");
      expect(result.status).toBe("confirmed");
    });

    it("should load bookings list with pagination", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings?page=2");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue([]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 45 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 15 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.page).toBe(2);
      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(3); // Math.ceil(45 / 20) = 3
    });

    it("should handle empty bookings list", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue([]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 0 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 0 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.bookings).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.usage).toBe(0);
    });

    it("should calculate stats correctly", async () => {
      // Arrange
      const today = new Date().toLocaleDateString();
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      const bookingsWithStats = [
        {
          ...mockBookings[0],
          status: "confirmed",
          tripDate: new Date(), // Today
        },
        {
          ...mockBookings[1],
          status: "confirmed",
          tripDate: new Date("2024-02-05"),
        },
        {
          id: "booking-3",
          bookingNumber: "BK-2024-003",
          status: "pending",
          participants: 1,
          total: "100.00",
          paidAmount: "50.00",
          createdAt: new Date("2024-01-03"),
          customerId: "customer-3",
          customerFirstName: "Bob",
          customerLastName: "Johnson",
          customerEmail: "bob@example.com",
          tripId: "trip-3",
          tripDate: new Date("2024-02-10"),
          tripTime: "10:00",
          tourName: "Wreck Dive",
        },
      ];

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue(bookingsWithStats);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 3 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 15 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats.today).toBe(1); // One booking for today
      expect(result.stats.upcoming).toBe(2); // Two confirmed bookings
      expect(result.stats.pendingPayment).toBe(2); // Two bookings with partial payment (mockBookings[1] and booking-3)
    });

    it("should handle null customer and trip fields", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 50 },
        isPremium: false,
      });

      const bookingsWithNulls = [
        {
          ...mockBookings[0],
          customerFirstName: null,
          customerLastName: null,
          customerEmail: null,
          tourName: null,
          tripTime: null,
        },
      ];

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue(bookingsWithNulls);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 1 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 15 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.bookings[0].customer.firstName).toBe("");
      expect(result.bookings[0].customer.lastName).toBe("");
      expect(result.bookings[0].customer.email).toBe("");
      expect(result.bookings[0].trip.tourName).toBe("Unknown Tour");
      expect(result.bookings[0].trip.startTime).toBe("");
    });

    it("should handle freemium limits for free tier", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: false, // At limit
        limits: { bookingsPerMonth: 20 },
        isPremium: false,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue([]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 0 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 20 }]); // At limit
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.canAddBooking).toBe(false);
      expect(result.usage).toBe(20);
      expect(result.limit).toBe(20);
      expect(result.isPremium).toBe(false);
    });

    it("should handle premium tier without limits", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/bookings");
      (requireOrgContext as any).mockResolvedValue({
        org: { id: "org-123" },
        canAddBooking: true,
        limits: { bookingsPerMonth: 999999 },
        isPremium: true,
      });

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockLeftJoin = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        const mockOffset = vi.fn();

        if (selectCallCount === 1) {
          const queryChain = {
            leftJoin: mockLeftJoin,
            where: mockWhere,
          };

          mockFrom.mockReturnValue(queryChain);
          mockLeftJoin.mockReturnValue(queryChain);
          mockWhere.mockReturnValue({ orderBy: mockOrderBy });
          mockOrderBy.mockReturnValue({ limit: mockLimit });
          mockLimit.mockReturnValue({ offset: mockOffset });
          mockOffset.mockResolvedValue(mockBookings);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 2 }]);
        } else if (selectCallCount === 3) {
          mockFrom.mockReturnValue({ where: mockWhere });
          mockWhere.mockResolvedValue([{ value: 100 }]);
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.isPremium).toBe(true);
      expect(result.canAddBooking).toBe(true);
      expect(result.usage).toBe(100);
      expect(result.limit).toBe(999999);
    });
  });
});
