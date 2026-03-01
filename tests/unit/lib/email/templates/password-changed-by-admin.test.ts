import { describe, it, expect } from "vitest";
import { getPasswordChangedByAdminEmail } from "../../../../../lib/email/templates/password-changed-by-admin";

describe("getPasswordChangedByAdminEmail", () => {
  const defaultData = {
    userName: "John Doe",
    userEmail: "john@example.com",
    adminName: "Admin User",
    method: "auto_generated" as const,
    organizationName: "Test Dive Shop",
    changedAt: "January 15, 2026 at 10:30 AM",
    loginUrl: "https://test.divestreams.com/login",
  };

  it("should generate correct output for auto_generated method", () => {
    const result = getPasswordChangedByAdminEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(
      `"Your password was changed - Test Dive Shop"`
    );
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should generate correct output for manual_entry method", () => {
    const result = getPasswordChangedByAdminEmail({
      ...defaultData,
      method: "manual_entry",
    });
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should generate correct output for email_reset method", () => {
    const result = getPasswordChangedByAdminEmail({
      ...defaultData,
      method: "email_reset",
    });
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = getPasswordChangedByAdminEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in user name", () => {
      const result = getPasswordChangedByAdminEmail({
        ...defaultData,
        userName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in admin name", () => {
      const result = getPasswordChangedByAdminEmail({
        ...defaultData,
        adminName: "<b>Admin</b>",
      });
      expect(result.html).not.toContain("<b>Admin</b>");
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should escape HTML in organization name", () => {
      const result = getPasswordChangedByAdminEmail({
        ...defaultData,
        organizationName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img");
    });
  });
});
