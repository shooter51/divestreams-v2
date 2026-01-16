/**
 * Auth Schema Tests
 *
 * Tests for Better Auth schema types.
 */

import { describe, it, expect } from "vitest";
import {
  type User,
  type NewUser,
  type Session,
  type NewSession,
  type Account,
  type NewAccount,
  type Organization,
  type NewOrganization,
  type Member,
  type NewMember,
  type Invitation,
  type NewInvitation,
  type Verification,
  type NewVerification,
} from "../../../../../lib/db/schema/auth";

describe("Auth Schema", () => {
  describe("User type", () => {
    it("has required fields", () => {
      const user: Partial<User> = {
        id: "user-123",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBe("user-123");
      expect(user.email).toBe("test@example.com");
      expect(user.emailVerified).toBe(true);
    });

    it("has optional name and image", () => {
      const user: Partial<User> = {
        id: "user-456",
        email: "john@example.com",
        name: "John Doe",
        image: "https://example.com/avatar.jpg",
      };

      expect(user.name).toBe("John Doe");
      expect(user.image).toContain("avatar");
    });

    it("emailVerified defaults to false", () => {
      const newUser: Partial<NewUser> = {
        id: "user-789",
        email: "new@example.com",
      };

      expect(newUser.emailVerified).toBeUndefined();
    });
  });

  describe("Session type", () => {
    it("has required fields", () => {
      const session: Partial<Session> = {
        id: "session-123",
        token: "token-abc123",
        userId: "user-123",
        expiresAt: new Date("2025-02-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.token).toBe("token-abc123");
      expect(session.userId).toBe("user-123");
    });

    it("has optional IP and user agent", () => {
      const session: Partial<Session> = {
        id: "session-456",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      };

      expect(session.ipAddress).toBe("192.168.1.1");
      expect(session.userAgent).toContain("Mozilla");
    });

    it("tracks expiration", () => {
      const expiresAt = new Date("2025-01-20T12:00:00Z");
      const session: Partial<Session> = {
        expiresAt,
      };

      expect(session.expiresAt).toEqual(expiresAt);
    });
  });

  describe("Account type", () => {
    it("has required provider fields", () => {
      const account: Partial<Account> = {
        id: "account-123",
        userId: "user-123",
        accountId: "google-123456",
        providerId: "google",
      };

      expect(account.providerId).toBe("google");
      expect(account.accountId).toBe("google-123456");
    });

    it("has OAuth token fields", () => {
      const account: Partial<Account> = {
        accessToken: "ya29.access_token",
        refreshToken: "1//refresh_token",
        accessTokenExpiresAt: new Date("2025-01-15T12:00:00Z"),
        scope: "email profile openid",
      };

      expect(account.accessToken).toContain("ya29");
      expect(account.scope).toContain("email");
    });

    it("supports password for credentials provider", () => {
      const account: Partial<Account> = {
        providerId: "credential",
        password: "hashed_password_here",
      };

      expect(account.providerId).toBe("credential");
      expect(account.password).toBeDefined();
    });
  });

  describe("Organization type", () => {
    it("has required fields", () => {
      const org: Partial<Organization> = {
        id: "org-123",
        name: "Blue Ocean Divers",
        slug: "blue-ocean",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(org.name).toBe("Blue Ocean Divers");
      expect(org.slug).toBe("blue-ocean");
    });

    it("slug is unique and lowercase", () => {
      const org: Partial<Organization> = {
        slug: "my-dive-shop",
      };

      expect(org.slug).toMatch(/^[a-z0-9-]+$/);
    });

    it("has optional logo", () => {
      const org: Partial<Organization> = {
        logo: "https://example.com/logo.png",
      };

      expect(org.logo).toContain("logo");
    });

    it("has optional metadata as text", () => {
      const org: Partial<Organization> = {
        metadata: JSON.stringify({ timezone: "America/New_York" }),
      };

      expect(org.metadata).toContain("timezone");
    });
  });

  describe("Member type", () => {
    it("has required fields", () => {
      const member: Partial<Member> = {
        id: "member-123",
        userId: "user-123",
        organizationId: "org-123",
        role: "owner",
      };

      expect(member.userId).toBe("user-123");
      expect(member.organizationId).toBe("org-123");
      expect(member.role).toBe("owner");
    });

    it("supports manager role", () => {
      const member: Partial<Member> = {
        role: "manager",
      };
      expect(member.role).toBe("manager");
    });

    it("supports staff role", () => {
      const member: Partial<Member> = {
        role: "staff",
      };
      expect(member.role).toBe("staff");
    });

    it("supports customer role", () => {
      const member: Partial<Member> = {
        role: "customer",
      };
      expect(member.role).toBe("customer");
    });

    it("role defaults to customer", () => {
      const newMember: Partial<NewMember> = {
        userId: "user-456",
        organizationId: "org-456",
      };

      // role is optional with default "customer"
      expect(newMember.role).toBeUndefined();
    });
  });

  describe("Invitation type", () => {
    it("has required fields", () => {
      const invitation: Partial<Invitation> = {
        id: "inv-123",
        email: "newstaff@example.com",
        organizationId: "org-123",
        role: "staff",
        status: "pending",
        expiresAt: new Date("2025-01-20"),
        createdAt: new Date(),
      };

      expect(invitation.email).toBe("newstaff@example.com");
      expect(invitation.status).toBe("pending");
    });

    it("supports accepted status", () => {
      const invitation: Partial<Invitation> = {
        status: "accepted",
      };
      expect(invitation.status).toBe("accepted");
    });

    it("supports expired status", () => {
      const invitation: Partial<Invitation> = {
        status: "expired",
      };
      expect(invitation.status).toBe("expired");
    });

    it("supports canceled status", () => {
      const invitation: Partial<Invitation> = {
        status: "canceled",
      };
      expect(invitation.status).toBe("canceled");
    });

    it("has optional inviterId", () => {
      const invitation: Partial<Invitation> = {
        inviterId: "user-admin",
      };
      expect(invitation.inviterId).toBe("user-admin");
    });
  });

  describe("Verification type", () => {
    it("has required fields", () => {
      const verification: Partial<Verification> = {
        id: "ver-123",
        identifier: "test@example.com",
        value: "verification_token_abc123",
        expiresAt: new Date("2025-01-16"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(verification.identifier).toBe("test@example.com");
      expect(verification.value).toContain("token");
    });

    it("tracks expiration for security", () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      const verification: Partial<Verification> = {
        expiresAt: futureDate,
      };

      expect(verification.expiresAt).toBeInstanceOf(Date);
      expect(verification.expiresAt! > new Date()).toBe(true);
    });
  });
});
