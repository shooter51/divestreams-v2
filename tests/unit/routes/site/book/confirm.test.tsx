/**
 * Site Book Confirmation Route Tests
 *
 * Tests the booking confirmation page with booking details display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/site/book/confirm";

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock getBookingDetails
vi.mock("../../../../../lib/db/mutations.public", () => ({
  getBookingDetails: vi.fn(),
}));

// Mock customer auth
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../../lib/db";
import { getBookingDetails } from "../../../../../lib/db/mutations.public";
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";

describe("Route: site/book/confirm.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
    slug: "demo",
    name: "Demo Dive Shop",
    customDomain: null,
  };

  const mockBooking = {
    id: "booking-1",
    bookingNumber: "BK-001",
    status: "confirmed",
    paymentStatus: "paid",
    participants: 2,
    subtotal: "150.00",
    tax: "0.00",
    total: "150.00",
    currency: "USD",
    specialRequests: "Vegetarian meals",
    createdAt: "2024-01-01T10:00:00Z",
    trip: {
      id: "trip-1",
      date: "2024-06-01",
      startTime: "09:00",
      endTime: "12:00",
      tourName: "Beginner Dive",
      primaryImage: "https://example.com/image.jpg",
    },
    customer: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
    },
  };

  describe("loader", () => {
    it("should throw 400 when missing id parameter", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/book/confirm?ref=BK-001");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 400 when missing ref parameter", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/book/confirm?id=booking-1");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/book/confirm?id=booking-1&ref=BK-001");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when booking not found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/book/confirm?id=booking-1&ref=BK-001");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getBookingDetails as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return booking details when not logged in", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/book/confirm?id=booking-1&ref=BK-001",
        headers: {
          get: (name: string) => (name === "Cookie" ? "" : null),
        },
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getBookingDetails as any).mockResolvedValue(mockBooking);
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getBookingDetails).toHaveBeenCalledWith("org-123", "booking-1", "BK-001");
      expect(result).toEqual({
        booking: mockBooking,
        organizationName: "Demo Dive Shop",
        isLoggedIn: false,
      });
    });

    it("should return booking details when logged in", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/book/confirm?id=booking-1&ref=BK-001",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getBookingDetails as any).mockResolvedValue(mockBooking);
      (getCustomerBySession as any).mockResolvedValue({
        id: "cust-123",
        email: "john@example.com",
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token");
      expect(result).toEqual({
        booking: mockBooking,
        organizationName: "Demo Dive Shop",
        isLoggedIn: true,
      });
    });

    it("should resolve organization by subdomain", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/book/confirm?id=booking-1&ref=BK-001",
        headers: {
          get: (name: string) => (name === "Cookie" ? "" : null),
        },
      } as Request;

      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getBookingDetails as any).mockResolvedValue(mockBooking);
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizationName).toBe("Demo Dive Shop");
      expect(result.isLoggedIn).toBe(false);
    });
  });
});
