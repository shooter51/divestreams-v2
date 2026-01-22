/**
 * Site Account Dashboard Route Tests
 *
 * Tests the account dashboard with customer stats and next booking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/site/account/index";

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock customer auth
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../../lib/db";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";

describe("Route: site/account/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    const mockCustomer = {
      id: "cust-123",
      organizationId: "org-123",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
    };

    const mockNextBooking = {
      id: "booking-1",
      bookingNumber: "BK-001",
      status: "confirmed",
      total: "150.00",
      participants: 2,
      tripId: "trip-1",
      tripDate: "2024-06-01",
      tripStartTime: "09:00",
      tourId: "tour-1",
      tourName: "Beginner Dive",
      tourType: "recreational",
    };

    it("should return 401 when no session cookie", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(401);
      }
    });

    it("should return 401 when getCustomerBySession returns null", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=invalid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(getCustomerBySession).toHaveBeenCalledWith("invalid-token");
        expect(error.status).toBe(401);
      }
    });

    it("should return dashboard data with stats and next booking", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Mock all four database queries
      const mockUpcomingResult = [{ count: 3 }];
      const mockTotalResult = [{ count: 10 }];
      const mockSpentResult = [{ total: "1500.50" }];
      const mockNextBookingResult = [mockNextBooking];

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        const mockFrom = vi.fn().mockReturnThis();
        const mockInnerJoin = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockReturnThis();
        const mockLimit = vi.fn();

        // First call: upcoming count
        if (callCount === 1) {
          mockLimit.mockResolvedValue(mockUpcomingResult);
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          mockInnerJoin.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockUpcomingResult);
          return { from: mockFrom };
        }

        // Second call: total trips
        if (callCount === 2) {
          mockLimit.mockResolvedValue(mockTotalResult);
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockTotalResult);
          return { from: mockFrom };
        }

        // Third call: total spent
        if (callCount === 3) {
          mockLimit.mockResolvedValue(mockSpentResult);
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockSpentResult);
          return { from: mockFrom };
        }

        // Fourth call: next booking
        if (callCount === 4) {
          mockLimit.mockResolvedValue(mockNextBookingResult);
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          // First innerJoin returns an object with another innerJoin
          mockInnerJoin.mockReturnValueOnce({
            innerJoin: mockInnerJoin,
          });
          // Second innerJoin returns an object with where
          mockInnerJoin.mockReturnValueOnce({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          });
          mockOrderBy.mockReturnValue({
            limit: mockLimit,
          });
          return { from: mockFrom };
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token");
      expect(result.customer).toEqual({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });
      expect(result.stats).toEqual({
        upcomingCount: 3,
        totalTrips: 10,
        totalSpent: "1500.50",
      });
      expect(result.nextBooking).toEqual({
        id: "booking-1",
        bookingNumber: "BK-001",
        status: "confirmed",
        total: "150.00",
        participants: 2,
        trip: {
          id: "trip-1",
          date: "2024-06-01",
          startTime: "09:00",
          tour: {
            id: "tour-1",
            name: "Beginner Dive",
            type: "recreational",
          },
        },
      });
    });

    it("should return dashboard data with no upcoming bookings", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Mock all four database queries with no next booking
      const mockUpcomingResult = [{ count: 0 }];
      const mockTotalResult = [{ count: 5 }];
      const mockSpentResult = [{ total: "750.00" }];
      const mockNextBookingResult: any[] = [];

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        const mockFrom = vi.fn().mockReturnThis();
        const mockInnerJoin = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockReturnThis();
        const mockLimit = vi.fn();

        // First call: upcoming count
        if (callCount === 1) {
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          mockInnerJoin.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockUpcomingResult);
          return { from: mockFrom };
        }

        // Second call: total trips
        if (callCount === 2) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockTotalResult);
          return { from: mockFrom };
        }

        // Third call: total spent
        if (callCount === 3) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockSpentResult);
          return { from: mockFrom };
        }

        // Fourth call: next booking (empty)
        if (callCount === 4) {
          mockLimit.mockResolvedValue(mockNextBookingResult);
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          // First innerJoin returns an object with another innerJoin
          mockInnerJoin.mockReturnValueOnce({
            innerJoin: mockInnerJoin,
          });
          // Second innerJoin returns an object with where
          mockInnerJoin.mockReturnValueOnce({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          });
          mockOrderBy.mockReturnValue({
            limit: mockLimit,
          });
          return { from: mockFrom };
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats.upcomingCount).toBe(0);
      expect(result.stats.totalTrips).toBe(5);
      expect(result.stats.totalSpent).toBe("750.00");
      expect(result.nextBooking).toBeNull();
    });

    it("should return dashboard data with zero stats", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Mock all four database queries with zero stats
      const mockUpcomingResult = [{ count: 0 }];
      const mockTotalResult = [{ count: 0 }];
      const mockSpentResult = [{ total: "0" }];
      const mockNextBookingResult: any[] = [];

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        const mockFrom = vi.fn().mockReturnThis();
        const mockInnerJoin = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockReturnThis();
        const mockLimit = vi.fn();

        // First call: upcoming count
        if (callCount === 1) {
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          mockInnerJoin.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockUpcomingResult);
          return { from: mockFrom };
        }

        // Second call: total trips
        if (callCount === 2) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockTotalResult);
          return { from: mockFrom };
        }

        // Third call: total spent
        if (callCount === 3) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockSpentResult);
          return { from: mockFrom };
        }

        // Fourth call: next booking (empty)
        if (callCount === 4) {
          mockLimit.mockResolvedValue(mockNextBookingResult);
          mockFrom.mockReturnValue({
            innerJoin: mockInnerJoin,
          });
          // First innerJoin returns an object with another innerJoin
          mockInnerJoin.mockReturnValueOnce({
            innerJoin: mockInnerJoin,
          });
          // Second innerJoin returns an object with where
          mockInnerJoin.mockReturnValueOnce({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          });
          mockOrderBy.mockReturnValue({
            limit: mockLimit,
          });
          return { from: mockFrom };
        }

        return { from: mockFrom };
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats).toEqual({
        upcomingCount: 0,
        totalTrips: 0,
        totalSpent: "0",
      });
      expect(result.nextBooking).toBeNull();
    });
  });
});
