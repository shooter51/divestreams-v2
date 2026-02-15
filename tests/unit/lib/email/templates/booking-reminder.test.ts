/**
 * Booking Reminder Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { bookingReminderEmail } from "../../../../../lib/email/index";

describe("bookingReminderEmail", () => {
  const defaultData = {
    customerName: "Sarah Johnson",
    tripName: "Sunset Reef Exploration",
    tripDate: "Tomorrow",
    tripTime: "17:00",
    bookingNumber: "BK789012",
    shopName: "Paradise Divers",
  };

  describe("subject line generation", () => {
    it("should generate subject with trip name and 'Tomorrow'", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.subject).toBe("Reminder: Sunset Reef Exploration Tomorrow");
    });

    it("should handle long trip names in subject", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripName: "Advanced Wreck Diving Specialty Course",
      });
      expect(result.subject).toBe("Reminder: Advanced Wreck Diving Specialty Course Tomorrow");
    });

    it("should handle special characters in trip name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripName: "Night Dive & Photography",
      });
      expect(result.subject).toBe("Reminder: Night Dive & Photography Tomorrow");
    });
  });

  describe("HTML email content", () => {
    it("should include customer name", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Sarah Johnson");
    });

    it("should include trip name prominently", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Sunset Reef Exploration");
    });

    it("should include trip date and time", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Tomorrow");
      expect(result.html).toContain("17:00");
    });

    it("should include booking number", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("BK789012");
    });

    it("should include shop name", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Paradise Divers");
    });

    it("should have reminder header", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("See You Tomorrow");
    });

    it("should include what to bring list", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("What to bring");
      expect(result.html).toContain("Swimsuit and towel");
      expect(result.html).toContain("Sunscreen");
      expect(result.html).toContain("Certification card");
      expect(result.html).toContain("Camera");
    });

    it("should mention reef-safe sunscreen", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("reef-safe");
    });

    it("should include arrival instructions", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("15 minutes before");
    });

    it("should be valid HTML", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });
  });

  describe("text email content", () => {
    it("should include customer name", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("Sarah Johnson");
    });

    it("should include all trip details", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("Sunset Reef Exploration");
      expect(result.text).toContain("Tomorrow");
      expect(result.text).toContain("17:00");
      expect(result.text).toContain("BK789012");
    });

    it("should include what to bring list", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("What to bring");
      expect(result.text).toContain("Swimsuit and towel");
      expect(result.text).toContain("Sunscreen");
      expect(result.text).toContain("Certification card");
    });

    it("should include shop name", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("Paradise Divers");
    });

    it("should not contain HTML tags", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<ul>");
    });

    it("should be readable plain text", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("See You Tomorrow");
      expect(result.text).toContain("friendly reminder");
    });

    it("should include list items with dashes", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.text).toContain("- Swimsuit");
      expect(result.text).toContain("- Sunscreen");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in customer name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        customerName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in trip name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img src=x");
    });

    it("should escape HTML in shop name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        shopName: "<b>Malicious</b>",
      });
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should escape HTML in booking number", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        bookingNumber: "BK<svg>123</svg>",
      });
      expect(result.html).not.toContain("<svg>");
    });

    it("should escape HTML in date", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripDate: "<script>2024-01-01</script>",
      });
      expect(result.html).not.toContain("<script>");
    });
  });

  describe("edge cases", () => {
    it("should handle various date formats", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripDate: "Saturday, June 15, 2024",
      });
      expect(result.html).toContain("Saturday, June 15, 2024");
    });

    it("should handle 24-hour time format", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripTime: "14:30",
      });
      expect(result.html).toContain("14:30");
    });

    it("should handle 12-hour time format", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        tripTime: "2:30 PM",
      });
      expect(result.html).toContain("2:30 PM");
    });

    it("should handle empty customer name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        customerName: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in shop name", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        shopName: "Mike's Dive & Surf",
      });
      expect(result.html).toContain("Mike");
    });

    it("should handle alphanumeric booking numbers", () => {
      const result = bookingReminderEmail({
        ...defaultData,
        bookingNumber: "BK-2024-ABC123",
      });
      expect(result.html).toContain("BK-2024-ABC123");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = bookingReminderEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toContain("Paradise Divers");
      expect(result.text).toContain("Paradise Divers");
    });
  });

  describe("emoji usage", () => {
    it("should include dive emoji in header", () => {
      const result = bookingReminderEmail(defaultData);
      expect(result.html).toMatch(/🤿/);
    });
  });
});
