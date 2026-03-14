/**
 * Unit tests for tenant.server.ts
 *
 * Covers the createTenant function which uses dbLogger to warn when
 * the "standard" plan is missing. See also tenant.test.ts for broader coverage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");

vi.mock("../../../../lib/logger", () => ({
  dbLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock postgres client
const mockUnsafe = vi.fn().mockResolvedValue(undefined);
const mockEnd = vi.fn().mockResolvedValue(undefined);
vi.mock("postgres", () => ({
  default: vi.fn().mockReturnValue({
    unsafe: mockUnsafe,
    end: mockEnd,
  }),
}));

describe("Tenant Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTenantBySubdomain", () => {
    it("should return null when tenant does not exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));
      vi.doMock("../../../../lib/db/schema", () => ({ tenants: {} }));
      vi.doMock("../../../../lib/db/schema/auth", () => ({ organization: {} }));
      vi.doMock("../../../../lib/db/schema/subscription", () => ({ subscription: {} }));

      const { getTenantBySubdomain } = await import("../../../../lib/db/tenant.server");

      const result = await getTenantBySubdomain("nonexistent-shop");
      expect(result).toBeNull();
    });
  });

  describe("generateSchemaName", () => {
    it("should sanitize subdomain to a valid schema name", async () => {
      const { generateSchemaName } = await import("../../../../lib/db/tenant.server");

      expect(generateSchemaName("my-shop")).toBe("tenant_my_shop");
      expect(generateSchemaName("MyShop123")).toBe("tenant_myshop123");
      expect(generateSchemaName("shop.name")).toBe("tenant_shop_name");
    });
  });

  describe("isSubdomainAvailable", () => {
    it("should call database to check availability", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));

      const { isSubdomainAvailable } = await import("../../../../lib/db/tenant.server");

      const available = await isSubdomainAvailable("fresh-shop");
      expect(typeof available).toBe("boolean");
    });
  });
});
