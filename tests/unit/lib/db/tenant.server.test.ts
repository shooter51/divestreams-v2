/**
 * Unit tests for lib/db/tenant.server.ts
 *
 * Covers: getTenantBySubdomain, getTenantById, getTenantDb, generateSchemaName,
 * isSubdomainAvailable, listTenants, updateTenant, deleteTenant, createTenant.
 *
 * See also:
 *   tenant.server-errors.test.ts  — error path tests
 *   tenant.server-no-legacy-schema.test.ts — TDD tests for legacy schema removal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  migrationDb: {},
}));

vi.mock("postgres", () => ({
  default: vi.fn(() => ({ unsafe: vi.fn(), end: vi.fn() })),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({})),
}));

import {
  getTenantBySubdomain,
  getTenantById,
  getTenantDb,
  generateSchemaName,
  isSubdomainAvailable,
  listTenants,
  updateTenant,
  deleteTenant,
  createTenant,
} from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

type Mock = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
};

describe("tenant.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // generateSchemaName
  // ============================================================================

  describe("generateSchemaName", () => {
    it("should prefix with tenant_", () => {
      expect(generateSchemaName("myshop")).toBe("tenant_myshop");
    });

    it("should lowercase the subdomain", () => {
      expect(generateSchemaName("MyShop")).toBe("tenant_myshop");
    });

    it("should replace non-alphanumeric characters with underscores", () => {
      expect(generateSchemaName("my-shop")).toBe("tenant_my_shop");
      expect(generateSchemaName("my.shop")).toBe("tenant_my_shop");
    });
  });

  // ============================================================================
  // getTenantDb
  // ============================================================================

  describe("getTenantDb", () => {
    it("should return shared db and schema regardless of schemaName", () => {
      const result = getTenantDb("tenant_whatever");
      expect(result).toHaveProperty("db");
      expect(result).toHaveProperty("schema");
    });
  });

  // ============================================================================
  // getTenantBySubdomain
  // ============================================================================

  describe("getTenantBySubdomain", () => {
    it("should return null when tenant not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await getTenantBySubdomain("nonexistent");
      expect(result).toBeNull();
    });

    it("should return tenant when found", async () => {
      const mockTenant = { id: "uuid-1", subdomain: "testshop" };
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await getTenantBySubdomain("testshop");
      expect(result).toEqual(mockTenant);
    });
  });

  // ============================================================================
  // getTenantById
  // ============================================================================

  describe("getTenantById", () => {
    it("should return null when tenant not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await getTenantById("nonexistent-uuid");
      expect(result).toBeNull();
    });

    it("should return tenant when found", async () => {
      const mockTenant = { id: "uuid-1", subdomain: "testshop" };
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await getTenantById("uuid-1");
      expect(result).toEqual(mockTenant);
    });
  });

  // ============================================================================
  // isSubdomainAvailable
  // ============================================================================

  describe("isSubdomainAvailable", () => {
    it("should return false when subdomain is taken by a tenant", async () => {
      const mockTenant = { id: "uuid-1", subdomain: "taken" };
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await isSubdomainAvailable("taken");
      expect(result).toBe(false);
    });

    it("should return true when subdomain is available", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await isSubdomainAvailable("available");
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // listTenants
  // ============================================================================

  describe("listTenants", () => {
    it("should return all tenants", async () => {
      const tenants = [
        { id: "1", subdomain: "a", isActive: true, subscriptionStatus: "active" },
        { id: "2", subdomain: "b", isActive: false, subscriptionStatus: "canceled" },
      ];
      const mockFrom = vi.fn().mockResolvedValue(tenants);
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await listTenants();
      expect(result).toEqual(tenants);
    });

    it("should filter by isActive", async () => {
      const tenants = [
        { id: "1", isActive: true, subscriptionStatus: "active" },
        { id: "2", isActive: false, subscriptionStatus: "canceled" },
      ];
      const mockFrom = vi.fn().mockResolvedValue(tenants);
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await listTenants({ isActive: true });
      expect(result).toEqual([tenants[0]]);
    });
  });

  // ============================================================================
  // updateTenant
  // ============================================================================

  describe("updateTenant", () => {
    it("should return updated tenant", async () => {
      const updated = { id: "uuid-1", name: "New Name" };
      const mockReturning = vi.fn().mockResolvedValue([updated]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const result = await updateTenant("uuid-1", { name: "New Name" });
      expect(result).toEqual(updated);
    });

    it("should throw when tenant not found", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      await expect(updateTenant("nonexistent", { name: "X" })).rejects.toThrow("Tenant not found");
    });
  });

  // ============================================================================
  // deleteTenant
  // ============================================================================

  describe("deleteTenant", () => {
    it("should throw when tenant not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      await expect(deleteTenant("nonexistent")).rejects.toThrow("Tenant not found");
    });

    it("should delete tenant without any schema DDL", async () => {
      const mockTenant = { id: "uuid-1", schemaName: "tenant_shop" };
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere });

      await deleteTenant("uuid-1");
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // createTenant
  // ============================================================================

  describe("createTenant", () => {
    it("should create and return tenant with 3 db inserts (tenant, org, subscription)", async () => {
      const mockTenant = {
        id: "uuid-new",
        subdomain: "newshop",
        name: "New Shop",
        email: "owner@newshop.com",
        schemaName: "tenant_newshop",
      };

      // subscriptionPlans select
      const mockPlanLimit = vi.fn().mockResolvedValue([{ id: "plan-id" }]);
      const mockPlanWhere = vi.fn().mockReturnValue({ limit: mockPlanLimit });
      const mockPlanFrom = vi.fn().mockReturnValue({ where: mockPlanWhere });
      mockDb.select.mockReturnValue({ from: mockPlanFrom });

      let insertCallCount = 0;
      mockDb.insert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
        }
        return { values: vi.fn().mockResolvedValue([{}]) };
      });

      const result = await createTenant({
        subdomain: "newshop",
        name: "New Shop",
        email: "owner@newshop.com",
      });

      expect(result).toEqual(mockTenant);
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });
});
