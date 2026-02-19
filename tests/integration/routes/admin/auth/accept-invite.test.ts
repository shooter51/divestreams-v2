import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../../app/routes/admin/auth/accept-invite";

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema/auth", () => ({
  invitation: { id: "id", email: "email", role: "role", status: "status", expiresAt: "expiresAt", organizationId: "organizationId" },
  user: { id: "id", name: "name", email: "email" },
  member: { id: "id" },
  organization: { id: "id", name: "name" },
  account: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
}));

vi.mock("../../../../../lib/auth/password.server", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

import { db } from "../../../../../lib/db";

describe("admin/auth/accept-invite route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns error when no token", async () => {
      const result = await loader({
        request: new Request("https://admin.divestreams.com/auth/accept-invite"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.error).toBe("Invalid invitation link");
      expect(result.invitation).toBeNull();
    });

    it("returns error when invitation not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/auth/accept-invite?token=invalid"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.error).toBe("Invitation not found");
      expect(result.invitation).toBeNull();
    });

    it("returns error when invitation already accepted", async () => {
      (db.limit as Mock).mockResolvedValue([{
        id: "inv-1",
        email: "test@example.com",
        role: "admin",
        status: "accepted",
        expiresAt: new Date(Date.now() + 86400000),
        organizationId: "org-1",
        organizationName: "Demo Shop",
      }]);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/auth/accept-invite?token=inv-1"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.error).toBe("This invitation has already been accepted");
    });

    it("returns error when invitation expired", async () => {
      (db.limit as Mock).mockResolvedValueOnce([{
        id: "inv-1",
        email: "test@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() - 86400000), // expired
        organizationId: "org-1",
        organizationName: "Demo Shop",
      }]);
      // Mock the update for setting status to expired
      (db.set as Mock).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

      const result = await loader({
        request: new Request("https://admin.divestreams.com/auth/accept-invite?token=inv-1"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.error).toBe("This invitation has expired");
    });

    it("returns invitation data when valid and no existing user", async () => {
      // First call: find invitation (with innerJoin -> limit)
      (db.limit as Mock).mockResolvedValueOnce([{
        id: "inv-1",
        email: "new@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        organizationId: "org-1",
        organizationName: "Demo Shop",
      }]);
      // Second call: find existing user
      (db.limit as Mock).mockResolvedValueOnce([]);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/auth/accept-invite?token=inv-1"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.error).toBeNull();
      expect(result.invitation).toBeDefined();
      expect(result.invitation?.email).toBe("new@example.com");
      expect(result.existingUser).toBeNull();
    });
  });

  describe("action", () => {
    it("returns error when no token", async () => {
      const formData = new FormData();
      const result = await action({
        request: new Request("https://admin.divestreams.com/auth/accept-invite", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Invalid invitation");
    });

    it("returns error when invitation not found in action", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const formData = new FormData();
      formData.append("token", "invalid-token");
      formData.append("name", "Test");
      formData.append("password", "password123");
      formData.append("confirmPassword", "password123");

      const result = await action({
        request: new Request("https://admin.divestreams.com/auth/accept-invite", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Invitation not found or already used");
    });

    it("returns error when passwords don't match", async () => {
      (db.limit as Mock).mockResolvedValue([{
        id: "inv-1",
        email: "test@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        organizationId: "org-1",
      }]);

      const formData = new FormData();
      formData.append("token", "inv-1");
      formData.append("name", "Test User");
      formData.append("password", "password123");
      formData.append("confirmPassword", "different");

      const result = await action({
        request: new Request("https://admin.divestreams.com/auth/accept-invite", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Passwords do not match");
    });

    it("returns error when name and password missing for new user", async () => {
      (db.limit as Mock).mockResolvedValue([{
        id: "inv-1",
        email: "test@example.com",
        role: "admin",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        organizationId: "org-1",
      }]);

      const formData = new FormData();
      formData.append("token", "inv-1");

      const result = await action({
        request: new Request("https://admin.divestreams.com/auth/accept-invite", { method: "POST", body: formData }),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.error).toBe("Name and password are required");
    });
  });
});
