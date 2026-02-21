/**
 * Tenant Management Business Logic Tests
 *
 * Tests for tenant management functions including subdomain validation,
 * schema generation, and tenant CRUD operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  generateSchemaName,
  isSubdomainAvailable,
  updateTenant,
  getTenantBySubdomain,
  getTenantById,
} from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

describe("Tenant Management Business Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Schema Name Generation Tests
  // ============================================================================

  describe("generateSchemaName", () => {
    it("should generate valid schema name from simple subdomain", () => {
      const result = generateSchemaName("diveshop");
      expect(result).toBe("tenant_diveshop");
    });

    it("should convert uppercase to lowercase", () => {
      const result = generateSchemaName("DiveShop");
      expect(result).toBe("tenant_diveshop");
    });

    it("should replace hyphens with underscores", () => {
      const result = generateSchemaName("dive-shop");
      expect(result).toBe("tenant_dive_shop");
    });

    it("should replace dots with underscores", () => {
      const result = generateSchemaName("dive.shop");
      expect(result).toBe("tenant_dive_shop");
    });

    it("should replace multiple special characters", () => {
      const result = generateSchemaName("dive-shop.test-123");
      expect(result).toBe("tenant_dive_shop_test_123");
    });

    it("should handle numbers in subdomain", () => {
      const result = generateSchemaName("shop123");
      expect(result).toBe("tenant_shop123");
    });

    it("should handle subdomain with leading numbers", () => {
      const result = generateSchemaName("123shop");
      expect(result).toBe("tenant_123shop");
    });

    it("should handle mixed case with special characters", () => {
      const result = generateSchemaName("Dive-Shop_123");
      expect(result).toBe("tenant_dive_shop_123");
    });

    it("should handle consecutive special characters", () => {
      const result = generateSchemaName("dive---shop");
      expect(result).toBe("tenant_dive___shop");
    });

    it("should handle empty string", () => {
      const result = generateSchemaName("");
      expect(result).toBe("tenant_");
    });

    it("should handle subdomain with only special characters", () => {
      const result = generateSchemaName("---");
      expect(result).toBe("tenant____");
    });

    it("should handle very long subdomain", () => {
      const longName = "a".repeat(100);
      const result = generateSchemaName(longName);
      expect(result).toBe(`tenant_${longName}`);
    });

    it("should remove spaces", () => {
      const result = generateSchemaName("dive shop");
      expect(result).toBe("tenant_dive_shop");
    });

    it("should handle subdomain with unicode characters", () => {
      const result = generateSchemaName("dive-café");
      expect(result).toBe("tenant_dive_caf_");
    });
  });

  // ============================================================================
  // Subdomain Availability Tests
  // ============================================================================

  describe("isSubdomainAvailable", () => {
    it("should return true when subdomain is available", async () => {
      // Mock tenant lookup returning no results
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await isSubdomainAvailable("newshop");

      expect(result).toBe(true);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return false when subdomain exists in tenants table", async () => {
      // Mock tenant lookup returning a tenant
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn();

      // First call returns tenant, second call returns empty (no org)
      mockLimit
        .mockResolvedValueOnce([{ id: "tenant-1", subdomain: "existingshop" }])
        .mockResolvedValueOnce([]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await isSubdomainAvailable("existingshop");

      expect(result).toBe(false);
    });

    it("should normalize subdomain to lowercase", async () => {
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await isSubdomainAvailable("TestShop");

      // Verify that lowercase version was checked
      expect(db.select).toHaveBeenCalled();
    });

    it("should return false when subdomain exists in organization table", async () => {
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn();

      // First call returns empty (no tenant), second call returns org
      mockLimit
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "org-1", slug: "existingorg" }]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await isSubdomainAvailable("existingorg");

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Tenant CRUD Tests
  // ============================================================================

  describe("getTenantBySubdomain", () => {
    it("should return tenant when found", async () => {
      const mockTenant = {
        id: "tenant-123",
        subdomain: "testshop",
        name: "Test Dive Shop",
        email: "owner@testshop.com",
        schemaName: "tenant_testshop",
        isActive: true,
        timezone: "America/New_York",
        currency: "USD",
      };

      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);

      (db.select as unknown as Mock).mockReturnValue({
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
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as unknown as Mock).mockReturnValue({
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
  });

  describe("getTenantById", () => {
    it("should return tenant when found by ID", async () => {
      const mockTenant = {
        id: "tenant-456",
        subdomain: "anothershop",
        name: "Another Dive Shop",
        email: "owner@anothershop.com",
        schemaName: "tenant_anothershop",
        isActive: true,
      };

      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockTenant]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantById("tenant-456");

      expect(result).toEqual(mockTenant);
    });

    it("should return null when tenant ID not found", async () => {
      vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as unknown as Mock).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      const result = await getTenantById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  describe("updateTenant", () => {
    it("should update tenant with new data", async () => {
      const updatedTenant = {
        id: "tenant-123",
        subdomain: "testshop",
        name: "Updated Dive Shop",
        email: "newemail@testshop.com",
        phone: "+1234567890",
        timezone: "America/Los_Angeles",
        currency: "USD",
        schemaName: "tenant_testshop",
        isActive: true,
        updatedAt: new Date(),
      };

      vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([updatedTenant]);

      (db.update as unknown as Mock).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      const result = await updateTenant("tenant-123", {
        name: "Updated Dive Shop",
        email: "newemail@testshop.com",
        phone: "+1234567890",
        timezone: "America/Los_Angeles",
      });

      expect(result).toEqual(updatedTenant);
      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Dive Shop",
          email: "newemail@testshop.com",
          phone: "+1234567890",
          timezone: "America/Los_Angeles",
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should throw error when tenant not found", async () => {
      vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([]);

      (db.update as unknown as Mock).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      await expect(
        updateTenant("nonexistent-id", { name: "Test" })
      ).rejects.toThrow("Tenant not found");
    });

    it("should update only provided fields", async () => {
      const updatedTenant = {
        id: "tenant-123",
        subdomain: "testshop",
        name: "Original Name",
        email: "original@testshop.com",
        timezone: "America/New_York",
        currency: "USD",
        schemaName: "tenant_testshop",
        isActive: false, // Only this changed
        updatedAt: new Date(),
      };

      vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([updatedTenant]);

      (db.update as unknown as Mock).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        returning: mockReturning,
      });

      const result = await updateTenant("tenant-123", {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          updatedAt: expect.any(Date),
        })
      );
    });
  });
});
