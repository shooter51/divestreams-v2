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

  it("should generate correct output for default data", () => {
    const result = customerWelcomeEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Welcome to Blue Wave Divers!"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = customerWelcomeEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
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

  it("should handle empty customer name gracefully", () => {
    const result = customerWelcomeEmail({
      ...defaultData,
      customerName: "",
    });
    expect(result.html).toContain("Hi");
    expect(result.text).toContain("Hi");
  });
});
