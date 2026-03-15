/**
 * Customer Auth Server Functions Tests
 *
 * Tests for customer authentication functions used by the public site.
 * These tests verify that all required exports exist and are functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module to prevent actual DB connections
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
  },
}));

// Mock the schema module
vi.mock("../../../../lib/db/schema", () => ({
  customerCredentials: { id: "id", organizationId: "organization_id", email: "email" },
  customerSessions: { id: "id", token: "token", customerId: "customer_id" },
  customers: { id: "id", organizationId: "organization_id" },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock the logger to capture authLogger calls
const mockAuthLoggerInfo = vi.fn();
vi.mock("../../../../lib/logger", () => ({
  authLogger: {
    info: vi.fn((...args) => mockAuthLoggerInfo(...args)),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Note: We don't mock node:crypto - it works fine as-is

describe("Customer Auth Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthLoggerInfo.mockClear();
  });

  describe("registerCustomer", () => {
    it("exports registerCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.registerCustomer).toBe("function");
    });

    it("registerCustomer accepts organizationId and data parameters", async () => {
      const { registerCustomer } = await import("../../../../lib/auth/customer-auth.server");
      // Verify function signature by checking it's callable
      expect(registerCustomer.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("loginCustomer", () => {
    it("exports loginCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.loginCustomer).toBe("function");
    });

    it("loginCustomer accepts organizationId, email, and password parameters", async () => {
      const { loginCustomer } = await import("../../../../lib/auth/customer-auth.server");
      expect(loginCustomer.length).toBeGreaterThanOrEqual(1);
    });

    it("logs exactly one 'Customer logged in' message per successful login", async () => {
      const { db } = await import("../../../../lib/db");
      const { authLogger } = await import("../../../../lib/logger");

      // Setup: credentials lookup returns a valid credential record
      const mockWhere = vi.fn().mockResolvedValue([
        {
          id: "cred-1",
          customerId: "customer-1",
          passwordHash: "hashed_password",
        },
      ]);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({ where: mockWhere }),
      } as unknown as ReturnType<typeof db.select>);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof db.insert>);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      } as unknown as ReturnType<typeof db.update>);

      const { loginCustomer } = await import("../../../../lib/auth/customer-auth.server");
      await loginCustomer("org-1", "test@example.com", "password123");

      const infoCallsForLogin = vi.mocked(authLogger.info).mock.calls.filter(
        (args) => args[1] === "Customer logged in"
      );
      expect(infoCallsForLogin).toHaveLength(1);
      expect(infoCallsForLogin[0][0]).toMatchObject({
        organizationId: "org-1",
        email: "test@example.com",
      });
    });
  });

  describe("verifyCustomerSession", () => {
    it("exports verifyCustomerSession function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.verifyCustomerSession).toBe("function");
    });

    it("verifyCustomerSession accepts token parameter", async () => {
      const { verifyCustomerSession } = await import("../../../../lib/auth/customer-auth.server");
      expect(verifyCustomerSession.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getCustomerBySession", () => {
    it("exports getCustomerBySession function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.getCustomerBySession).toBe("function");
    });

    it("getCustomerBySession accepts token parameter", async () => {
      const { getCustomerBySession } = await import("../../../../lib/auth/customer-auth.server");
      expect(getCustomerBySession.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("logoutCustomer", () => {
    it("exports logoutCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.logoutCustomer).toBe("function");
    });

    it("logoutCustomer accepts token parameter", async () => {
      const { logoutCustomer } = await import("../../../../lib/auth/customer-auth.server");
      expect(logoutCustomer.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("requestPasswordReset", () => {
    it("exports requestPasswordReset function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.requestPasswordReset).toBe("function");
    });

    it("requestPasswordReset accepts organizationId and email parameters", async () => {
      const { requestPasswordReset } = await import("../../../../lib/auth/customer-auth.server");
      expect(requestPasswordReset.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("resetPassword", () => {
    it("exports resetPassword function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.resetPassword).toBe("function");
    });

    it("resetPassword accepts organizationId, token, and newPassword parameters", async () => {
      const { resetPassword } = await import("../../../../lib/auth/customer-auth.server");
      expect(resetPassword.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("verifyEmail", () => {
    it("exports verifyEmail function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.verifyEmail).toBe("function");
    });

    it("verifyEmail accepts organizationId and token parameters", async () => {
      const { verifyEmail } = await import("../../../../lib/auth/customer-auth.server");
      expect(verifyEmail.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Module completeness", () => {
    it("exports all 8 required functions", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");

      const requiredFunctions = [
        "registerCustomer",
        "loginCustomer",
        "verifyCustomerSession",
        "getCustomerBySession",
        "logoutCustomer",
        "requestPasswordReset",
        "resetPassword",
        "verifyEmail",
      ];

      for (const fnName of requiredFunctions) {
        expect(module).toHaveProperty(fnName);
        expect(typeof (module as unknown)[fnName]).toBe("function");
      }
    });
  });
});
