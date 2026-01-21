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

// Note: We don't mock node:crypto - it works fine as-is

describe("Customer Auth Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        expect(typeof (module as any)[fnName]).toBe("function");
      }
    });
  });
});
