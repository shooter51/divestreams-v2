import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { loader, action } from "../../../../../app/routes/tenant/settings/team";

// Mock crypto.randomUUID for invitation IDs
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "mock-invite-id"),
});

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(), // requireRole is a synchronous function that throws if role doesn't match
}));

// Mock the database module
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
  },
  user: {
    id: "id",
    name: "name",
    email: "email",
  },
  invitation: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    role: "role",
    status: "status",
    inviterId: "inviterId",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
  },
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    logo: "logo",
    createdAt: "createdAt",
    metadata: "metadata",
  },
  session: {
    id: "id",
    userId: "userId",
    expiresAt: "expiresAt",
    token: "token",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  account: {
    id: "id",
    userId: "userId",
    accountId: "accountId",
    providerId: "providerId",
    accessToken: "accessToken",
    refreshToken: "refreshToken",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  verification: {
    id: "id",
    identifier: "identifier",
    value: "value",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}));

// Mock require-feature.server - requireLimit returns available capacity
vi.mock("../../../../../lib/require-feature.server", () => ({
  requireLimit: vi.fn().mockResolvedValue({ current: 1, limit: 5, remaining: 4 }),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  DEFAULT_PLAN_LIMITS: { free: { users: 1, customers: 50, toursPerMonth: 5, storageGb: 0.5 } },
}));

// Mock the email module
vi.mock("../../../../../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock getAppUrl
vi.mock("../../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("http://localhost:5173"),
}));

