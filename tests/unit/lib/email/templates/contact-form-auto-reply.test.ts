/**
 * Contact Form Auto-Reply Email Template Tests
 */

import { describe, it, expect } from "vitest";
import { contactFormAutoReplyEmail } from "../../../../../lib/email/index";

describe("contactFormAutoReplyEmail", () => {
  const defaultData = {
    name: "Jennifer Smith",
    shopName: "Tropical Dive Paradise",
    contactEmail: "info@tropicaldive.com",
    contactPhone: "+1-555-987-6543",
  };

  describe("subject line generation", () => {
    it("should generate subject with shop name", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.subject).toBe("Thank you for contacting Tropical Dive Paradise");
    });

    it("should handle long shop names", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        shopName: "International Scuba Diving and Adventure Center",
      });
      expect(result.subject).toBe("Thank you for contacting International Scuba Diving and Adventure Center");
    });

    it("should start with 'Thank you'", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.subject).toContain("Thank you");
    });
  });

  describe("HTML email content", () => {
    it("should include recipient name", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Jennifer Smith");
    });

    it("should include shop name", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Tropical Dive Paradise");
    });

    it("should include contact email", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("info@tropicaldive.com");
    });

    it("should include contact phone if provided", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("+1-555-987-6543");
    });

    it("should have acknowledgment header", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Message Received");
    });

    it("should thank the customer", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Thank you for reaching out");
    });

    it("should mention message received", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("We've received your message");
    });

    it("should set response time expectation", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("24 hours");
      expect(result.html).toContain("respond");
    });

    it("should include email as mailto link", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain('href="mailto:');
      expect(result.html).toContain("info@tropicaldive.com");
    });

    it("should include phone as tel link if provided", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain('href="tel:');
      expect(result.html).toContain("+1-555-987-6543");
    });

    it("should be valid HTML", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
    });

    it("should include styling", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("font-family");
    });

    it("should highlight response time", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("highlight");
    });

    it("should end with shop team signature", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Best regards");
      expect(result.html).toContain("Team");
    });
  });

  describe("optional phone field handling", () => {
    it("should not show phone if not provided", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactPhone: undefined,
      });
      expect(result.html).not.toContain("Phone:");
      expect(result.html).not.toContain("tel:");
    });

    it("should work with only email contact", () => {
      const result = contactFormAutoReplyEmail({
        name: "Test User",
        shopName: "Test Shop",
        contactEmail: "test@test.com",
      });
      expect(result.html).toContain("test@test.com");
      expect(result.html).not.toContain("Phone:");
    });
  });

  describe("text email content", () => {
    it("should include recipient name", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("Jennifer Smith");
    });

    it("should include shop name", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("Tropical Dive Paradise");
    });

    it("should include contact email", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("info@tropicaldive.com");
    });

    it("should include contact phone if provided", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("+1-555-987-6543");
    });

    it("should mention response time", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("24 hours");
    });

    it("should not contain HTML tags", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).not.toContain("<html>");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<a ");
    });

    it("should be readable plain text", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("Thank you");
      expect(result.text).toContain("Email:");
    });

    it("should include team signature", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.text).toContain("Best regards");
      expect(result.text).toContain("Team");
    });
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        name: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in shop name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        shopName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img src=x");
    });

    it("should escape HTML in contact email", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactEmail: "test<script>@example.com",
      });
      expect(result.html).not.toContain("<script>");
    });

    it("should escape HTML in contact phone", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactPhone: "<b>123-456-7890</b>",
      });
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should handle quotes in name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        name: 'David "Dave" Miller',
      });
      expect(result.html).toContain("&quot;");
    });
  });

  describe("edge cases", () => {
    it("should handle empty name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        name: "",
      });
      expect(result.html).toContain("Hi");
      expect(result.text).toContain("Hi");
    });

    it("should handle special characters in shop name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        shopName: "Bob's Dive & Surf Shop",
      });
      expect(result.html).toContain("Bob");
      expect(result.html).toContain("&amp;");
    });

    it("should handle international characters in name", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        name: "María González",
      });
      expect(result.html).toContain("María González");
    });

    it("should handle special email formats", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactEmail: "customer.service+support@example.com",
      });
      expect(result.html).toContain("customer.service");
    });

    it("should handle international phone formats", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactPhone: "+33 1 23 45 67 89",
      });
      expect(result.html).toContain("+33 1 23 45 67 89");
    });

    it("should handle phone with extension", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactPhone: "+1-555-123-4567 ext. 101",
      });
      expect(result.html).toContain("ext. 101");
    });

    it("should handle very long shop names", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        shopName: "The International Professional Diving and Underwater Adventure Center of Excellence",
      });
      expect(result.html).toContain("International Professional Diving");
    });
  });

  describe("return value structure", () => {
    it("should return object with subject, html, and text", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
    });

    it("should return strings for all properties", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(typeof result.subject).toBe("string");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("should return non-empty strings", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe("branding and footer", () => {
    it("should include DiveStreams branding", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("DiveStreams");
    });

    it("should include powered by text", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Powered by");
    });

    it("should include shop name in footer", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Tropical Dive Paradise");
      expect(result.text).toContain("Tropical Dive Paradise");
    });
  });

  describe("customer service tone", () => {
    it("should be friendly and professional", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("Thank you");
      expect(result.html).toContain("Best regards");
    });

    it("should provide clear next steps", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("get back to you");
      expect(result.html).toContain("immediate assistance");
    });

    it("should offer alternative contact methods", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("contact us directly");
      expect(result.html).toContain("Email:");
    });
  });

  describe("response time commitment", () => {
    it("should clearly state response timeframe", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("typically respond within 24 hours");
    });

    it("should be highlighted for visibility", () => {
      const result = contactFormAutoReplyEmail(defaultData);
      expect(result.html).toContain("We typically respond within 24 hours");
    });
  });
});
