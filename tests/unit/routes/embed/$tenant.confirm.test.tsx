/**
 * Embed Booking Confirmation Route Tests
 *
 * Tests the booking confirmation page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant.confirm";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  getBookingDetails: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug } from "../../../../lib/db/queries.public";
import { getBookingDetails } from "../../../../lib/db/mutations.public";

describe("Route: embed/$tenant.confirm.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return title with booking number when booking data is available", () => {
      // Arrange
      const data = {
        booking: {
          bookingNumber: "BK12345",
          status: "confirmed",
        },
        tenantSlug: "demo",
        tenantName: "Demo Dive Shop",
      };

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Booking BK12345 Confirmed" }]);
    });

    it("should return default title when booking data is not available", () => {
      // Arrange
      const data = undefined;

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Booking Confirmation" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockBooking = {
      id: "book-abc123",
      bookingNumber: "BK12345",
      status: "confirmed",
      customerFirstName: "John",
      customerLastName: "Doe",
      customerEmail: "john@example.com",
      tripName: "Reef Dive Adventure",
      tripDate: "2024-02-15",
      tripTime: "09:00",
      participants: 2,
      totalAmount: "198.00",
      currency: "USD",
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/confirm?bookingId=book-abc123&bookingNumber=BK12345"
      );

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when bookingId parameter is missing", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/demo/confirm?bookingNumber=BK12345"
      );

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when bookingNumber parameter is missing", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/demo/confirm?bookingId=book-abc123"
      );

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/nonexistent/confirm?bookingId=book-abc123&bookingNumber=BK12345"
      );
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "nonexistent" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should throw 404 when booking not found", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/demo/confirm?bookingId=nonexistent&bookingNumber=BK00000"
      );
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getBookingDetails as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getBookingDetails).toHaveBeenCalledWith("org-123", "nonexistent", "BK00000");
    });

    it("should return booking details when all validations pass", async () => {
      // Arrange
      const request = new Request(
        "http://test.com/embed/demo/confirm?bookingId=book-abc123&bookingNumber=BK12345"
      );
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getBookingDetails as any).mockResolvedValue(mockBooking);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getBookingDetails).toHaveBeenCalledWith("org-123", "book-abc123", "BK12345");
      expect(result).toEqual({
        booking: mockBooking,
        tenantSlug: "demo",
        tenantName: "Demo Dive Shop",
      });
    });
  });
});
