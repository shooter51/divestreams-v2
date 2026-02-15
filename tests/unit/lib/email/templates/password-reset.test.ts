/**
 * Password Reset Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { passwordResetEmail } from "../../../../../lib/email/index";

describe("passwordResetEmail", () => {
  const defaultData = {
    userName: "Bob Wilson",
    resetUrl: "https://divestreams.com/reset-password?token=abc123xyz789",
  };

  describe("subject line generation", () => {
    it("should generate consistent subject line", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.subject).toBe("Reset Your Password");
    });

    it("should not include user name in subject", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.subject).not.toContain("Bob Wilson");
    });

    it("should not vary based on user", () => {
      const result1 = passwordResetEmail(defaultData);
      const result2 = passwordResetEmail({
        userName: "Different User",
        resetUrl: "https://example.com/reset",
      });
      expect(result1.subject).toBe(result2.subject);
    });
  });

  describe("HTML email content", () => {
    it("should include user name", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("Bob Wilson");
    });

    it("should include reset URL as a link", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("href=");
      expect(result.html).toContain("reset-password");
    });

    it("should have password reset header", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("Password Reset");
    });

    it("should include call to action button", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("Reset Password");
    });

    it("should mention expiration time", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("1 hour");
      expect(result.html).toContain("expire");
    });

    it("should include ignore instructions", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("didn't request");
      expect(result.html).toContain("ignore");
    });

    it("should be valid HTML", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });

    it("should style the button", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("button");
      expect(result.html).toContain("background");
    });

    it("should include small text for disclaimer", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("<small>");
    });
  });

  describe("text email content", () => {
    it("should include user name", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).toContain("Bob Wilson");
    });

    it("should include reset URL", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).toContain("reset-password");
      expect(result.text).toContain("token=");
    });

    it("should mention expiration time", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).toContain("1 hour");
      expect(result.text).toContain("expire");
    });

    it("should include ignore instructions", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).toContain("didn't request");
      expect(result.text).toContain("ignore");
    });

    it("should not contain HTML tags", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<a ");
    });

    it("should be readable plain text", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.text).toContain("Password Reset");
      expect(result.text).toContain("Visit the link below");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in user name", () => {
      const result = passwordResetEmail({
        ...defaultData,
        userName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in reset URL", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://test.com/reset?token=<script>alert(1)</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should handle quotes in user name", () => {
      const result = passwordResetEmail({
        ...defaultData,
        userName: 'Sarah "Sally" Smith',
      });
      expect(result.html).toContain("&quot;");
    });

    it("should handle ampersands in URL", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://test.com/reset?token=abc&redirect=/dashboard",
      });
      expect(result.html).toContain("&amp;");
    });
  });

  describe("edge cases", () => {
    it("should handle HTTPS URLs", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://secure.divestreams.com/reset",
      });
      expect(result.html).toContain("https");
    });

    it("should handle HTTP URLs", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "http://localhost:3000/reset",
      });
      expect(result.html).toContain("localhost");
    });

    it("should handle long tokens", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://test.com/reset?token=veryLongTokenString123456789abcdefghijklmnopqrstuvwxyz",
      });
      expect(result.html).toContain("veryLongTokenString");
    });

    it("should handle URLs with multiple query parameters", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://test.com/reset?token=abc&email=test@test.com&redirect=/",
      });
      expect(result.html).toContain("token=abc");
    });

    it("should handle empty user name", () => {
      const result = passwordResetEmail({
        ...defaultData,
        userName: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in user name", () => {
      const result = passwordResetEmail({
        ...defaultData,
        userName: "José García",
      });
      expect(result.html).toContain("José García");
    });

    it("should handle URLs with fragments", () => {
      const result = passwordResetEmail({
        ...defaultData,
        resetUrl: "https://test.com/reset?token=abc#section",
      });
      expect(result.html).toContain("token=abc");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = passwordResetEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = passwordResetEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should not include shop name (password reset is global)", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toMatch(/DiveStreams[^•]*<\/p>/); // DiveStreams without shop name
    });
  });

  describe("security considerations", () => {
    it("should not reveal if email exists", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).not.toContain("account exists");
      expect(result.html).not.toContain("found your account");
    });

    it("should mention expiration for security", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("expire");
      expect(result.text).toContain("expire");
    });

    it("should provide ignore instructions for security", () => {
      const result = passwordResetEmail(defaultData);
      expect(result.html).toContain("ignore");
      expect(result.text).toContain("ignore");
    });
  });
});
