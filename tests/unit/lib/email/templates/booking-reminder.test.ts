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

  it("should generate correct output for default data", () => {
    const result = bookingReminderEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Reminder: Sunset Reef Exploration Tomorrow"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = bookingReminderEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
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

  it("should handle empty customer name gracefully", () => {
    const result = bookingReminderEmail({
      ...defaultData,
      customerName: "",
    });
    expect(result.html).toContain("Hi");
    expect(result.text).toContain("Hi");
  });
});
