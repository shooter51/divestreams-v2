import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Unit Tests for Tenant Password Change Route (KAN-613)
 *
 * Tests the password change action validation, error handling,
 * and success response shape for both normal and forced password changes.
 */

// Mock react-router redirect
let redirectUrl: string | null = null;
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: (url: string) => {
      redirectUrl = url;
      throw new Response(null, {
        status: 302,
        headers: { Location: url },
      });
    },
  };
});

// Mock auth module
const mockChangePassword = vi.fn();
vi.mock("../../../../../lib/auth", () => ({
  auth: {
    api: {
      changePassword: (...args: unknown[]) => mockChangePassword(...args),
      getSession: vi.fn(),
    },
  },
}));

// Mock org-context
const mockRequireOrgContext = vi.fn();
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: (...args: unknown[]) => mockRequireOrgContext(...args),
}));

// Mock database
const mockDbUpdate = vi.fn().mockReturnThis();
const mockDbSet = vi.fn().mockReturnThis();
const mockDbWhere = vi.fn().mockResolvedValue([]);
vi.mock("../../../../../lib/db", () => ({
  db: {
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return { set: mockDbSet };
    },
  },
}));

// Ensure mockDbSet returns object with where method
mockDbSet.mockReturnValue({ where: mockDbWhere });

