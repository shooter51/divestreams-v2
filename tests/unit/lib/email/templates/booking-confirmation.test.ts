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

  it("should generate correct output for default data", () => {
    const result = bookingConfirmationEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Booking Confirmed - Morning Reef Dive"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = bookingConfirmationEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
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

  it("should handle empty customer name gracefully", () => {
    const result = bookingConfirmationEmail({
      ...defaultData,
      customerName: "",
    });
    expect(result.html).toContain("Hi");
    expect(result.text).toContain("Hi");
  });
});
