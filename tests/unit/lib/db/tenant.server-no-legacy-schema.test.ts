/**
 * TDD: Verify createTenant() works WITHOUT legacy schema creation
 *
 * These tests assert that createTenant() does NOT call client.unsafe() for
 * CREATE SCHEMA or CREATE TABLE — the legacy per-tenant schema DDL was removed
 * because tenant_* schemas are never used by application queries.
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

// Mock postgres — capture all unsafe() calls so we can assert none are schema DDL
const mockUnsafeCalls: string[] = [];
const mockClient = {
  unsafe: vi.fn((sql: string) => {
    mockUnsafeCalls.push(sql);
    return Promise.resolve([]);
  }),
  end: vi.fn().mockResolvedValue(undefined),
};

vi.mock("postgres", () => ({
  default: vi.fn(() => mockClient),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({})),
}));

import { createTenant } from "../../../../lib/db/tenant.server";
import { db } from "../../../../lib/db/index";

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function setupSuccessfulInsert(returnValue: object) {
  const mockReturning = vi.fn().mockResolvedValue([returnValue]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  mockDb.insert.mockReturnValue({ values: mockValues });
}

describe("createTenant - no legacy schema creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsafeCalls.length = 0;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Default: subscriptionPlans query returns a plan
    const mockLimit = vi.fn().mockResolvedValue([{ id: "standard-plan-id" }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should NOT call client.unsafe() at all — no postgres client is needed", async () => {
    const mockTenant = {
      id: "uuid-001",
      subdomain: "testshop",
      name: "Test Shop",
      email: "owner@testshop.com",
      schemaName: "tenant_testshop",
    };

    // createTenant inserts tenant, organization, and subscription
    let insertCallCount = 0;
    mockDb.insert.mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // tenants insert
        return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
      }
      // organization and subscription inserts
      return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }) };
    });

    await createTenant({
      subdomain: "testshop",
      name: "Test Shop",
      email: "owner@testshop.com",
    });

    // No unsafe() calls should have been made — no schema DDL
    expect(mockClient.unsafe).not.toHaveBeenCalled();
  });

  it("should NOT issue CREATE SCHEMA SQL", async () => {
    const mockTenant = {
      id: "uuid-002",
      subdomain: "diveshop",
      name: "Dive Shop",
      email: "owner@diveshop.com",
      schemaName: "tenant_diveshop",
    };

    let insertCallCount = 0;
    mockDb.insert.mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
      }
      return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }) };
    });

    await createTenant({
      subdomain: "diveshop",
      name: "Dive Shop",
      email: "owner@diveshop.com",
    });

    const createSchemaCalls = mockUnsafeCalls.filter((sql) =>
      sql.toUpperCase().includes("CREATE SCHEMA")
    );
    expect(createSchemaCalls).toHaveLength(0);
  });

  it("should NOT issue CREATE TABLE SQL", async () => {
    const mockTenant = {
      id: "uuid-003",
      subdomain: "aquashop",
      name: "Aqua Shop",
      email: "owner@aqua.com",
      schemaName: "tenant_aquashop",
    };

    let insertCallCount = 0;
    mockDb.insert.mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
      }
      return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }) };
    });

    await createTenant({
      subdomain: "aquashop",
      name: "Aqua Shop",
      email: "owner@aqua.com",
    });

    const createTableCalls = mockUnsafeCalls.filter((sql) =>
      sql.toUpperCase().includes("CREATE TABLE")
    );
    expect(createTableCalls).toHaveLength(0);
  });

  it("should still create tenant, organization, and subscription records", async () => {
    const mockTenant = {
      id: "uuid-004",
      subdomain: "oceanshop",
      name: "Ocean Shop",
      email: "owner@ocean.com",
      schemaName: "tenant_oceanshop",
    };

    const insertedTables: string[] = [];
    mockDb.insert.mockImplementation((table: unknown) => {
      // Track which tables we're inserting into via the table object
      insertedTables.push(String(table));
      if (insertedTables.length === 1) {
        return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
      }
      return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }) };
    });

    const result = await createTenant({
      subdomain: "oceanshop",
      name: "Ocean Shop",
      email: "owner@ocean.com",
    });

    // Should have inserted into 3 tables: tenants, organization, subscription
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
    // Should return the tenant record
    expect(result).toEqual(mockTenant);
  });

  it("should not require DATABASE_URL when no postgres client is used", async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const mockTenant = {
      id: "uuid-005",
      subdomain: "noshop",
      name: "No Shop",
      email: "owner@noshop.com",
      schemaName: "tenant_noshop",
    };

    let insertCallCount = 0;
    mockDb.insert.mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }) };
      }
      return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }) };
    });

    // With legacy schema code removed, DATABASE_URL should not be required
    const result = await createTenant({
      subdomain: "noshop",
      name: "No Shop",
      email: "owner@noshop.com",
    });

    expect(result).toEqual(mockTenant);
    expect(mockClient.unsafe).not.toHaveBeenCalled();

    // Restore
    process.env.DATABASE_URL = originalUrl;
  });
});
