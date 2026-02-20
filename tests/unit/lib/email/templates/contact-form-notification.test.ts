/**
 * Contact Form Notification Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { contactFormNotificationEmail } from "../../../../../lib/email/index";

describe("contactFormNotificationEmail", () => {
  const defaultData = {
    name: "James Anderson",
    email: "james@example.com",
    phone: "+1-555-123-4567",
    subject: "Question about dive courses",
    message: "I'm interested in getting my Open Water certification. Do you have any upcoming classes?",
    shopName: "Seaside Dive Center",
    referrerPage: "/courses",
    submittedAt: "2024-06-15 10:30 AM",
  };

  it("should generate correct output for default data", () => {
    const result = contactFormNotificationEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"New Contact Form Submission - Question about dive courses"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should generate subject without form subject if not provided", () => {
    const result = contactFormNotificationEmail({
      ...defaultData,
      subject: undefined,
    });
    expect(result.subject).toMatchInlineSnapshot(`"New Contact Form Submission"`);
  });

  it("should not contain HTML tags in text version", () => {
    const result = contactFormNotificationEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
    expect(result.text).not.toContain("<span>");
  });

  describe("optional fields handling", () => {
    it("should not show phone section if not provided", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        phone: undefined,
      });
      expect(result.html).not.toContain("Phone:");
    });

    it("should not show subject section if not provided", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        subject: undefined,
      });
      expect(result.html).not.toMatch(/<span class="label">Subject:<\/span>/);
    });

    it("should not show page section if not provided", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        referrerPage: undefined,
      });
      expect(result.html).not.toContain("Page:");
    });

    it("should generate correct output with only required fields", () => {
      const result = contactFormNotificationEmail({
        name: "John Doe",
        email: "john@test.com",
        message: "Test message",
        shopName: "Test Shop",
        submittedAt: "2024-01-01",
      });
      expect(result.html).toMatchSnapshot();
      expect(result.text).toMatchSnapshot();
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in name", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        name: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in email", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        email: "test<script>@example.com",
      });
      expect(result.html).not.toContain("<script>");
    });

    it("should escape HTML in subject", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        subject: "<b>Bold Subject</b>",
      });
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should escape HTML in message", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        message: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img src=x");
    });

    it("should escape HTML in shop name", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        shopName: "<script>Malicious</script>",
      });
      expect(result.html).not.toContain("<script>");
    });

    it("should preserve line breaks in message", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        message: "Line 1\nLine 2\nLine 3",
      });
      expect(result.html).toContain("white-space: pre-wrap");
    });
  });

  describe("edge cases", () => {
    it("should handle very long messages", () => {
      const longMessage = "a".repeat(5000);
      const result = contactFormNotificationEmail({
        ...defaultData,
        message: longMessage,
      });
      expect(result.html).toContain(longMessage);
    });

    it("should handle international characters in name", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        name: "François García",
      });
      expect(result.html).toContain("François García");
    });

    it("should handle empty message", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        message: "",
      });
      expect(result.html).toContain("Message:");
    });

    it("should handle special characters in subject", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        subject: "Question about $500 course & equipment",
      });
      expect(result.html).toContain("$500");
      expect(result.html).toContain("&amp;");
    });
  });
});
