/**
 * Site Account Bookings Route Tests
 *
 * Tests the bookings page with customer authentication and filtering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/site/account/bookings";

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

describe("Route: site/account/bookings.tsx", () => {
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

    const mockBookings = [
      {
        id: "booking-1",
        bookingNumber: "BK-001",
        status: "confirmed",
        paymentStatus: "paid",
        total: "150.00",
        currency: "USD",
        participants: 2,
        createdAt: new Date("2024-01-01"),
        tripId: "trip-1",
        tripDate: "2024-06-01",
        tripStartTime: "09:00",
        tourId: "tour-1",
        tourName: "Beginner Dive",
        tourType: "recreational",
      },
    ];

    it("should return 401 when no session cookie", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account/bookings");

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
        url: "http://demo.localhost:5173/site/account/bookings",
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

    it("should return bookings with default filter (all)", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/bookings",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockBookings);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      mockInnerJoin.mockReturnValue({
        innerJoin: mockInnerJoin,
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token");
      expect(result.filter).toBe("all");
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toEqual({
        id: "booking-1",
        bookingNumber: "BK-001",
        status: "confirmed",
        paymentStatus: "paid",
        total: "150.00",
        currency: "USD",
        participants: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
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

    it("should return bookings with upcoming filter", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/bookings?filter=upcoming",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockBookings);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      mockInnerJoin.mockReturnValue({
        innerJoin: mockInnerJoin,
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.filter).toBe("upcoming");
      expect(result.bookings).toHaveLength(1);
    });

    it("should return bookings with completed filter", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/bookings?filter=completed",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      mockInnerJoin.mockReturnValue({
        innerJoin: mockInnerJoin,
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.filter).toBe("completed");
      expect(result.bookings).toHaveLength(0);
    });

    it("should return bookings with cancelled filter", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/bookings?filter=cancelled",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      mockInnerJoin.mockReturnValue({
        innerJoin: mockInnerJoin,
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.filter).toBe("cancelled");
      expect(result.bookings).toHaveLength(0);
    });

    it("should return empty bookings array when no bookings found", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/bookings",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        innerJoin: mockInnerJoin,
      });
      mockInnerJoin.mockReturnValue({
        innerJoin: mockInnerJoin,
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      });
      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.filter).toBe("all");
      expect(result.bookings).toHaveLength(0);
    });
  });
});
