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

  it("should generate correct output for default data", () => {
    const result = welcomeEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Welcome to Ocean Adventures!"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = welcomeEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
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

  it("should handle empty user name gracefully", () => {
    const result = welcomeEmail({
      ...defaultData,
      userName: "",
    });
    expect(result.html).toContain("Hi");
    expect(result.text).toContain("Hi");
  });
});
