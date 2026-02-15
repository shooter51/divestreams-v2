import { describe, it, expect } from "vitest";
import { getPasswordChangedByAdminEmail } from "../../../../../lib/email/templates/password-changed-by-admin";

describe("Password Changed By Admin Email", () => {
  it("should generate email with admin name and method", () => {
    const result = getPasswordChangedByAdminEmail({
      userName: "John Doe",
      userEmail: "john@example.com",
      adminName: "Admin User",
      method: "auto_generated",
      organizationName: "Test Dive Shop",
      changedAt: "January 15, 2026 at 10:30 AM",
      loginUrl: "https://test.divestreams.com/login",
    });

    expect(result.subject).toContain("password was changed");
    expect(result.subject).toContain("Test Dive Shop");
    expect(result.html).toContain("John Doe");
    expect(result.html).toContain("Admin User");
    expect(result.html).toContain("January 15, 2026 at 10:30 AM");
    expect(result.text).toContain("John Doe");
  });

  it("should show different message for each method", () => {
    const autoGen = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "auto_generated",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    const manual = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "manual_entry",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    const emailReset = getPasswordChangedByAdminEmail({
      userName: "Test",
      userEmail: "test@example.com",
      adminName: "Admin",
      method: "email_reset",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    expect(autoGen.html).toContain("temporary password");
    expect(manual.html).toContain("new password was set");
    expect(emailReset.html).toContain("reset link");
  });

  it("should escape HTML in user data", () => {
    const result = getPasswordChangedByAdminEmail({
      userName: "<script>alert('xss')</script>",
      userEmail: "test@example.com",
      adminName: "<b>Admin</b>",
      method: "auto_generated",
      organizationName: "Shop",
      changedAt: "Jan 1, 2026",
      loginUrl: "https://example.com",
    });

    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });
});