vi.mock("../../../../../lib/db/schema", () => ({
  account: { userId: "userId", password: "password", forcePasswordChange: "forcePasswordChange" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

import { action } from "../../../../../app/routes/tenant/settings/password";

const mockOrgContext = {
  user: { id: "user-123", email: "staff@example.com", name: "Staff Member" },
  session: { id: "session-123" },
  org: { id: "org-1", name: "Test Dive Shop", slug: "test" },
  membership: { role: "staff" },
};

const makeArgs = (request: Request) =>
  ({ request, params: {}, context: {}, unstable_pattern: "" }) as any;

function makeFormRequest(
  fields: Record<string, string>,
  url = "https://demo.divestreams.com/tenant/settings/password"
): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request(url, { method: "POST", body: formData });
}

describe("Password Change Route - Action Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectUrl = null;
    mockRequireOrgContext.mockResolvedValue(mockOrgContext);
    mockChangePassword.mockResolvedValue({});
    mockDbSet.mockReturnValue({ where: mockDbWhere });
  });

  // ===========================================================================
  // PASSWORD VALIDATION
  // ===========================================================================

  describe("password validation", () => {
    it("returns error when new password is missing", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "",
        confirmPassword: "",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "All fields are required" });
    });

    it("returns error when confirm password is missing", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "All fields are required" });
    });

    it("returns error when passwords do not match", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "DifferentPass456",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "Passwords do not match" });
    });

    it("returns error when password is shorter than 8 characters", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "Short1",
        confirmPassword: "Short1",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "Password must be at least 8 characters" });
    });

    it("returns error when password is exactly 7 characters", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "Seven77",
        confirmPassword: "Seven77",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "Password must be at least 8 characters" });
    });

    it("returns error when current password is missing (non-forced)", async () => {
      const request = makeFormRequest({
        currentPassword: "",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "Current password is required" });
    });
  });

  // ===========================================================================
  // SUCCESSFUL PASSWORD CHANGE
  // ===========================================================================

  describe("successful password change", () => {
    it("calls Better Auth changePassword with correct parameters", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      try {
        await action(makeArgs(request));
      } catch (response) {
        // Expected redirect
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).headers.get("Location")).toContain(
          "/tenant/dashboard"
        );
      }

      expect(mockChangePassword).toHaveBeenCalledWith({
        body: {
          newPassword: "NewValidPass123",
          currentPassword: "OldPass123",
          revokeOtherSessions: false,
        },
        headers: expect.any(Headers),
      });
    });

    it("redirects to dashboard with success message on success", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      try {
        await action(makeArgs(request));
        expect.fail("Should have thrown redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get("Location")).toBe(
          "/tenant/dashboard?message=Password updated successfully"
        );
      }
    });

    it("accepts password with exactly 8 characters", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "Exactly8",
        confirmPassword: "Exactly8",
      });

      try {
        await action(makeArgs(request));
      } catch (response) {
        // Redirect = success
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
      }
    });
  });

  // ===========================================================================
  // ERROR HANDLING (wrong current password)
  // ===========================================================================

  describe("error handling", () => {
    it("returns error when current password is incorrect", async () => {
      mockChangePassword.mockRejectedValue(new Error("Invalid password"));

      const request = makeFormRequest({
        currentPassword: "WrongPassword",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await action(makeArgs(request));
      expect(result).toEqual({ error: "Current password is incorrect" });

      consoleSpy.mockRestore();
    });

    it("logs error when password change fails", async () => {
      mockChangePassword.mockRejectedValue(new Error("Auth service error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      await action(makeArgs(request));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Password update error:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // FORCED PASSWORD CHANGE
  // ===========================================================================

  describe("forced password change", () => {
    it("does not require current password when forced=true", async () => {
      const request = makeFormRequest(
        {
          currentPassword: "",
          newPassword: "NewValidPass123",
          confirmPassword: "NewValidPass123",
        },
        "https://demo.divestreams.com/tenant/settings/password?forced=true"
      );

      try {
        await action(makeArgs(request));
      } catch (response) {
        // Redirect = success
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
      }

      // Should have called changePassword
      expect(mockChangePassword).toHaveBeenCalled();
    });

    it("clears forcePasswordChange flag after forced change", async () => {
      const request = makeFormRequest(
        {
          currentPassword: "",
          newPassword: "NewValidPass123",
          confirmPassword: "NewValidPass123",
        },
        "https://demo.divestreams.com/tenant/settings/password?forced=true"
      );

      try {
        await action(makeArgs(request));
      } catch {
        // Redirect = success
      }

      // Should have updated the forcePasswordChange flag in the database
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePasswordChange: false,
        })
      );
    });

    it("returns error message for forced change failure", async () => {
      mockChangePassword.mockRejectedValue(new Error("Auth error"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = makeFormRequest(
        {
          currentPassword: "",
          newPassword: "NewValidPass123",
          confirmPassword: "NewValidPass123",
        },
        "https://demo.divestreams.com/tenant/settings/password?forced=true"
      );

      const result = await action(makeArgs(request));
      expect(result).toEqual({
        error: "Failed to update password. Please try again.",
      });

      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // ROLE ACCESS (all roles should be able to change password)
  // ===========================================================================

  describe("role access", () => {
    it("works for owner role", async () => {
      mockRequireOrgContext.mockResolvedValue({
        ...mockOrgContext,
        membership: { role: "owner" },
      });

      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      try {
        await action(makeArgs(request));
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
      }
    });

    it("works for admin role", async () => {
      mockRequireOrgContext.mockResolvedValue({
        ...mockOrgContext,
        membership: { role: "admin" },
      });

      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      try {
        await action(makeArgs(request));
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
      }
    });

    it("works for staff role", async () => {
      mockRequireOrgContext.mockResolvedValue({
        ...mockOrgContext,
        membership: { role: "staff" },
      });

      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      try {
        await action(makeArgs(request));
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
      }
    });
  });
});

describe("Password Change Route - User Profile Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectUrl = null;
    mockRequireOrgContext.mockResolvedValue(mockOrgContext);
    mockChangePassword.mockResolvedValue({});
  });

  // ===========================================================================
  // RESPONSE SHAPE VERIFICATION
  // ===========================================================================

  describe("response shape", () => {
    it("error response has correct shape", async () => {
      const request = makeFormRequest({
        currentPassword: "OldPass123",
        newPassword: "Short",
        confirmPassword: "Short",
      });

      const result = await action(makeArgs(request));
      expect(result).toHaveProperty("error");
      expect(typeof (result as any).error).toBe("string");
    });

    it("validation error does not include sensitive data", async () => {
      const request = makeFormRequest({
        currentPassword: "MySecretPassword",
        newPassword: "Short",
        confirmPassword: "Short",
      });

      const result = await action(makeArgs(request));
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain("MySecretPassword");
    });

    it("wrong password error does not include sensitive data", async () => {
      mockChangePassword.mockRejectedValue(new Error("Invalid password"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = makeFormRequest({
        currentPassword: "WrongSecretPass",
        newPassword: "NewValidPass123",
        confirmPassword: "NewValidPass123",
      });

      const result = await action(makeArgs(request));
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain("WrongSecretPass");
      expect(resultStr).not.toContain("NewValidPass123");

      consoleSpy.mockRestore();
    });
  });
});
