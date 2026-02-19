import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/signup";

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: { id: "id", name: "name", slug: "slug" },
  member: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { checkRateLimit } from "../../../../lib/utils/rate-limit";

describe("tenant/signup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after clearAllMocks
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true, remaining: 10 });
  });

  describe("loader", () => {
    it("redirects when already logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue({ user: { id: "user-1" } });

      await expect(
        loader({ request: new Request("https://demo.divestreams.com/signup"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 302 }));
    });

    it("returns org info when not logged in", async () => {
      (auth.api.getSession as Mock).mockResolvedValue(null);
      (getSubdomainFromRequest as Mock).mockReturnValue("demo");
      (db.limit as Mock).mockResolvedValue([{ id: "org-1", name: "Demo Dive Shop" }]);

      const result = await loader({
        request: new Request("https://demo.divestreams.com/signup"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.orgName).toBe("Demo Dive Shop");
      expect(result.orgId).toBe("org-1");
      expect(result.subdomain).toBe("demo");
    });
  });

  describe("action", () => {
    it("returns error when rate limited", async () => {
      (checkRateLimit as Mock).mockResolvedValue({ allowed: false });

      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "test@example.com");
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.form).toContain("Too many signup attempts");
    });

    it("returns error for short name", async () => {
      const formData = new FormData();
      formData.append("name", "A");
      formData.append("email", "test@example.com");
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("returns error for invalid email", async () => {
      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "invalid");
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.email).toBe("Please enter a valid email address");
    });

    it("returns error for short password", async () => {
      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "test@example.com");
      formData.append("password", "short");
      formData.append("confirmPassword", "short");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.password).toBe("Password must be at least 8 characters");
    });

    it("returns error for password missing uppercase", async () => {
      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "test@example.com");
      formData.append("password", "password1");
      formData.append("confirmPassword", "password1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.password).toBe("Password must contain at least one uppercase letter");
    });

    it("returns error when passwords don't match", async () => {
      const formData = new FormData();
      formData.append("name", "Test User");
      formData.append("email", "test@example.com");
      formData.append("password", "Password1");
      formData.append("confirmPassword", "Different1");

      const result = await action({
        request: new Request("https://demo.divestreams.com/signup", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors?.confirmPassword).toBe("Passwords do not match");
    });
  });
});
