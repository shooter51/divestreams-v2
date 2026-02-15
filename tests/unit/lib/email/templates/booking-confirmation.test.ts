/**
 * Booking Confirmation Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { bookingConfirmationEmail } from "../../../../../lib/email/index";

describe("bookingConfirmationEmail", () => {
  const defaultData = {
    customerName: "John Doe",
    tripName: "Morning Reef Dive",
    tripDate: "2024-06-15",
    tripTime: "08:00 AM",
    participants: 2,
    total: "$150.00",
    bookingNumber: "BK123456",
    shopName: "Coral Divers",
  };

  describe("subject line generation", () => {
    it("should generate subject with trip name", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.subject).toBe("Booking Confirmed - Morning Reef Dive");
    });

    it("should handle long trip names", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        tripName: "Advanced Open Water Certification with Night Dive Experience",
      });
      expect(result.subject).toBe("Booking Confirmed - Advanced Open Water Certification with Night Dive Experience");
    });

    it("should handle special characters in trip name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        tripName: "Sunset Dive & Snorkel",
      });
      expect(result.subject).toBe("Booking Confirmed - Sunset Dive & Snorkel");
    });
  });

  describe("HTML email content", () => {
    it("should include customer name", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("John Doe");
    });

    it("should include shop name", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("Coral Divers");
    });

    it("should include booking number", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("BK123456");
    });

    it("should include trip details", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("Morning Reef Dive");
      expect(result.html).toContain("2024-06-15");
      expect(result.html).toContain("08:00 AM");
    });

    it("should include participant count", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("2");
    });

    it("should include total price", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("$150.00");
    });

    it("should have confirmation header", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("Booking Confirmed");
    });

    it("should include arrival instructions", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("15 minutes before");
    });

    it("should be valid HTML", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });
  });

  describe("text email content", () => {
    it("should include customer name", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.text).toContain("John Doe");
    });

    it("should include all booking details", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.text).toContain("BK123456");
      expect(result.text).toContain("Morning Reef Dive");
      expect(result.text).toContain("2024-06-15");
      expect(result.text).toContain("08:00 AM");
      expect(result.text).toContain("$150.00");
    });

    it("should include shop name", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.text).toContain("Coral Divers");
    });

    it("should not contain HTML tags", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<p>");
    });

    it("should be readable plain text", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.text).toContain("Booking Confirmed");
      expect(result.text).toContain("Trip:");
      expect(result.text).toContain("Date:");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in customer name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        customerName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in trip name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        tripName: "<b>Dangerous Dive</b>",
      });
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should escape HTML in shop name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        shopName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img");
    });

    it("should escape HTML in booking number", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        bookingNumber: "BK<script>123</script>",
      });
      expect(result.html).not.toContain("<script>");
    });
  });

  describe("edge cases", () => {
    it("should handle single participant", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        participants: 1,
      });
      expect(result.html).toContain("1");
    });

    it("should handle large participant count", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        participants: 25,
      });
      expect(result.html).toContain("25");
    });

    it("should handle various date formats", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        tripDate: "June 15, 2024",
      });
      expect(result.html).toContain("June 15, 2024");
    });

    it("should handle various time formats", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        tripTime: "14:30",
      });
      expect(result.html).toContain("14:30");
    });

    it("should handle different currency formats", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        total: "$1,250.00",
      });
      expect(result.html).toContain("$1,250.00");
    });

    it("should handle empty customer name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        customerName: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in shop name", () => {
      const result = bookingConfirmationEmail({
        ...defaultData,
        shopName: "Joe's Dive Shop & Tours",
      });
      expect(result.html).toContain("Joe");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = bookingConfirmationEmail(defaultData);
      expect(result.html).toContain("Coral Divers");
      expect(result.text).toContain("Coral Divers");
    });
  });
});
