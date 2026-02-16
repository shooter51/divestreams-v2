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

  it("should generate correct output for default data", () => {
    const result = passwordResetEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Reset Your Password"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = passwordResetEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
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

  it("should handle empty user name gracefully", () => {
    const result = passwordResetEmail({
      ...defaultData,
      userName: "",
    });
    expect(result.html).toContain("Hi");
    expect(result.text).toContain("Hi");
  });
});
