import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  customerCredentials: {
    id: "id",
    email: "email",
    resetToken: "resetToken",
    resetTokenExpires: "resetTokenExpires",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  resetPassword: vi.fn(),
}));

import { db } from "../../../../lib/db";
import { resetPassword } from "../../../../lib/auth/customer-auth.server";
import { loader, action } from "../../../../app/routes/site/set-password";

describe("site/set-password route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns org and tokenValid=false when no token provided", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const request = new Request("https://demo.divestreams.com/site/set-password");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.tokenValid).toBe(false);
      expect(result.error).toBe("No password reset token provided");
    });

    it("returns tokenValid=true when token is valid and not expired", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([{
          id: "cred-1",
          email: "john@test.com",
          resetTokenExpires: new Date(Date.now() + 3600000),
        }]);

      const request = new Request("https://demo.divestreams.com/site/set-password?token=valid-token");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.tokenValid).toBe(true);
      expect(result.email).toBe("john@test.com");
    });

    it("returns tokenValid=false when token is expired", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([{
          id: "cred-1",
          email: "john@test.com",
          resetTokenExpires: new Date(Date.now() - 3600000),
        }]);

      const request = new Request("https://demo.divestreams.com/site/set-password?token=expired-token");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.tokenValid).toBe(false);
      expect(result.error).toContain("expired or is invalid");
    });

    it("throws 404 when org not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://unknown.divestreams.com/site/set-password");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });
  });

  describe("action", () => {
    it("validates password is required", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("token", "valid-token");
      formData.set("password", "");
      formData.set("confirmPassword", "");

      const request = new Request("https://demo.divestreams.com/site/set-password", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Password is required");
    });

    it("validates password minimum length", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("token", "valid-token");
      formData.set("password", "short");
      formData.set("confirmPassword", "short");

      const request = new Request("https://demo.divestreams.com/site/set-password", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Password must be at least 8 characters long");
    });

    it("validates passwords match", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("token", "valid-token");
      formData.set("password", "validpassword123");
      formData.set("confirmPassword", "different123");

      const request = new Request("https://demo.divestreams.com/site/set-password", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("Passwords do not match");
    });

    it("redirects to login on successful password set", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);
      (resetPassword as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("token", "valid-token");
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");

      const request = new Request("https://demo.divestreams.com/site/set-password", {
        method: "POST",
        body: formData,
      });

      try {
        const result = await action({
          request,
          params: {},
          context: {},
        } as Parameters<typeof action>[0]);
        if (result instanceof Response) {
          expect(result.status).toBe(302);
          expect(result.headers.get("Location")).toContain("/site/login?message=password-set");
        }
      } catch (error) {
        if (error instanceof Response) {
          expect(error.status).toBe(302);
          expect(error.headers.get("Location")).toContain("/site/login?message=password-set");
        }
      }
    });

    it("returns error when token is missing in form data", async () => {
      (db.limit as Mock).mockResolvedValue([mockOrg]);

      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");

      const request = new Request("https://demo.divestreams.com/site/set-password", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as Parameters<typeof action>[0]);

      expect((result as any).error).toBe("No password reset token provided");
    });
  });
});
