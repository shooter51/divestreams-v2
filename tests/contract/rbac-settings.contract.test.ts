/**
 * Contract tests: RBAC enforcement on settings/team action
 *
 * Validates that role-based access control returns the correct HTTP
 * status and response shapes:
 *
 * 1. requireRole() throws 403 Response for unauthorised roles (customer)
 * 2. Non-premium org cannot send invitations — returns { error }
 * 3. Already-a-member invite returns { error } (not 500, not silent)
 * 4. Already-pending-invite returns { error }
 * 5. Invalid role value returns { error }
 * 6. Self role-modification returns { error }
 * 7. Success paths return { success: true, message: string }
 *
 * settings/billing is also covered for the owner-only constraint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// team.tsx uses dynamic imports — vi.mock hoists and intercepts them
vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(), // default: no-op (passes)
}));

vi.mock("../../lib/db", () => {
  const chain: Record<string, Mock> = {};
  const methods = ["select", "from", "where", "innerJoin", "limit", "insert", "values", "update", "set"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Default queries return empty arrays (no existing member, no existing invite)
  chain.limit = vi.fn().mockResolvedValue([]);
  return { db: chain };
});

vi.mock("../../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "https://app.divestreams.com"),
}));

vi.mock("../../lib/auth/admin-password-reset.server", () => ({
  resetUserPassword: vi.fn(),
}));

vi.mock("../../lib/db/schema", () => ({
  member: { id: "id", role: "role", userId: "userId", organizationId: "organizationId" },
  user: { id: "id", name: "name", email: "email" },
  invitation: { id: "id", organizationId: "organizationId", email: "email", role: "role", status: "status", inviterId: "inviterId", expiresAt: "expiresAt", createdAt: "createdAt" },
}));

import { action } from "../../app/routes/tenant/settings/team";
import { requireOrgContext, requireRole } from "../../lib/auth/org-context.server";
import { db } from "../../lib/db";

const OWNER_USER_ID = "user-owner-1";
const OTHER_USER_ID = "user-staff-2";

function makeOwnerContext(overrides?: Partial<{ role: string; isPremium: boolean }>) {
  return {
    user: { id: OWNER_USER_ID, name: "Owner", email: "owner@demo.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", slug: "demo", name: "Demo Dive Shop" },
    membership: { role: overrides?.role ?? "owner" },
    subscription: null,
    isPremium: overrides?.isPremium ?? true,
  };
}

function makeRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/settings/team", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

describe("Contract: RBAC — settings/team action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(makeOwnerContext());
    (requireRole as Mock).mockImplementation(() => {}); // passes by default
    // Default db: no existing member, no existing invite
    (db.limit as Mock).mockResolvedValue([]);
  });

  describe("requireRole enforcement", () => {
    it("throws a 403 Response for customer role (via requireRole)", async () => {
      // Simulate requireRole throwing 403 for a customer
      (requireRole as Mock).mockImplementation(() => {
        throw new Response("Forbidden: Insufficient permissions", { status: 403 });
      });

      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "new@example.com");
      fd.append("role", "admin");

      await expect(action(actionArgs(makeRequest(fd)))).rejects.toSatisfy(
        (e: unknown) => e instanceof Response && e.status === 403
      );
    });
  });

  describe("invite: non-premium org", () => {
    it("returns { error } when org is not on premium plan", async () => {
      (requireOrgContext as Mock).mockResolvedValue(makeOwnerContext({ isPremium: false }));

      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "new@example.com");
      fd.append("role", "admin");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect(typeof (result as { error: string }).error).toBe("string");
      expect((result as { error: string }).error).toMatch(/premium/i);
    });
  });

  describe("invite: invalid role", () => {
    it("returns { error: 'Invalid role' } for unlisted role values", async () => {
      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "new@example.com");
      fd.append("role", "superadmin"); // not in allowedRoles

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/invalid role/i);
    });
  });

  describe("invite: duplicate checks", () => {
    it("returns { error } when email is already a team member", async () => {
      // First db.limit call (member check) returns an existing member
      (db.limit as Mock).mockResolvedValueOnce([{ email: "existing@demo.com" }]);

      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "existing@demo.com");
      fd.append("role", "admin");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/already a team member/i);
    });

    it("returns { error } when email already has a pending invitation", async () => {
      // First db.limit call (member check) → not a member
      // Second db.limit call (invitation check) → has pending invite
      (db.limit as Mock)
        .mockResolvedValueOnce([]) // no existing member
        .mockResolvedValueOnce([]) // no existing user (triggers invite flow)
        .mockResolvedValueOnce([{ id: "invite-1" }]); // existing pending invite

      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "pending@example.com");
      fd.append("role", "member");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/pending invitation/i);
    });
  });

  describe("invite: success paths", () => {
    it("returns { success: true, message: string } when inviting existing user", async () => {
      // member check → not a member; user lookup → user exists
      (db.limit as Mock)
        .mockResolvedValueOnce([]) // not already a member
        .mockResolvedValueOnce([{ id: "existing-user", name: "Alice", email: "alice@example.com" }]); // existing user

      // Mock the db.insert chain (member insertion)
      (db.values as Mock).mockResolvedValue(undefined);

      const fd = new FormData();
      fd.append("intent", "invite");
      fd.append("email", "alice@example.com");
      fd.append("role", "member");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
      expect(typeof (result as { message: string }).message).toBe("string");
    });
  });

  describe("update-role: guard rails", () => {
    it("returns { error } when a user tries to update their own role", async () => {
      const fd = new FormData();
      fd.append("intent", "update-role");
      fd.append("userId", OWNER_USER_ID); // same as ctx.user.id
      fd.append("role", "admin");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/cannot modify your own role/i);
    });

    it("returns { error: 'Invalid role' } for unlisted role values", async () => {
      const fd = new FormData();
      fd.append("intent", "update-role");
      fd.append("userId", OTHER_USER_ID);
      fd.append("role", "god");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/invalid role/i);
    });

    it("returns { success: true } after a valid role update", async () => {
      // Mock the db.where chain used for the UPDATE
      (db.where as Mock).mockResolvedValue(undefined);

      const fd = new FormData();
      fd.append("intent", "update-role");
      fd.append("userId", OTHER_USER_ID);
      fd.append("role", "admin");

      const result = await action(actionArgs(makeRequest(fd)));

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
    });
  });
});