// Mock admin password reset
vi.mock("../../../../../lib/auth/admin-password-reset.server", () => ({
  resetUserPassword: vi.fn().mockResolvedValue({ temporaryPassword: "temp123" }),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { db } from "../../../../../lib/db";

describe("tenant/settings/team route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Owner User", email: "owner@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20, teamMembers: 5 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns team members", async () => {
      const mockMembers = [
        {
          id: "member-1",
          role: "owner",
          userId: "user-1",
          userName: "Owner User",
          userEmail: "owner@example.com",
        },
        {
          id: "member-2",
          role: "admin",
          userId: "user-2",
          userName: "Admin User",
          userEmail: "admin@example.com",
        },
      ];

      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockMembers),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.team).toHaveLength(2);
      expect(result.team[0]).toMatchObject({
        id: "member-1",
        name: "Owner User",
        email: "owner@example.com",
        role: "owner",
        status: "active",
      });
    });

    it("returns pending invitations", async () => {
      const mockInvitations = [
        {
          id: "invite-1",
          email: "newuser@example.com",
          role: "member",
          status: "pending",
          createdAt: new Date("2024-01-15"),
          expiresAt: new Date("2024-01-22"),
        },
      ];

      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockInvitations),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.pendingInvites).toHaveLength(1);
      expect(result.pendingInvites[0]).toMatchObject({
        id: "invite-1",
        email: "newuser@example.com",
        role: "member",
        invitedAt: "2024-01-15",
        expiresAt: "2024-01-22",
      });
    });

    it("returns roles definition", async () => {
      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.roles).toBeDefined();
      expect(result.roles.length).toBeGreaterThan(0);
      expect(result.roles.find(r => r.id === "owner")).toBeDefined();
    });

    it("returns plan limit and premium status", async () => {
      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.planLimit).toBe(5);
      expect(result.isPremium).toBe(true);
      expect(result.canInviteTeamMembers).toBe(true);
    });

    it("returns canInviteTeamMembers false for non-premium users", async () => {
      (requireOrgContext as Mock).mockResolvedValue({
        ...mockOrgContext,
        isPremium: false,
      });

      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.canInviteTeamMembers).toBe(false);
    });

    it("handles member without name", async () => {
      const mockMembers = [
        {
          id: "member-1",
          role: "member",
          userId: "user-1",
          userName: null,
          userEmail: "user@example.com",
        },
      ];

      const mockMembersQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockMembers),
      };

      const mockInvitationsQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return mockMembersQuery;
        return mockInvitationsQuery;
      });

      const request = new Request("https://demo.divestreams.com/tenant/settings/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.team[0].name).toBe("Unknown");
    });
  });

  describe("action", () => {
    describe("invite intent", () => {
      it("creates invitation for premium users", async () => {
        // Mock select queries for member/invitation validation checks
        const mockMemberCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // No existing member
        };

        const mockUserCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // No existing user
        };

        const mockInviteCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // No pending invitation
        };

        const mockInsertQuery = {
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue([]),
        };

        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockMemberCheckQuery;
          if (selectCallCount === 2) return mockUserCheckQuery;
          return mockInviteCheckQuery;
        });
        (db.insert as Mock).mockReturnValue(mockInsertQuery);

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "newuser@example.com");
        formData.append("role", "admin");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.insert).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Invitation sent to newuser@example.com (new user)",
        });
      });

      it("returns error for non-premium users", async () => {
        (requireOrgContext as Mock).mockResolvedValue({
          ...mockOrgContext,
          isPremium: false,
        });

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "newuser@example.com");
        formData.append("role", "member");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Team invitations require a premium subscription" });
        expect(db.insert).not.toHaveBeenCalled();
      });

      it("returns error when inviting email that is already a team member (KAN-599)", async () => {
        // Mock select query to return existing member with matching email
        const mockMemberCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ email: "owner@example.com" }]), // Existing member found
        };

        (db.select as Mock).mockImplementation(() => mockMemberCheckQuery);

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "owner@example.com"); // Same as owner
        formData.append("role", "admin");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "This email is already a team member" });
        expect(db.insert).not.toHaveBeenCalled();
      });

      it("returns error when inviting email that already has pending invitation (KAN-599)", async () => {
        // Mock first select query to return no existing member
        const mockMemberCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // No existing member
        };

        // Mock second select query to return no existing user
        const mockUserCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // No existing user
        };

        // Mock third select query to return pending invitation
        const mockInviteCheckQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{
            id: "invite-1",
            email: "pending@example.com",
            status: "pending"
          }]), // Pending invitation found
        };

        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockMemberCheckQuery;
          if (selectCallCount === 2) return mockUserCheckQuery;
          return mockInviteCheckQuery;
        });

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "pending@example.com");
        formData.append("role", "member");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "This email already has a pending invitation" });
        expect(db.insert).not.toHaveBeenCalled();
      });
    });

    describe("update-role intent", () => {
      it("updates member role", async () => {
        const mockUpdateQuery = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };

        (db.update as Mock).mockReturnValue(mockUpdateQuery);

        const formData = new FormData();
        formData.append("intent", "update-role");
        formData.append("userId", "member-2");
        formData.append("role", "admin");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.update).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Role updated successfully",
        });
      });
    });

    describe("remove intent", () => {
      it("removes team member", async () => {
        const mockDeleteQuery = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };

        (db.delete as Mock).mockReturnValue(mockDeleteQuery);

        const formData = new FormData();
        formData.append("intent", "remove");
        formData.append("userId", "member-2");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.delete).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Team member removed",
        });
      });
    });

    describe("cancel-invite intent", () => {
      it("cancels pending invitation", async () => {
        const mockDeleteQuery = {
          delete: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };

        (db.delete as Mock).mockReturnValue(mockDeleteQuery);

        const formData = new FormData();
        formData.append("intent", "cancel-invite");
        formData.append("inviteId", "invite-1");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(db.delete).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          message: "Invitation cancelled",
        });
      });
    });

    describe("resend-invite intent", () => {
      it("resends invitation", async () => {
        // Mock the select query to find the existing invitation
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{
            id: "invite-1",
            email: "pending@example.com",
            role: "member",
            organizationId: "org-uuid",
            status: "pending",
          }]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);

        const formData = new FormData();
        formData.append("intent", "resend-invite");
        formData.append("inviteId", "invite-1");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          success: true,
          message: "Invitation resent",
        });
      });

      it("returns error for non-existent invitation", async () => {
        // Mock the select query to return empty (invitation not found)
        const mockSelectQuery = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };

        (db.select as Mock).mockReturnValue(mockSelectQuery);

        const formData = new FormData();
        formData.append("intent", "resend-invite");
        formData.append("inviteId", "non-existent-invite");

        const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Invitation not found" });
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/team", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toBeNull();
    });
  });
});
