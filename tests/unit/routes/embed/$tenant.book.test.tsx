/**
 * Embed Booking Form Route Tests
 *
 * Tests the booking form page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader, action } from "../../../../app/routes/embed/$tenant.book";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicTripById: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  createWidgetBooking: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicTripById } from "../../../../lib/db/queries.public";
import { createWidgetBooking } from "../../../../lib/db/mutations.public";

describe("Route: embed/$tenant.book.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("meta", () => {
    it("should return meta title", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Complete Your Booking" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockTrip = {
      id: "trip-123",
      tourId: "tour-456",
      name: "Reef Dive Adventure",
      date: "2024-02-15",
      startTime: "09:00",
      price: "99.00",
      currency: "USD",
      availableSpots: 5,
      totalSpots: 10,
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/book?tripId=trip-123");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 400 when tripId parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book");

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent/book?tripId=trip-123");
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

    it("should throw 404 when trip not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book?tripId=nonexistent");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getPublicTripById).toHaveBeenCalledWith("org-123", "nonexistent");
    });

    it("should throw 400 when trip is fully booked", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book?tripId=trip-123");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue({
        ...mockTrip,
        availableSpots: 0,
      });

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should return trip data when all validations pass", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book?tripId=trip-123");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicTripById).toHaveBeenCalledWith("org-123", "trip-123");
      expect(result).toEqual({
        trip: mockTrip,
        tenantSlug: "demo",
        organizationId: "org-123",
      });
    });
  });

  describe("action", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockTrip = {
      id: "trip-123",
      availableSpots: 5,
    };
    const mockBooking = {
      id: "book-abc123",
      bookingNumber: "BK12345",
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });

      // Act & Assert
      try {
        await action({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await action({ request, params: { tenant: "nonexistent" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return validation errors for missing required fields", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("firstName", "First name is required");
      expect(result.errors).toHaveProperty("lastName", "Last name is required");
      expect(result.errors).toHaveProperty("email", "Email is required");
    });

    it("should return validation error for invalid email", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "invalid-email",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Invalid email address");
    });

    it("should return validation error when trip is no longer available", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(null);

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "This trip is no longer available");
    });

    it("should return validation error when not enough spots available", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "6",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue({
        ...mockTrip,
        availableSpots: 3,
      });

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("participants", "Only 3 spot(s) available");
    });

    it("should create booking and redirect on success", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          specialRequests: "Vegetarian meals please",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);
      (createWidgetBooking as any).mockResolvedValue(mockBooking);

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(createWidgetBooking).toHaveBeenCalledWith("org-123", {
        tripId: "trip-123",
        participants: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        specialRequests: "Vegetarian meals please",
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe(
        "/embed/demo/confirm?bookingId=book-abc123&bookingNumber=BK12345"
      );
    });

    it("should create booking without optional fields", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "1",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);
      (createWidgetBooking as any).mockResolvedValue(mockBooking);

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(createWidgetBooking).toHaveBeenCalledWith("org-123", {
        tripId: "trip-123",
        participants: 1,
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: undefined,
        specialRequests: undefined,
      });
      expect(result.status).toBe(302);
    });

    it("should return error when booking creation fails", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/book", {
        method: "POST",
        body: new URLSearchParams({
          tripId: "trip-123",
          participants: "2",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicTripById as any).mockResolvedValue(mockTrip);
      (createWidgetBooking as any).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await action({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "Failed to create booking. Please try again.");
      expect(console.error).toHaveBeenCalledWith(
        "Booking creation failed:",
        expect.any(Error)
      );
    });
  });
});
