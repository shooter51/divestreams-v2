/**
 * Welcome Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { welcomeEmail } from "../../../../../lib/email/index";

describe("welcomeEmail", () => {
  const defaultData = {
    userName: "Alice Brown",
    shopName: "Ocean Adventures",
    loginUrl: "https://oceanadventures.divestreams.com/login",
  };

  describe("subject line generation", () => {
    it("should generate subject with shop name", () => {
      const result = welcomeEmail(defaultData);
      expect(result.subject).toBe("Welcome to Ocean Adventures!");
    });

    it("should handle long shop names", () => {
      const result = welcomeEmail({
        ...defaultData,
        shopName: "International Dive and Adventure Travel Center",
      });
      expect(result.subject).toBe("Welcome to International Dive and Adventure Travel Center!");
    });

    it("should include exclamation mark", () => {
      const result = welcomeEmail(defaultData);
      expect(result.subject).toContain("!");
    });
  });

  describe("HTML email content", () => {
    it("should include user name", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Alice Brown");
    });

    it("should include shop name", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Ocean Adventures");
    });

    it("should include login URL as a link", () => {
      const result = welcomeEmail(defaultData);
      // URL gets escaped by escapeHtml (/ becomes &#x2F;)
      expect(result.html).toContain("href=");
      expect(result.html).toContain("oceanadventures.divestreams.com");
    });

    it("should have welcome header", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Welcome");
    });

    it("should include call to action button", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Go to Dashboard");
    });

    it("should mention account creation", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("account has been created");
    });

    it("should be valid HTML", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });

    it("should style the button", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("button");
      expect(result.html).toContain("background");
    });
  });

  describe("text email content", () => {
    it("should include user name", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).toContain("Alice Brown");
    });

    it("should include shop name", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).toContain("Ocean Adventures");
    });

    it("should include login URL", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).toContain("oceanadventures.divestreams.com");
    });

    it("should mention account creation", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).toContain("account has been created");
    });

    it("should not contain HTML tags", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<a ");
    });

    it("should be readable plain text", () => {
      const result = welcomeEmail(defaultData);
      expect(result.text).toContain("Welcome to");
      expect(result.text).toContain("Access your dashboard at:");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in user name", () => {
      const result = welcomeEmail({
        ...defaultData,
        userName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in shop name", () => {
      const result = welcomeEmail({
        ...defaultData,
        shopName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img src=x");
      expect(result.html).toContain("&lt;img");
    });

    it("should escape HTML in login URL", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "https://test.com/login?redirect=<script>",
      });
      expect(result.html).not.toContain("<script>");
    });

    it("should handle quotes in user name", () => {
      const result = welcomeEmail({
        ...defaultData,
        userName: 'John "Johnny" Doe',
      });
      expect(result.html).toContain("&quot;");
    });
  });

  describe("edge cases", () => {
    it("should handle HTTPS URLs", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "https://secure.divestreams.com/login",
      });
      expect(result.html).toContain("https");
    });

    it("should handle HTTP URLs", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "http://localhost:3000/login",
      });
      expect(result.html).toContain("localhost");
    });

    it("should handle URLs with paths", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "https://test.com/staff/login",
      });
      expect(result.html).toContain("staff");
    });

    it("should handle URLs with query parameters", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "https://test.com/login?redirect=/dashboard",
      });
      expect(result.html).toContain("redirect");
    });

    it("should handle empty user name", () => {
      const result = welcomeEmail({
        ...defaultData,
        userName: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in shop name", () => {
      const result = welcomeEmail({
        ...defaultData,
        shopName: "Joe's Dive & Surf",
      });
      expect(result.html).toContain("Joe");
      expect(result.html).toContain("&amp;");
    });

    it("should handle very long URLs", () => {
      const result = welcomeEmail({
        ...defaultData,
        loginUrl: "https://very-long-subdomain-name-for-testing.divestreams.com/login",
      });
      expect(result.html).toContain("very-long-subdomain-name");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = welcomeEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = welcomeEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = welcomeEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toContain("Ocean Adventures");
      expect(result.text).toContain("Ocean Adventures");
    });
  });

  describe("emoji usage", () => {
    it("should include celebration emoji in header", () => {
      const result = welcomeEmail(defaultData);
      expect(result.html).toMatch(/🎉/);
    });
  });
});
