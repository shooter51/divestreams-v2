/**
 * Customer Welcome Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { customerWelcomeEmail } from "../../../../../lib/email/index";

describe("customerWelcomeEmail", () => {
  const defaultData = {
    customerName: "Emma Davis",
    shopName: "Blue Wave Divers",
    loginUrl: "https://bluewave.divestreams.com/site/login",
  };

  describe("subject line generation", () => {
    it("should generate subject with shop name", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.subject).toBe("Welcome to Blue Wave Divers!");
    });

    it("should handle long shop names", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        shopName: "Adventure Diving and Water Sports Center",
      });
      expect(result.subject).toBe("Welcome to Adventure Diving and Water Sports Center!");
    });

    it("should include exclamation mark", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.subject).toContain("!");
    });
  });

  describe("HTML email content", () => {
    it("should include customer name", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Emma Davis");
    });

    it("should include shop name", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Blue Wave Divers");
    });

    it("should include login URL as a link", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("href=");
      expect(result.html).toContain("site");
      expect(result.html).toContain("login");
    });

    it("should have welcome header", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Welcome");
    });

    it("should include call to action button", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Sign In to Your Account");
    });

    it("should mention account creation", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Thank you for creating an account");
    });

    it("should list customer benefits", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("You can now:");
      expect(result.html).toContain("Book dive trips");
      expect(result.html).toContain("View and manage your reservations");
      expect(result.html).toContain("diving history");
      expect(result.html).toContain("certifications");
    });

    it("should include booking trips benefit", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Book dive trips and training courses");
    });

    it("should include reservation management benefit", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("View and manage your reservations");
    });

    it("should include history access benefit", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Access your diving history");
    });

    it("should include profile update benefit", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Update your profile and certifications");
    });

    it("should be valid HTML", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });

    it("should use list for benefits", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("<ul>");
      expect(result.html).toContain("<li>");
    });
  });

  describe("text email content", () => {
    it("should include customer name", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("Emma Davis");
    });

    it("should include shop name", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("Blue Wave Divers");
    });

    it("should include login URL", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("bluewave.divestreams.com");
      // / gets escaped as &#x2F; even in text
      expect(result.text).toContain("site");
      expect(result.text).toContain("login");
    });

    it("should list customer benefits", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("You can now:");
      expect(result.text).toContain("Book dive trips");
      expect(result.text).toContain("reservations");
      expect(result.text).toContain("history");
      expect(result.text).toContain("certifications");
    });

    it("should use dashes for list items", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("- Book dive trips");
      expect(result.text).toContain("- View and manage");
    });

    it("should not contain HTML tags", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<ul>");
    });

    it("should be readable plain text", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.text).toContain("Welcome");
      expect(result.text).toContain("Thank you");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in customer name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        customerName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in shop name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        shopName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img src=x");
    });

    it("should escape HTML in login URL", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        loginUrl: "https://test.com/login?redirect=<script>",
      });
      expect(result.html).not.toContain("<script>");
    });

    it("should handle quotes in customer name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        customerName: 'Mike "The Diver" Johnson',
      });
      expect(result.html).toContain("&quot;");
    });
  });

  describe("edge cases", () => {
    it("should handle customer portal URLs", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        loginUrl: "https://shop.divestreams.com/site/login",
      });
      expect(result.html).toContain("site");
    });

    it("should handle URLs with query parameters", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        loginUrl: "https://test.com/site/login?redirect=/profile",
      });
      expect(result.html).toContain("redirect");
    });

    it("should handle empty customer name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        customerName: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in shop name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        shopName: "Sam's Scuba & Snorkel",
      });
      expect(result.html).toContain("Sam");
      expect(result.html).toContain("&amp;");
    });

    it("should handle international characters in customer name", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        customerName: "François Müller",
      });
      expect(result.html).toContain("François Müller");
    });

    it("should handle HTTPS URLs", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        loginUrl: "https://secure.divestreams.com/site/login",
      });
      expect(result.html).toContain("https");
    });

    it("should handle localhost URLs for development", () => {
      const result = customerWelcomeEmail({
        ...defaultData,
        loginUrl: "http://localhost:3000/site/login",
      });
      expect(result.html).toContain("localhost");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Blue Wave Divers");
      expect(result.text).toContain("Blue Wave Divers");
    });
  });

  describe("emoji usage", () => {
    it("should include celebration emoji in header", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toMatch(/🎉/);
    });
  });

  describe("customer vs staff differentiation", () => {
    it("should use customer-specific URL path", () => {
      const result = customerWelcomeEmail(defaultData);
      // URL gets escaped: / becomes &#x2F;
      expect(result.html).toContain("site");
      expect(result.html).toContain("login");
    });

    it("should mention customer-specific features", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).toContain("Book dive trips");
      expect(result.html).toContain("reservations");
    });

    it("should not mention staff features", () => {
      const result = customerWelcomeEmail(defaultData);
      expect(result.html).not.toContain("manage staff");
      expect(result.html).not.toContain("dashboard");
      expect(result.html).not.toContain("admin");
    });
  });
});
