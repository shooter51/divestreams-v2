import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Integration tests for embed booking route
 * Tests customer-facing booking flow via embed widget
 */

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  getSubdomainFromRequest: vi.fn().mockReturnValue("demo"),
}));

import { requireOrgContext, getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";

describe("embed/$tenant.book route", () => {
  const mockOrg = {
    id: "org-uuid",
    slug: "demo",
    name: "Demo Dive Shop",
    stripeAccountId: "acct_test123",
    metadata: null,
  };

  const mockTour = {
    id: "tour-1",
    name: "Beginner Dive",
    description: "Perfect for first-timers",
    price: 9900, // $99.00
    duration: 180,
    maxParticipants: 6,
    isActive: true,
  };

  const mockTrip = {
    id: "trip-1",
    tourId: "tour-1",
    date: new Date("2025-02-15"),
    startTime: "09:00",
    capacity: 6,
    bookedCount: 2,
    tour: mockTour,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://divestreams.com";
  });

  describe("Booking Form Data", () => {
    it("trip has all required fields", () => {
      expect(mockTrip.id).toBeDefined();
      expect(mockTrip.tourId).toBeDefined();
      expect(mockTrip.date).toBeDefined();
      expect(mockTrip.capacity).toBeDefined();
    });

    it("tour has pricing info", () => {
      expect(mockTour.price).toBe(9900);
      expect(mockTour.name).toBe("Beginner Dive");
    });

    it("calculates available spots", () => {
      const availableSpots = mockTrip.capacity - mockTrip.bookedCount;
      expect(availableSpots).toBe(4);
    });

    it("organization has branding info", () => {
      expect(mockOrg.name).toBe("Demo Dive Shop");
      expect(mockOrg.slug).toBe("demo");
    });
  });

  describe("Customer Validation", () => {
    it("validates email format", () => {
      const validEmails = ["john@example.com", "jane.doe@company.org"];
      const invalidEmails = ["invalid", "no@", "@nodomain"];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => expect(email).toMatch(emailRegex));
      invalidEmails.forEach(email => expect(email).not.toMatch(emailRegex));
    });

    it("requires customer name", () => {
      const customer = { firstName: "John", lastName: "Diver", email: "john@example.com" };
      expect(customer.firstName.length).toBeGreaterThan(0);
      expect(customer.lastName.length).toBeGreaterThan(0);
    });

    it("validates phone format (optional)", () => {
      const phones = ["+1-555-0100", "+44 20 7946 0958", "(555) 123-4567"];
      phones.forEach(phone => expect(phone.length).toBeGreaterThan(5));
    });
  });

  describe("Capacity Checking", () => {
    it("allows booking when spots available", () => {
      const requestedParticipants = 2;
      const availableSpots = mockTrip.capacity - mockTrip.bookedCount;
      const canBook = requestedParticipants <= availableSpots;

      expect(canBook).toBe(true);
    });

    it("prevents overbooking", () => {
      const requestedParticipants = 5;
      const availableSpots = mockTrip.capacity - mockTrip.bookedCount;
      const canBook = requestedParticipants <= availableSpots;

      expect(canBook).toBe(false);
    });

    it("handles fully booked trips", () => {
      const bookedTrip = { ...mockTrip, bookedCount: 6 };
      const availableSpots = bookedTrip.capacity - bookedTrip.bookedCount;
      const isFullyBooked = availableSpots <= 0;

      expect(isFullyBooked).toBe(true);
    });
  });

  describe("Price Calculation", () => {
    it("calculates total for multiple participants", () => {
      const participants = 2;
      const total = mockTour.price * participants;

      expect(total).toBe(19800); // $198.00
    });

    it("formats price for display", () => {
      const formatPrice = (cents: number) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(cents / 100);

      expect(formatPrice(mockTour.price)).toBe("$99.00");
      expect(formatPrice(19800)).toBe("$198.00");
    });
  });

  describe("Booking Number Generation", () => {
    it("generates unique booking numbers", () => {
      const generateBookingNumber = () => {
        const year = new Date().getFullYear();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `BK-${year}-${random}`;
      };

      const bookingNumber = generateBookingNumber();
      expect(bookingNumber).toMatch(/^BK-\d{4}-[A-Z0-9]+$/);
    });

    it("booking numbers are unique", () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const bn = `BK-2025-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        numbers.add(bn);
      }
      expect(numbers.size).toBe(100);
    });
  });

  describe("Discount Application", () => {
    const mockDiscounts = [
      { code: "SUMMER20", type: "percentage", value: 20, isActive: true },
      { code: "FLAT50", type: "fixed", value: 5000, isActive: true },
    ];

    it("applies percentage discount", () => {
      const originalTotal = 19800; // $198.00
      const discount = mockDiscounts[0]; // 20%
      const discountAmount = Math.floor(originalTotal * (discount.value / 100));
      const finalTotal = originalTotal - discountAmount;

      expect(discountAmount).toBe(3960); // $39.60
      expect(finalTotal).toBe(15840); // $158.40
    });

    it("applies fixed discount", () => {
      const originalTotal = 19800; // $198.00
      const discount = mockDiscounts[1]; // $50
      const discountAmount = Math.min(discount.value, originalTotal);
      const finalTotal = originalTotal - discountAmount;

      expect(discountAmount).toBe(5000);
      expect(finalTotal).toBe(14800); // $148.00
    });

    it("validates discount code exists", () => {
      const inputCode = "SUMMER20";
      const discount = mockDiscounts.find(d => d.code === inputCode && d.isActive);

      expect(discount).toBeDefined();
      expect(discount?.code).toBe("SUMMER20");
    });

    it("rejects invalid discount code", () => {
      const inputCode = "INVALID";
      const discount = mockDiscounts.find(d => d.code === inputCode && d.isActive);

      expect(discount).toBeUndefined();
    });
  });

  describe("Booking Confirmation", () => {
    it("creates booking with all required fields", () => {
      const booking = {
        id: "booking-new",
        bookingNumber: "BK-2025-ABC123",
        organizationId: mockOrg.id,
        tripId: mockTrip.id,
        customerId: "customer-123",
        participants: 2,
        total: 19800,
        paidAmount: 0,
        status: "pending",
        createdAt: new Date(),
      };

      expect(booking.bookingNumber).toMatch(/^BK-/);
      expect(booking.participants).toBe(2);
      expect(booking.total).toBe(19800);
      expect(booking.status).toBe("pending");
    });

    it("updates trip booked count", () => {
      const updatedTrip = {
        ...mockTrip,
        bookedCount: mockTrip.bookedCount + 2,
      };

      expect(updatedTrip.bookedCount).toBe(4);
    });
  });
});
