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

  describe("subject line generation", () => {
    it("should generate subject with form subject", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.subject).toBe("New Contact Form Submission - Question about dive courses");
    });

    it("should generate subject without form subject if not provided", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        subject: undefined,
      });
      expect(result.subject).toBe("New Contact Form Submission");
    });

    it("should handle long form subjects", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        subject: "Detailed inquiry about advanced diving certification courses and equipment rental options",
      });
      expect(result.subject).toContain("Detailed inquiry");
    });

    it("should always start with 'New Contact Form Submission'", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.subject).toContain("New Contact Form Submission");
    });
  });

  describe("HTML email content", () => {
    it("should include sender name and email", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("James Anderson");
      expect(result.html).toContain("james@example.com");
    });

    it("should include phone number if provided", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("+1-555-123-4567");
    });

    it("should include subject if provided", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("Question about dive courses");
    });

    it("should include message", () => {
      const result = contactFormNotificationEmail(defaultData);
      // Apostrophe gets escaped as &#x27;
      expect(result.html).toContain("interested in getting my Open Water certification");
    });

    it("should include submission timestamp", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("2024-06-15 10:30 AM");
    });

    it("should include referrer page if provided", () => {
      const result = contactFormNotificationEmail(defaultData);
      // / gets escaped as &#x2F;
      expect(result.html).toContain("courses");
    });

    it("should include shop name", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("Seaside Dive Center");
    });

    it("should have notification header", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("New Contact Form Submission");
    });

    it("should include reply-to email as link", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("mailto:");
      expect(result.html).toContain("james@example.com");
      expect(result.html).toContain("Reply to:");
    });

    it("should be valid HTML", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });

    it("should style message box distinctly", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("message-box");
    });
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
      // Should not have a subject detail row
      const htmlWithoutSubject = result.html;
      expect(htmlWithoutSubject).not.toMatch(/<span class="label">Subject:<\/span>/);
    });

    it("should not show page section if not provided", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        referrerPage: undefined,
      });
      expect(result.html).not.toContain("Page:");
    });

    it("should work with only required fields", () => {
      const result = contactFormNotificationEmail({
        name: "John Doe",
        email: "john@test.com",
        message: "Test message",
        shopName: "Test Shop",
        submittedAt: "2024-01-01",
      });
      expect(result.html).toContain("John Doe");
      expect(result.html).toContain("Test message");
      expect(result.html).not.toContain("Phone:");
      expect(result.html).not.toContain("Subject:");
    });
  });

  describe("text email content", () => {
    it("should include sender information", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.text).toContain("James Anderson");
      expect(result.text).toContain("james@example.com");
    });

    it("should include phone if provided", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.text).toContain("+1-555-123-4567");
    });

    it("should include message", () => {
      const result = contactFormNotificationEmail(defaultData);
      // Apostrophe gets escaped as &#x27; in text too
      expect(result.text).toContain("interested in getting my Open Water certification");
    });

    it("should include submission time", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.text).toContain("2024-06-15 10:30 AM");
    });

    it("should include shop name", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.text).toContain("Seaside Dive Center");
    });

    it("should not contain HTML tags", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<span>");
    });

    it("should preserve message formatting", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        message: "Line 1\nLine 2\nLine 3",
      });
      expect(result.text).toContain("Line 1");
      expect(result.text).toContain("Line 2");
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

    it("should handle special email formats", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        email: "user+tag@example.com",
      });
      expect(result.html).toContain("user+tag@example.com");
    });

    it("should handle international phone formats", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        phone: "+44 20 1234 5678",
      });
      expect(result.html).toContain("+44 20 1234 5678");
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

    it("should handle URLs in referrer page", () => {
      const result = contactFormNotificationEmail({
        ...defaultData,
        referrerPage: "/courses/open-water?level=beginner",
      });
      expect(result.html).toContain("courses");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("Seaside Dive Center");
      expect(result.text).toContain("Seaside Dive Center");
    });
  });

  describe("notification purpose", () => {
    it("should clearly indicate it's a form submission", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("contact form");
    });

    it("should emphasize reply action", () => {
      const result = contactFormNotificationEmail(defaultData);
      expect(result.html).toContain("Reply to:");
      expect(result.text).toContain("Reply to:");
    });
  });
});
