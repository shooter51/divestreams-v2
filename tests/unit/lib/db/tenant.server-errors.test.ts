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
  deleteTenant,
  updateTenant,
  listTenants,
} from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

// Get reference to mocked db for type-safe usage
const mockDb = db as any;

describe("Tenant Server Module - Error Paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Default mock for subscriptionPlans query (used in createTenant)
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([{ id: "free-plan-id" }]);

    (mockDb.select as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
        from: mockFrom,
      });

      await expect(getTenantBySubdomain("test")).rejects.toThrow("Connection refused");
    });

    it("should handle query timeout in getTenantById", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockRejectedValue(new Error("Query timeout"));

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.insert as any).mockReturnValue({
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

      (mockDb.insert as any).mockReturnValue({
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

      (mockDb.insert as any).mockReturnValue({
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

      (mockDb.update as any).mockReturnValue({
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
  // Schema Creation Errors
  // ============================================================================

  describe("Schema Creation Failures", () => {
    it("should cleanup tenant record when schema creation fails", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "newshop",
        name: "New Shop",
        schemaName: "tenant_newshop",
      };

      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockTenant]);

      (mockDb.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      // Schema creation fails
      mockClient.unsafe.mockRejectedValueOnce(new Error("Permission denied: cannot create schema"));

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as any).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "newshop",
          name: "New Shop",
          email: "new@shop.com",
        })
      ).rejects.toThrow("Permission denied: cannot create schema");

      // Verify cleanup was attempted
      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("DROP SCHEMA")
      );
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle table creation failure after schema creation", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "newshop",
        schemaName: "tenant_newshop",
      };

      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockTenant]);

      (mockDb.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      // Schema creation succeeds, but table creation fails
      mockClient.unsafe
        .mockResolvedValueOnce([]) // CREATE SCHEMA succeeds
        .mockRejectedValueOnce(new Error("Insufficient disk space")); // CREATE TABLE fails

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as any).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "newshop",
          name: "New Shop",
          email: "new@shop.com",
        })
      ).rejects.toThrow("Insufficient disk space");
    });

    it("should handle cleanup failure gracefully", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("Insert failed"));

      (mockDb.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      // Cleanup also fails
      mockClient.unsafe.mockRejectedValue(new Error("DROP SCHEMA failed"));

      const mockDeleteWhere = vi.fn().mockRejectedValue(new Error("DELETE failed"));
      (mockDb.delete as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
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

      (mockDb.insert as any).mockReturnValue({
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

      (mockDb.update as any).mockReturnValue({
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

      (mockDb.select as any).mockReturnValue({
        from: mockFrom,
      });

      await expect(listTenants()).rejects.toThrow("out of memory");
    });

    it("should handle disk full error during schema creation", async () => {
      const mockTenant = { id: "uuid-123", subdomain: "test", schemaName: "tenant_test" };

      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockTenant]);

      (mockDb.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      mockClient.unsafe.mockRejectedValueOnce(new Error("No space left on device"));

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      (mockDb.delete as any).mockReturnValue({
        where: mockDeleteWhere,
      });

      await expect(
        createTenant({
          subdomain: "test",
          name: "Test",
          email: "test@example.com",
        })
      ).rejects.toThrow("No space left on device");
    });

    it("should handle max connections exceeded", async () => {
      const mockLimit = vi.fn().mockRejectedValue(
        new Error("FATAL: sorry, too many clients already")
      );
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      (mockDb.select as any).mockReturnValue({
        from: mockFrom,
      });

      await expect(getTenantById("uuid-123")).rejects.toThrow("too many clients");
    });
  });
});
