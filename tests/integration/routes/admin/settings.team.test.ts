import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/admin/settings.team";

// Mock crypto.randomUUID for invitation IDs
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "mock-invite-id"),
});

// Mock the requirePlatformContext function
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    name: "name",
    logo: "logo",
    createdAt: "createdAt",
  },
  member: {
    id: "id",
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
    createdAt: "createdAt",
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
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  desc: vi.fn((field) => ({ type: "desc", field })),
}));

// Mock the email module
vi.mock("../../../../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock getAdminUrl and getAppUrl
vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn().mockReturnValue("http://localhost:5173"),
  getAdminUrl: vi.fn().mockReturnValue("http://admin.localhost:5173/auth/accept-invite?token=mock"),
}));

// Mock admin password reset
vi.mock("../../../../lib/auth/admin-password-reset.server", () => ({
  resetUserPassword: vi.fn().mockResolvedValue({ temporaryPassword: "temp123" }),
}));

import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { db } from "../../../../lib/db";
import { sendEmail } from "../../../../lib/email";

describe("admin/settings.team route", () => {
  const mockPlatformContext = {
    user: { id: "admin-user", name: "Admin", email: "admin@example.com" },
    session: { id: "session-1" },
    membership: { role: "owner" },
    isOwner: true,
    isAdmin: true,
  };

  const mockPlatformOrg = {
    id: "platform-org-id",
    slug: "platform",
    name: "Platform",
  };

  function makeActionArgs(formData: FormData) {
    return {
      request: new Request("https://admin.divestreams.com/admin/settings/team", {
        method: "POST",
        body: formData,
      }),
      params: {},
      context: {},
      unstable_pattern: "",
    } as Parameters<typeof action>[0];
  }

  function makeLoaderArgs() {
    return {
      request: new Request("https://admin.divestreams.com/admin/settings/team"),
      params: {},
      context: {},
      unstable_pattern: "",
    } as Parameters<typeof loader>[0];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
  });

  describe("loader", () => {
    it("returns team members and pending invites", async () => {
      const mockMembers = [
        {
          member: { id: "m1", userId: "u1", role: "owner", createdAt: new Date("2025-01-01") },
          user: { id: "u1", email: "admin@example.com", name: "Admin" },
        },
      ];

      // Call 1: platform org lookup, Call 2: members, Call 3: pending invites
      let selectCallCount = 0;
      (db.select as Mock).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Platform org query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockPlatformOrg]),
              }),
            }),
          };
        }
        if (selectCallCount === 2) {
          // Members query
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockMembers),
                }),
              }),
            }),
          };
        }
        // Pending invites query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      const result = await loader(makeLoaderArgs());

      expect(requirePlatformContext).toHaveBeenCalled();
      expect(result.members).toHaveLength(1);
      expect(result.members[0]).toMatchObject({
        id: "m1",
        email: "admin@example.com",
        name: "Admin",
        role: "owner",
      });
      expect(result.currentUserId).toBe("admin-user");
      expect(result.isOwner).toBe(true);
    });
  });

  describe("action", () => {
    // Helper to mock the platform org select (first select call in every action)
    function mockPlatformOrgSelect() {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockPlatformOrg]),
          }),
        }),
      };
    }

    describe("invite intent", () => {
      it("creates invitation and sends email", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          // Check for existing member
          if (selectCallCount === 2) {
            return {
              from: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            };
          }
          // Check for existing invitation
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        });

        const mockInsert = { values: vi.fn().mockResolvedValue([]) };
        (db.insert as Mock).mockReturnValue(mockInsert);

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "new@example.com");
        formData.append("role", "admin");

        const result = await action(makeActionArgs(formData));

        expect(db.insert).toHaveBeenCalled();
        expect(sendEmail).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
      });

      it("returns error for invalid email", async () => {
        (db.select as Mock).mockImplementation(() => mockPlatformOrgSelect());

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "invalid");
        formData.append("role", "admin");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Valid email required" });
      });

      it("returns error when user is already a member", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: "existing" }]),
                }),
              }),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "invite");
        formData.append("email", "existing@example.com");
        formData.append("role", "admin");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "User is already a team member" });
      });
    });

    describe("update-role intent", () => {
      it("updates member role", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          // Target member check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m2", userId: "other-user", role: "admin" }]),
              }),
            }),
          };
        });

        const mockUpdate = {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
        (db.update as Mock).mockReturnValue(mockUpdate);

        const formData = new FormData();
        formData.append("intent", "update-role");
        formData.append("memberId", "m2");
        formData.append("role", "owner");

        const result = await action(makeActionArgs(formData));

        expect(db.update).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
      });

      it("prevents changing own role", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m1", userId: "admin-user", role: "owner" }]),
              }),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "update-role");
        formData.append("memberId", "m1");
        formData.append("role", "admin");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Cannot change your own role" });
      });
    });

    describe("remove intent", () => {
      it("removes team member", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m2", userId: "other-user", role: "admin" }]),
              }),
            }),
          };
        });

        const mockDelete = { where: vi.fn().mockResolvedValue([]) };
        (db.delete as Mock).mockReturnValue(mockDelete);

        const formData = new FormData();
        formData.append("intent", "remove");
        formData.append("memberId", "m2");

        const result = await action(makeActionArgs(formData));

        expect(db.delete).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
      });

      it("prevents removing self", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m1", userId: "admin-user", role: "owner" }]),
              }),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "remove");
        formData.append("memberId", "m1");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Cannot remove yourself" });
      });
    });

    describe("cancel-invite intent", () => {
      it("cancels pending invitation", async () => {
        (db.select as Mock).mockImplementation(() => mockPlatformOrgSelect());

        const mockUpdate = {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
        (db.update as Mock).mockReturnValue(mockUpdate);

        const formData = new FormData();
        formData.append("intent", "cancel-invite");
        formData.append("inviteId", "invite-1");

        const result = await action(makeActionArgs(formData));

        expect(db.update).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
      });
    });

    describe("resend-invite intent", () => {
      it("resends invitation email", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          // Fetch existing invitation
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{
                id: "invite-1",
                email: "pending@example.com",
                role: "admin",
                organizationId: "platform-org-id",
                status: "pending",
              }]),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "resend-invite");
        formData.append("inviteId", "invite-1");

        const result = await action(makeActionArgs(formData));

        expect(sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "pending@example.com",
            subject: expect.stringContaining("Reminder"),
          })
        );
        expect(result).toMatchObject({ success: true, message: "Invitation resent" });
      });

      it("returns error for non-existent invitation", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "resend-invite");
        formData.append("inviteId", "non-existent");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Invitation not found" });
      });

      it("returns error when email send fails", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{
                id: "invite-1",
                email: "pending@example.com",
                role: "admin",
                organizationId: "platform-org-id",
                status: "pending",
              }]),
            }),
          };
        });

        (sendEmail as Mock).mockRejectedValueOnce(new Error("SMTP error"));

        const formData = new FormData();
        formData.append("intent", "resend-invite");
        formData.append("inviteId", "invite-1");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Failed to send email" });
      });
    });

    describe("reset-password intent", () => {
      it("resets password for non-owner member", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m2", userId: "other-user", role: "admin" }]),
              }),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "reset-password");
        formData.append("userId", "other-user");
        formData.append("method", "auto_generated");

        const result = await action(makeActionArgs(formData));

        expect(result).toMatchObject({ success: true, temporaryPassword: "temp123" });
      });

      it("prevents resetting owner password", async () => {
        let selectCallCount = 0;
        (db.select as Mock).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return mockPlatformOrgSelect();
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "m1", userId: "owner-user", role: "owner" }]),
              }),
            }),
          };
        });

        const formData = new FormData();
        formData.append("intent", "reset-password");
        formData.append("userId", "owner-user");
        formData.append("method", "auto_generated");

        const result = await action(makeActionArgs(formData));

        expect(result).toEqual({ error: "Cannot reset password for owner accounts" });
      });
    });

    it("requires admin or owner role", async () => {
      (requirePlatformContext as Mock).mockResolvedValue({
        ...mockPlatformContext,
        isOwner: false,
        isAdmin: false,
      });

      const formData = new FormData();
      formData.append("intent", "invite");

      await expect(
        action(makeActionArgs(formData))
      ).rejects.toThrow();
    });

    it("returns error for unknown intent", async () => {
      (db.select as Mock).mockImplementation(() => mockPlatformOrgSelect());

      const formData = new FormData();
      formData.append("intent", "unknown");

      const result = await action(makeActionArgs(formData));

      expect(result).toEqual({ error: "Unknown action" });
    });
  });
});
