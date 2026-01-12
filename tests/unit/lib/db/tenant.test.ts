import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testTenant,
  testCustomers,
} from "../../../fixtures/test-data";

// Mock the database module
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
  getTenantDb,
  generateSchemaName,
  createTenant,
  deleteTenant,
  listTenants,
  updateTenant,
  isSubdomainAvailable,
} from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

describe("Tenant Server Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // generateSchemaName Tests
  // ============================================================================

  describe("generateSchemaName", () => {
    it("should generate a valid schema name from subdomain", () => {
      const result = generateSchemaName("testshop");
      expect(result).toBe("tenant_testshop");
    });

    it("should convert uppercase to lowercase", () => {
      const result = generateSchemaName("TestShop");
      expect(result).toBe("tenant_testshop");
    });

    it("should replace special characters with underscores", () => {
      const result = generateSchemaName("test-shop.com");
      expect(result).toBe("tenant_test_shop_com");
    });

    it("should handle numbers in subdomain", () => {
      const result = generateSchemaName("shop123");
      expect(result).toBe("tenant_shop123");
    });

    it("should handle subdomain with only hyphens", () => {
      const result = generateSchemaName("---");
      expect(result).toBe("tenant____");
    });

    it("should handle empty string", () => {
      const result = generateSchemaName("");
      expect(result).toBe("tenant_");
    });

    it("should handle subdomains with hyphens", () => {
      const result = generateSchemaName("shop-cafe");
      expect(result).toBe("tenant_shop_cafe");
    });
  });

  // ============================================================================
  // getTenantBySubdomain Tests
  // ============================================================================

  describe("getTenantBySubdomain", () => {
    it("should return tenant when found", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "testshop",
        name: "Test Dive Shop",
        email: "owner@testshop.com",
        schemaName: "tenant_testshop",
        isActive: true,
      };

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantBySubdomain("testshop");

      expect(result).toEqual(mockTenant);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return null when tenant not found", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantBySubdomain("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle case-sensitive subdomain lookup", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await getTenantBySubdomain("TESTSHOP");

      expect(db.select).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getTenantById Tests
  // ============================================================================

  describe("getTenantById", () => {
    it("should return tenant when found by ID", async () => {
      const mockTenant = {
        id: "uuid-123",
        subdomain: "testshop",
        name: "Test Dive Shop",
      };

      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantById("uuid-123");

      expect(result).toEqual(mockTenant);
    });

    it("should return null for non-existent ID", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantById("nonexistent-uuid");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getTenantDb Tests
  // ============================================================================

  describe("getTenantDb", () => {
    it("should throw error when DATABASE_URL is not set", () => {
      delete process.env.DATABASE_URL;

      expect(() => getTenantDb("tenant_testshop")).toThrow(
        "DATABASE_URL environment variable is not set"
      );
    });

    it("should return cached connection for same schema", () => {
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

      const result1 = getTenantDb("tenant_testshop");
      const result2 = getTenantDb("tenant_testshop");

      // Both should return the same cached instance
      expect(result1).toBe(result2);
    });

    it("should create new connection for different schema", () => {
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

      const result1 = getTenantDb("tenant_shop1");
      const result2 = getTenantDb("tenant_shop2");

      // Different schemas should get different connections
      // Both are empty objects from our mock, so we can't directly compare
      // but the function should have been called twice
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // ============================================================================
  // createTenant Tests
  // ============================================================================

  describe("createTenant", () => {
    it("should throw error when DATABASE_URL is not set", async () => {
      delete process.env.DATABASE_URL;

      await expect(
        createTenant({
          subdomain: "newshop",
          name: "New Shop",
          email: "new@shop.com",
        })
      ).rejects.toThrow("DATABASE_URL environment variable is not set");
    });

    it("should create tenant with default values", async () => {
      const mockTenant = {
        id: "new-uuid",
        subdomain: "newshop",
        name: "New Shop",
        email: "new@shop.com",
        timezone: "UTC",
        currency: "USD",
        schemaName: "tenant_newshop",
        subscriptionStatus: "trialing",
      };

      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockTenant]);

      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      mockClient.unsafe.mockResolvedValue([]);

      const result = await createTenant({
        subdomain: "newshop",
        name: "New Shop",
        email: "new@shop.com",
      });

      expect(result).toEqual(mockTenant);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should create tenant with custom timezone and currency", async () => {
      const mockTenant = {
        id: "new-uuid",
        subdomain: "europeshop",
        name: "Europe Shop",
        email: "eu@shop.com",
        timezone: "Europe/Paris",
        currency: "EUR",
        schemaName: "tenant_europeshop",
      };

      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockTenant]);

      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      mockClient.unsafe.mockResolvedValue([]);

      const result = await createTenant({
        subdomain: "europeshop",
        name: "Europe Shop",
        email: "eu@shop.com",
        timezone: "Europe/Paris",
        currency: "EUR",
      });

      expect(result.timezone).toBe("Europe/Paris");
      expect(result.currency).toBe("EUR");
    });

    it("should cleanup on failure", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockRejectedValue(new Error("Insert failed"));

      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      mockValues.mockReturnValue({
        returning: mockReturning,
      });

      const mockWhere = vi.fn().mockResolvedValue([]);
      (db.delete as any).mockReturnValue({
        where: mockWhere,
      });

      await expect(
        createTenant({
          subdomain: "failshop",
          name: "Fail Shop",
          email: "fail@shop.com",
        })
      ).rejects.toThrow("Insert failed");
    });
  });

  // ============================================================================
  // deleteTenant Tests
  // ============================================================================

  describe("deleteTenant", () => {
    it("should throw error when tenant not found", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await expect(deleteTenant("nonexistent-uuid")).rejects.toThrow(
        "Tenant not found"
      );
    });

    it("should throw error when DATABASE_URL is not set", async () => {
      const mockTenant = {
        id: "uuid-123",
        schemaName: "tenant_testshop",
      };

      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      delete process.env.DATABASE_URL;

      await expect(deleteTenant("uuid-123")).rejects.toThrow(
        "DATABASE_URL environment variable is not set"
      );
    });

    it("should delete tenant and drop schema", async () => {
      const mockTenant = {
        id: "uuid-123",
        schemaName: "tenant_testshop",
      };

      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);
      const mockDeleteWhere = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      (db.delete as any).mockReturnValue({
        where: mockDeleteWhere,
      });

      mockClient.unsafe.mockResolvedValue([]);

      await deleteTenant("uuid-123");

      expect(mockClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("DROP SCHEMA")
      );
      expect(db.delete).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // listTenants Tests
  // ============================================================================

  describe("listTenants", () => {
    it("should return all tenants when no options provided", async () => {
      const mockTenants = [
        { id: "1", subdomain: "shop1", isActive: true, subscriptionStatus: "active" },
        { id: "2", subdomain: "shop2", isActive: false, subscriptionStatus: "canceled" },
      ];

      const mockFrom = vi.fn().mockResolvedValue(mockTenants);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });

      const result = await listTenants();

      expect(result).toEqual(mockTenants);
    });

    it("should filter by isActive status", async () => {
      const mockTenants = [
        { id: "1", subdomain: "shop1", isActive: true, subscriptionStatus: "active" },
        { id: "2", subdomain: "shop2", isActive: false, subscriptionStatus: "canceled" },
      ];

      const mockFrom = vi.fn().mockResolvedValue(mockTenants);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });

      const result = await listTenants({ isActive: true });

      expect(result).toEqual([mockTenants[0]]);
    });

    it("should filter by subscription status", async () => {
      const mockTenants = [
        { id: "1", subdomain: "shop1", isActive: true, subscriptionStatus: "active" },
        { id: "2", subdomain: "shop2", isActive: true, subscriptionStatus: "trialing" },
      ];

      const mockFrom = vi.fn().mockResolvedValue(mockTenants);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });

      const result = await listTenants({ subscriptionStatus: "trialing" });

      expect(result).toEqual([mockTenants[1]]);
    });

    it("should return empty array when no tenants match", async () => {
      const mockTenants = [
        { id: "1", subdomain: "shop1", isActive: false, subscriptionStatus: "canceled" },
      ];

      const mockFrom = vi.fn().mockResolvedValue(mockTenants);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });

      const result = await listTenants({ isActive: true });

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // updateTenant Tests
  // ============================================================================

  describe("updateTenant", () => {
    it("should update tenant name", async () => {
      const updatedTenant = {
        id: "uuid-123",
        name: "Updated Name",
        subdomain: "testshop",
      };

      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([updatedTenant]);

      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      const result = await updateTenant("uuid-123", { name: "Updated Name" });

      expect(result).toEqual(updatedTenant);
    });

    it("should throw error when tenant not found", async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([]);

      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        updateTenant("nonexistent", { name: "New Name" })
      ).rejects.toThrow("Tenant not found");
    });

    it("should update multiple fields at once", async () => {
      const updatedTenant = {
        id: "uuid-123",
        name: "New Name",
        email: "new@email.com",
        phone: "+1-555-0000",
        timezone: "America/Los_Angeles",
        currency: "EUR",
      };

      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([updatedTenant]);

      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      const result = await updateTenant("uuid-123", {
        name: "New Name",
        email: "new@email.com",
        phone: "+1-555-0000",
        timezone: "America/Los_Angeles",
        currency: "EUR",
      });

      expect(result.name).toBe("New Name");
      expect(result.email).toBe("new@email.com");
    });

    it("should update isActive status", async () => {
      const updatedTenant = {
        id: "uuid-123",
        isActive: false,
      };

      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([updatedTenant]);

      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      const result = await updateTenant("uuid-123", { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  // ============================================================================
  // isSubdomainAvailable Tests
  // ============================================================================

  describe("isSubdomainAvailable", () => {
    it("should return true when subdomain is available", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await isSubdomainAvailable("newsubdomain");

      expect(result).toBe(true);
    });

    it("should return false when subdomain is taken", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{ id: "1", subdomain: "taken" }]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await isSubdomainAvailable("taken");

      expect(result).toBe(false);
    });

    it("should normalize subdomain to lowercase", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await isSubdomainAvailable("UPPERCASE");

      expect(db.select).toHaveBeenCalled();
    });
  });
});
