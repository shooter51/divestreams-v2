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

  it("should generate correct output for default data", () => {
    const result = contactFormAutoReplyEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Thank you for contacting Tropical Dive Paradise"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = contactFormAutoReplyEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
    expect(result.text).not.toContain("<a ");
  });

  describe("optional phone field handling", () => {
    it("should not show phone if not provided", () => {
      const result = contactFormAutoReplyEmail({
        ...defaultData,
        contactPhone: undefined,
      });
      expect(result.html).not.toContain("Phone:");
      expect(result.html).not.toContain("tel:");
      expect(result.html).toMatchSnapshot();
      expect(result.text).toMatchSnapshot();
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
  });
});
