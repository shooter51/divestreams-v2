/**
 * Tenant Server Error Path Tests
 *
 * Tests specifically for database error handling and edge cases in tenant operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module - must be defined before vi.mock
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  migrationDb: {},
}));

// Mock postgres module
const mockClient = {
  unsafe: vi.fn(),
  end: vi.fn(),
};

vi.mock("postgres", () => ({
  default: vi.fn(() => mockClient),
}));

// Mock drizzle
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({})),
}));

// Import after mocks
import {
  getTenantBySubdomain,
  getTenantById,
  createTenant,
  updateTenant,
  listTenants,
} from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

// Get reference to mocked db for type-safe usage
const mockDb = db as unknown;

describe("Tenant Server Module - Error Paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Default mock for subscriptionPlans query (used in createTenant)
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([{ id: "free-plan-id" }]);

    (mockDb.select as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Database Connection Errors
  // ============================================================================

  describe("Database Connection Failures", () => {
    it("should handle database connection error in getTenantBySubdomain", async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error("Connection refused");
      });

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });

      await expect(getTenantBySubdomain("test")).rejects.toThrow("Connection refused");
    });

    it("should handle query timeout in getTenantById", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockRejectedValue(new Error("Query timeout"));

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await expect(getTenantById("uuid-123")).rejects.toThrow("Query timeout");
    });

    it("should handle database deadlock in createTenant", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("Deadlock detected"));

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        createTenant({
          subdomain: "deadlock",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("Deadlock detected");
    });
  });

  // ============================================================================
  // Constraint Violation Errors
  // ============================================================================

  describe("Database Constraint Violations", () => {
    it("should handle unique constraint violation on subdomain", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(
        new Error("duplicate key value violates unique constraint")
      );

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        createTenant({
          subdomain: "existing",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("duplicate key value violates unique constraint");
    });

    it("should handle foreign key constraint violation", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(
        new Error("violates foreign key constraint")
      );

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        createTenant({
          subdomain: "test",
          name: "Test",
          email: "test@example.com",
          planId: "nonexistent-plan-id",
        })
      ).rejects.toThrow("violates foreign key constraint");
    });

    it("should handle check constraint violation", async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(
        new Error("violates check constraint")
      );

      (mockDb.update as unknown as Mock).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        updateTenant("uuid-123", { name: "" }) // Empty name might violate check
      ).rejects.toThrow("violates check constraint");
    });
  });

  // ============================================================================
  // Tenant Creation Cleanup Errors
  // ============================================================================

  describe("Tenant Creation Cleanup", () => {
    it("should cleanup tenant record when organization insert fails", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "newshop",
        name: "New Shop",
        schemaName: "tenant_newshop",
      };

      let insertCallCount = 0;
      (mockDb.insert as unknown as Mock).mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // tenants insert succeeds (uses .values().returning())
          return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
        }
        // organization insert fails (uses .values() directly — no .returning())
        return { values: vi.fn().mockRejectedValue(new Error("Organization insert failed")) };
      });

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as unknown as Mock).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "newshop",
          name: "New Shop",
          email: "new@shop.com",
        })
      ).rejects.toThrow("Organization insert failed");

      // Verify cleanup was attempted (delete tenant record)
      expect(mockDb.delete).toHaveBeenCalled();
      // No schema DDL should have been attempted
      expect(mockClient.unsafe).not.toHaveBeenCalled();
    });

    it("should cleanup both tenant and organization when subscription insert fails", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "newshop",
        schemaName: "tenant_newshop",
      };

      let insertCallCount = 0;
      (mockDb.insert as unknown as Mock).mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // tenants insert succeeds (uses .values().returning())
          return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
        }
        if (insertCallCount === 2) {
          // organization insert succeeds (uses .values() directly)
          return { values: vi.fn().mockResolvedValue([{}]) };
        }
        // subscription insert fails (uses .values() directly)
        return { values: vi.fn().mockRejectedValue(new Error("Subscription insert failed")) };
      });

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as unknown as Mock).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "newshop",
          name: "New Shop",
          email: "new@shop.com",
        })
      ).rejects.toThrow("Subscription insert failed");

      // No schema DDL should have been attempted
      expect(mockClient.unsafe).not.toHaveBeenCalled();
    });

    it("should handle cleanup failure gracefully", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("Insert failed"));

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      // Cleanup also fails
      mockClient.unsafe.mockRejectedValue(new Error("DROP SCHEMA failed"));

      const mockDeleteWhere = vi.fn().mockRejectedValue(new Error("DELETE failed"));
      (mockDb.delete as unknown as Mock).mockReturnValue({
        where: mockDeleteWhere,
      });

      // Should still throw original error
      await expect(
        createTenant({
          subdomain: "test",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  // ============================================================================
  // Network and Timeout Errors
  // ============================================================================

  describe("Network and Timeout Errors", () => {
    it("should handle network error during query", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await expect(getTenantBySubdomain("test")).rejects.toThrow("ECONNREFUSED");
    });

    it("should handle connection timeout", async () => {
      const mockFrom = vi.fn().mockRejectedValue(new Error("Connection timeout after 30s"));

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });

      await expect(
        listTenants({ isActive: true })
      ).rejects.toThrow("Connection timeout");
    });
  });

  // ============================================================================
  // Invalid Data Errors
  // ============================================================================

  describe("Invalid Data Handling", () => {
    it("should handle malformed UUID in getTenantById", async () => {
      const mockLimit = vi.fn().mockRejectedValue(new Error("invalid input syntax for type uuid"));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });

      await expect(getTenantById("not-a-uuid")).rejects.toThrow(
        "invalid input syntax for type uuid"
      );
    });

    it("should handle SQL injection attempt in subdomain", async () => {
      const maliciousSubdomain = "test'; DROP TABLE tenants; --";
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Should handle gracefully (parameterized queries prevent injection)
      const result = await getTenantBySubdomain(maliciousSubdomain);
      expect(result).toBeNull();
    });

    it("should handle extremely long subdomain", async () => {
      const longSubdomain = "a".repeat(10000);
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockRejectedValue(new Error("value too long"));

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await expect(getTenantBySubdomain(longSubdomain)).rejects.toThrow("value too long");
    });
  });

  // ============================================================================
  // Transaction and Concurrency Errors
  // ============================================================================

  describe("Transaction and Concurrency Issues", () => {
    it("should handle concurrent tenant creation attempts", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn()
        .mockRejectedValueOnce(new Error("deadlock detected"))
        .mockResolvedValueOnce([{ id: "uuid-123", subdomain: "test" }]);

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      // First attempt fails with deadlock
      await expect(
        createTenant({
          subdomain: "test",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("deadlock detected");
    });

    it("should handle row lock timeout in updateTenant", async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(
        new Error("could not obtain lock on row")
      );

      (mockDb.update as unknown as Mock).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        updateTenant("uuid-123", { name: "New Name" })
      ).rejects.toThrow("could not obtain lock on row");
    });
  });

  // ============================================================================
  // Resource Exhaustion Errors
  // ============================================================================

  describe("Resource Exhaustion", () => {
    it("should handle out of memory error", async () => {
      const mockFrom = vi.fn().mockRejectedValue(new Error("out of memory"));

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });

      await expect(listTenants()).rejects.toThrow("out of memory");
    });

    it("should handle disk full error during tenant record insert", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("No space left on device"));

      (mockDb.insert as unknown as Mock).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as unknown as Mock).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "test",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("No space left on device");

      // No schema DDL should have been attempted
      expect(mockClient.unsafe).not.toHaveBeenCalled();
    });

    it("should handle max connections exceeded", async () => {
      const mockLimit = vi.fn().mockRejectedValue(
        new Error("FATAL: sorry, too many clients already")
      );
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      (mockDb.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });

      await expect(getTenantById("uuid-123")).rejects.toThrow("too many clients");
    });
  });
});
