/**
 * Admin Password Reset Tests
 *
 * Tests for admin-initiated password reset functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetUserPassword } from "../../../../lib/auth/admin-password-reset.server";
import * as passwordModule from "../../../../lib/auth/password.server";
import * as emailModule from "../../../../lib/email/email.server";
import * as emailTemplateModule from "../../../../lib/email/templates/password-changed-by-admin";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock organization for require()
vi.mock("../../../../lib/db/schema/auth", () => ({
  user: { id: "user-mock", email: "email-mock", name: "name-mock" },
  account: {
    id: "account-mock",
    userId: "userId-mock",
    password: "password-mock",
    forcePasswordChange: "forcePasswordChange-mock",
  },
  organization: { id: "org-mock", name: "org-name-mock" },
  member: { id: "member-mock", userId: "userId-mock", organizationId: "organizationId-mock" },
}));

vi.mock("../../../../lib/db/schema/password-audit", () => ({
  passwordChangeAudit: { id: "audit-mock" },
}));

describe("Admin Password Reset Module", () => {
  let db: any;

  // Helper to setup database mocks for a successful password reset
  const setupSuccessfulMocks = () => {
    // Setup sequential select queries for:
    // 1. Target user, 2. Admin user, 3. Organization, 4. Admin membership, 5. Target membership, 6. User account
    db.select = vi
      .fn()
      // 1. Target user
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "user-123",
                email: "user@example.com",
                name: "Test User",
              },
            ]),
          }),
        }),
      })
      // 2. Admin user
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "admin-456",
                email: "admin@example.com",
                name: "Admin User",
              },
            ]),
          }),
        }),
      })
      // 3. Organization
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "org-789",
                name: "Test Organization",
              },
            ]),
          }),
        }),
      })
      // 4. Admin membership
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "member-admin",
                userId: "admin-456",
                organizationId: "org-789",
                role: "owner",
              },
            ]),
          }),
        }),
      })
      // 5. Target membership
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "member-user",
                userId: "user-123",
                organizationId: "org-789",
                role: "staff",
              },
            ]),
          }),
        }),
      })
      // 6. User account
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "account-123",
                userId: "user-123",
              },
            ]),
          }),
        }),
      });

    // Setup transaction mock
    db.transaction = vi.fn().mockImplementation(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "audit-123",
                createdAt: new Date("2024-01-01T12:00:00Z"),
              },
            ]),
          }),
        }),
      };
      return callback(tx);
    });
  };

  beforeEach(async () => {
    // Import db after mocks are set up
    const dbModule = await import("../../../../lib/db");
    db = dbModule.db;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default successful mocks for all tests
    setupSuccessfulMocks();

    // Mock password functions
    vi.spyOn(passwordModule, "hashPassword").mockResolvedValue(
      "salt:hashedpassword"
    );
    vi.spyOn(passwordModule, "generateRandomPassword").mockReturnValue(
      "RandomPass123"
    );

    // Mock email functions
    vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      success: true,
      messageId: "email-123",
    });

    vi.spyOn(
      emailTemplateModule,
      "getPasswordChangedByAdminEmail"
    ).mockReturnValue({
      subject: "Password Changed",
      html: "<p>Password changed</p>",
      text: "Password changed",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // AUTO_GENERATED METHOD TESTS
  // ============================================================================

  describe("resetUserPassword - auto_generated", () => {
    it("should successfully reset password with auto-generated password", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toBe("RandomPass123");
      expect(result.auditId).toBe("audit-123");
      expect(passwordModule.generateRandomPassword).toHaveBeenCalledWith(16);
      expect(passwordModule.hashPassword).toHaveBeenCalledWith(
        "RandomPass123"
      );
      expect(emailModule.sendEmail).toHaveBeenCalled();
    });

    it("should set forcePasswordChange to true for auto-generated", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      // Verify transaction was used
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should return temporaryPassword only for auto_generated method", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(result.temporaryPassword).toBe("RandomPass123");
    });

    it("should create audit log for auto_generated method", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
      });

      // Verify transaction was called and audit record was created
      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });
  });

  // ============================================================================
  // MANUAL_ENTRY METHOD TESTS
  // ============================================================================

  describe("resetUserPassword - manual_entry", () => {
    it("should successfully reset password with manual password", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: "ManualPass123!",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toBeUndefined();
      expect(passwordModule.hashPassword).toHaveBeenCalledWith(
        "ManualPass123!"
      );
      expect(emailModule.sendEmail).toHaveBeenCalled();
    });

    it("should set forcePasswordChange based on parameter", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: "ManualPass123!",
        forcePasswordChange: true,
      });

      // Verify transaction was used
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should default forcePasswordChange to false for manual_entry", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: "ManualPass123!",
      });

      // Verify transaction was used
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should throw error if newPassword missing for manual_entry", async () => {
      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "manual_entry",
        })
      ).rejects.toThrow("newPassword is required for manual_entry method");
    });

    it("should create audit log for manual_entry method", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: "ManualPass123!",
        ipAddress: "10.0.0.1",
      });

      // Verify transaction was called and audit record was created
      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });
  });

  // ============================================================================
  // EMAIL_RESET METHOD TESTS
  // ============================================================================

  describe("resetUserPassword - email_reset", () => {
    it("should successfully initiate email reset", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "email_reset",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toBeUndefined();
      expect(emailModule.sendEmail).toHaveBeenCalled();
    });

    it("should NOT update password for email_reset method", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "email_reset",
      });

      // Should use transaction (for audit log) but not update password
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should create audit log for email_reset method", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "email_reset",
        ipAddress: "172.16.0.1",
      });

      // Verify transaction was called and audit record was created
      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });

    it("should send email notification for email_reset", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "email_reset",
      });

      expect(emailModule.sendEmail).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Password Changed",
        html: "<p>Password changed</p>",
        text: "Password changed",
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe("Error Handling", () => {
    it("should throw error if target user not found", async () => {
      db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        resetUserPassword({
          targetUserId: "nonexistent",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("Target user not found");
    });

    it("should throw error if admin user not found", async () => {
      db.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", email: "user@example.com", name: "Test User" },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "nonexistent",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("Admin user not found");
    });

    it("should throw error if organization not found", async () => {
      db.select = vi
        .fn()
        // 1. Target user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", email: "user@example.com", name: "Test User" },
              ]),
            }),
          }),
        })
        // 2. Admin user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "admin-456", email: "admin@example.com", name: "Admin" },
              ]),
            }),
          }),
        })
        // 3. Organization - NOT FOUND
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "nonexistent",
          method: "auto_generated",
        })
      ).rejects.toThrow("Organization not found");
    });

    it("should throw error if admin user does not belong to organization", async () => {
      db.select = vi
        .fn()
        // 1. Target user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", email: "user@example.com", name: "Test User" },
              ]),
            }),
          }),
        })
        // 2. Admin user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "admin-456", email: "admin@example.com", name: "Admin" },
              ]),
            }),
          }),
        })
        // 3. Organization
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-789", name: "Test Org" },
              ]),
            }),
          }),
        })
        // 4. Admin membership - NOT FOUND
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("Admin user does not belong to the specified organization");
    });

    it("should throw error if target user does not belong to organization", async () => {
      db.select = vi
        .fn()
        // 1. Target user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", email: "user@example.com", name: "Test User" },
              ]),
            }),
          }),
        })
        // 2. Admin user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "admin-456", email: "admin@example.com", name: "Admin" },
              ]),
            }),
          }),
        })
        // 3. Organization
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-789", name: "Test Org" },
              ]),
            }),
          }),
        })
        // 4. Admin membership - FOUND
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-admin", userId: "admin-456", organizationId: "org-789" },
              ]),
            }),
          }),
        })
        // 5. Target membership - NOT FOUND
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("Target user does not belong to the specified organization");
    });

    it("should throw error if user account not found", async () => {
      db.select = vi
        .fn()
        // 1. Target user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", email: "user@example.com", name: "Test User" },
              ]),
            }),
          }),
        })
        // 2. Admin user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "admin-456", email: "admin@example.com", name: "Admin" },
              ]),
            }),
          }),
        })
        // 3. Organization
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-789", name: "Test Org" },
              ]),
            }),
          }),
        })
        // 4. Admin membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-admin", userId: "admin-456", organizationId: "org-789" },
              ]),
            }),
          }),
        })
        // 5. Target membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-user", userId: "user-123", organizationId: "org-789" },
              ]),
            }),
          }),
        })
        // 6. User account - NOT FOUND
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("User account not found");
    });

    it("should continue if email sending fails", async () => {
      vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
        success: false,
        error: "SMTP error",
      });

      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(result.success).toBe(true);
      expect(result.auditId).toBe("audit-123");
    });

    it("should handle database errors gracefully", async () => {
      db.transaction = vi.fn().mockRejectedValue(new Error("Database error"));

      await expect(
        resetUserPassword({
          targetUserId: "user-123",
          adminUserId: "admin-456",
          organizationId: "org-789",
          method: "auto_generated",
        })
      ).rejects.toThrow("Database error");
    });
  });

  // ============================================================================
  // EMAIL NOTIFICATION TESTS
  // ============================================================================

  describe("Email Notifications", () => {
    it("should send email with correct template data", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(
        emailTemplateModule.getPasswordChangedByAdminEmail
      ).toHaveBeenCalledWith({
        userName: "Test User",
        userEmail: "user@example.com",
        adminName: expect.any(String),
        method: "auto_generated",
        organizationName: expect.any(String),
        changedAt: expect.any(String),
        loginUrl: expect.any(String),
      });
    });

    it("should handle missing SMTP configuration", async () => {
      vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
        success: true,
        messageId: "dev-123",
      });

      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe("Security", () => {
    it("should hash password before storing", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: "PlainTextPassword",
      });

      expect(passwordModule.hashPassword).toHaveBeenCalledWith(
        "PlainTextPassword"
      );
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should generate cryptographically secure random passwords", async () => {
      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(passwordModule.generateRandomPassword).toHaveBeenCalledWith(16);
    });

    it("should log IP address in audit trail", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        ipAddress: "203.0.113.1",
      });

      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });

    it("should log user agent in audit trail", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        userAgent: "TestAgent/1.0",
      });

      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle user with no name (use email)", async () => {
      // Mock all necessary database calls for this test
      db.select = vi
        .fn()
        // 1. Target user (with null name)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "user-123",
                  email: "user@example.com",
                  name: null,
                },
              ]),
            }),
          }),
        })
        // 2. Admin user
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "admin-456", email: "admin@example.com", name: "Admin" },
              ]),
            }),
          }),
        })
        // 3. Organization
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-789", name: "Test Org" },
              ]),
            }),
          }),
        })
        // 4. Admin membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-admin", userId: "admin-456", organizationId: "org-789" },
              ]),
            }),
          }),
        })
        // 5. Target membership
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-user", userId: "user-123", organizationId: "org-789" },
              ]),
            }),
          }),
        })
        // 6. User account
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "account-123", userId: "user-123" },
              ]),
            }),
          }),
        });

      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
      });

      expect(result.success).toBe(true);
    });

    it("should handle very long passwords", async () => {
      const longPassword = "A".repeat(1000);

      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: longPassword,
      });

      expect(passwordModule.hashPassword).toHaveBeenCalledWith(longPassword);
    });

    it("should handle special characters in password", async () => {
      const specialPassword = "P@ssw0rd!#$%^&*()_+-=[]{}|;:',.<>?/`~";

      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: specialPassword,
      });

      expect(passwordModule.hashPassword).toHaveBeenCalledWith(
        specialPassword
      );
    });

    it("should handle unicode in password", async () => {
      const unicodePassword = "パスワード123🔒";

      await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "manual_entry",
        newPassword: unicodePassword,
      });

      expect(passwordModule.hashPassword).toHaveBeenCalledWith(
        unicodePassword
      );
    });

    it("should handle missing optional parameters", async () => {
      const result = await resetUserPassword({
        targetUserId: "user-123",
        adminUserId: "admin-456",
        organizationId: "org-789",
        method: "auto_generated",
        // No ipAddress or userAgent
      });

      expect(result.success).toBe(true);
      expect(db.transaction).toHaveBeenCalled();
      expect(result.auditId).toBe("audit-123");
    });
  });
});
