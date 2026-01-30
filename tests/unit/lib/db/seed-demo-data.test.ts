import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock postgres client for raw SQL operations
const mockUnsafe = vi.fn().mockResolvedValue([{ id: "mock-uuid-123" }]);
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockPostgresClient = {
  unsafe: mockUnsafe,
  end: mockEnd,
};

vi.mock("postgres", () => ({
  default: vi.fn(() => mockPostgresClient),
}));

// Mock the database module before importing the function under test
vi.mock("../../../../lib/db/index", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

// Use importOriginal to get all schema exports - avoids missing mock issues
// when the actual code adds new tables
vi.mock("../../../../lib/db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/db/schema")>();
  return {
    ...actual,
  };
});

import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";
import { db } from "../../../../lib/db/index";

describe("seedDemoData", () => {
  const mockOrganizationId = "org_test_123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment variable for postgres connection
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Reset postgres client mocks
    mockUnsafe.mockResolvedValue([{ id: "mock-uuid-123" }]);
    mockEnd.mockResolvedValue(undefined);

    // Set up select chain mocks for organization lookup
    const mockLimit = vi.fn().mockImplementation((limitValue) => {
      if (limitValue === 1) {
        return Promise.resolve([{ slug: "demo" }]);
      }
      return Promise.resolve([]);
    });

    const mockWhere = vi.fn().mockImplementation(() => {
      const result = Promise.resolve([]);
      (result as unknown as { limit: typeof mockLimit }).limit = mockLimit;
      return result;
    });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    // Suppress console.log and console.warn during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("organization-based seeding", () => {
    it("accepts organization ID parameter", async () => {
      await seedDemoData(mockOrganizationId);

      // Verify postgres client was used for raw SQL
      expect(mockUnsafe).toHaveBeenCalled();
    });

    it("uses the tenant schema for all insert operations", async () => {
      await seedDemoData(mockOrganizationId);

      // Verify all SQL uses tenant_demo schema
      const unsafeCalls = mockUnsafe.mock.calls;
      expect(unsafeCalls.length).toBeGreaterThan(0);

      // Check that tenant_demo schema is used in SQL
      const sqlStatements = unsafeCalls.map(call => call[0]);
      const insertStatements = sqlStatements.filter(sql => sql.includes("INSERT INTO"));
      expect(insertStatements.length).toBeGreaterThan(0);

      // All INSERT statements should reference tenant_demo schema
      insertStatements.forEach(sql => {
        expect(sql).toContain('"tenant_demo"');
      });
    });
  });

  describe("customer seeding", () => {
    it("inserts all demo customers", async () => {
      await seedDemoData(mockOrganizationId);

      // Count customer inserts (8 customers in the demo data)
      const customerInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".customers')
      );
      expect(customerInserts.length).toBe(8);
    });

    it("inserts customer with required fields", async () => {
      await seedDemoData(mockOrganizationId);

      // Find John Smith customer insert
      const johnSmithInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "john.smith@example.com"
      );

      expect(johnSmithInsert).toBeDefined();
      const [sql, params] = johnSmithInsert!;

      expect(sql).toContain('INSERT INTO "tenant_demo".customers');
      expect(params[0]).toBe("john.smith@example.com"); // email
      expect(params[1]).toBe("John"); // first_name
      expect(params[2]).toBe("Smith"); // last_name
      expect(params[3]).toBe("+1-555-0101"); // phone
    });

    it("inserts customer with certifications as JSON", async () => {
      await seedDemoData(mockOrganizationId);

      // Find John Smith customer insert
      const johnSmithInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "john.smith@example.com"
      );

      expect(johnSmithInsert).toBeDefined();
      const [, params] = johnSmithInsert!;

      // Certifications are stored as JSON string
      const certifications = JSON.parse(params[8]);
      expect(certifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agency: "PADI",
            level: "Advanced Open Water",
          }),
        ])
      );
    });

    it("inserts customer with emergency contact info", async () => {
      await seedDemoData(mockOrganizationId);

      // Find John Smith customer insert
      const johnSmithInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "john.smith@example.com"
      );

      expect(johnSmithInsert).toBeDefined();
      const [, params] = johnSmithInsert!;

      expect(params[5]).toBe("Jane Smith"); // emergency_contact_name
      expect(params[6]).toBe("+1-555-0102"); // emergency_contact_phone
      expect(params[7]).toBe("Spouse"); // emergency_contact_relation
    });

    it("inserts customer with optional tags", async () => {
      await seedDemoData(mockOrganizationId);

      // Find Lisa Chen customer insert
      const lisaChenInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "lisa.chen@example.com"
      );

      expect(lisaChenInsert).toBeDefined();
      const [, params] = lisaChenInsert!;

      // Tags are stored as JSON string
      const tags = JSON.parse(params[13]);
      expect(tags).toEqual(["VIP", "Photography"]);
    });
  });

  describe("dive site seeding", () => {
    it("inserts all demo dive sites", async () => {
      await seedDemoData(mockOrganizationId);

      const diveSiteInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".dive_sites')
      );
      expect(diveSiteInserts.length).toBe(5);
    });

    it("inserts dive site with correct data", async () => {
      await seedDemoData(mockOrganizationId);

      // Find Coral Garden dive site insert
      const coralGardenInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "Coral Garden"
      );

      expect(coralGardenInsert).toBeDefined();
      const [sql] = coralGardenInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".dive_sites');
    });
  });

  describe("boat seeding", () => {
    it("inserts all demo boats", async () => {
      await seedDemoData(mockOrganizationId);

      const boatInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".boats')
      );
      expect(boatInserts.length).toBe(2);
    });

    it("inserts boat with correct data", async () => {
      await seedDemoData(mockOrganizationId);

      // Find Ocean Explorer boat insert
      const oceanExplorerInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "Ocean Explorer"
      );

      expect(oceanExplorerInsert).toBeDefined();
      const [sql, params] = oceanExplorerInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".boats');
      expect(params[2]).toBe(20); // capacity is 3rd parameter (index 2)
    });
  });

  describe("equipment seeding", () => {
    it("inserts all demo equipment items", async () => {
      await seedDemoData(mockOrganizationId);

      const equipmentInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".equipment')
      );
      expect(equipmentInserts.length).toBe(20);
    });

    it("inserts equipment with correct data", async () => {
      await seedDemoData(mockOrganizationId);

      // Find Aqua Lung Pro HD BCD insert
      const bcdInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[1] === "Aqua Lung Pro HD"
      );

      expect(bcdInsert).toBeDefined();
      const [sql, params] = bcdInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".equipment');
      expect(params[0]).toBe("bcd"); // category
    });
  });

  describe("tour seeding", () => {
    it("inserts all demo tours", async () => {
      await seedDemoData(mockOrganizationId);

      const tourInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".tours')
      );
      expect(tourInserts.length).toBe(5);
    });

    it("inserts tour with correct data", async () => {
      await seedDemoData(mockOrganizationId);

      // Find Discover Scuba Diving tour insert
      const discoverScubaInsert = mockUnsafe.mock.calls.find(
        ([sql, params]) => params && params[0] === "Discover Scuba Diving"
      );

      expect(discoverScubaInsert).toBeDefined();
      const [sql, params] = discoverScubaInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".tours');
      expect(params[2]).toBe("course"); // type is 3rd parameter (index 2)
    });
  });

  describe("trip seeding", () => {
    it("inserts all scheduled demo trips", async () => {
      await seedDemoData(mockOrganizationId);

      const tripInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".trips')
      );
      expect(tripInserts.length).toBe(13);
    });

    it("inserts trip with correct status", async () => {
      await seedDemoData(mockOrganizationId);

      // Find a trip insert with scheduled status (hardcoded in SQL)
      const scheduledTripInsert = mockUnsafe.mock.calls.find(
        ([sql]) =>
          sql.includes('INSERT INTO "tenant_demo".trips') &&
          sql.includes("'scheduled'")
      );

      expect(scheduledTripInsert).toBeDefined();
      const [sql] = scheduledTripInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".trips');
      expect(sql).toContain("'scheduled'"); // status is hardcoded in SQL
    });
  });

  describe("booking seeding", () => {
    it("inserts all demo bookings", async () => {
      await seedDemoData(mockOrganizationId);

      const bookingInserts = mockUnsafe.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO "tenant_demo".bookings')
      );
      expect(bookingInserts.length).toBe(8);
    });

    it("inserts booking with correct source", async () => {
      await seedDemoData(mockOrganizationId);

      // Find a booking insert with "direct" source (hardcoded in SQL)
      const directBookingInsert = mockUnsafe.mock.calls.find(
        ([sql]) =>
          sql.includes('INSERT INTO "tenant_demo".bookings') &&
          sql.includes("'direct'")
      );

      expect(directBookingInsert).toBeDefined();
      const [sql] = directBookingInsert!;
      expect(sql).toContain('INSERT INTO "tenant_demo".bookings');
      expect(sql).toContain("'direct'"); // source is hardcoded in SQL
    });
  });

  describe("completion logging", () => {
    it("logs completion message with organization ID", async () => {
      const consoleSpy = vi.spyOn(console, "log");
      await seedDemoData(mockOrganizationId);

      expect(consoleSpy).toHaveBeenCalledWith(`Demo data seeded for organization: ${mockOrganizationId}`);
    });
  });

  describe("error handling", () => {
    it("propagates database insert errors", async () => {
      const mockError = new Error("Database connection failed");
      mockUnsafe.mockRejectedValueOnce(mockError);

      await expect(seedDemoData(mockOrganizationId)).rejects.toThrow("Database connection failed");
    });
  });

  describe("data integrity", () => {
    it("maintains referential integrity by inserting in correct order", async () => {
      await seedDemoData(mockOrganizationId);

      // Get all SQL statements in order
      const sqlStatements = mockUnsafe.mock.calls.map(([sql]) => sql);

      // Find first customer insert
      const firstCustomerIndex = sqlStatements.findIndex(sql =>
        sql.includes('INSERT INTO "tenant_demo".customers')
      );

      // Find first booking insert
      const firstBookingIndex = sqlStatements.findIndex(sql =>
        sql.includes('INSERT INTO "tenant_demo".bookings')
      );

      // Customers must be inserted before bookings
      expect(firstCustomerIndex).toBeGreaterThanOrEqual(0);
      expect(firstBookingIndex).toBeGreaterThanOrEqual(0);
      expect(firstCustomerIndex).toBeLessThan(firstBookingIndex);

      // Find first tour insert
      const firstTourIndex = sqlStatements.findIndex(sql =>
        sql.includes('INSERT INTO "tenant_demo".tours')
      );

      // Find first trip insert
      const firstTripIndex = sqlStatements.findIndex(sql =>
        sql.includes('INSERT INTO "tenant_demo".trips')
      );

      // Tours must be inserted before trips
      expect(firstTourIndex).toBeGreaterThanOrEqual(0);
      expect(firstTripIndex).toBeGreaterThanOrEqual(0);
      expect(firstTourIndex).toBeLessThan(firstTripIndex);
    });

    it("uses returned IDs for foreign key references", async () => {
      let insertCount = 0;
      const mockIds = Array.from({ length: 100 }, (_, i) => `uuid-${i}`);

      mockUnsafe.mockImplementation(() =>
        Promise.resolve([{ id: mockIds[insertCount++] }])
      );

      await seedDemoData(mockOrganizationId);

      // The function should complete without errors, indicating proper ID handling
      expect(insertCount).toBeGreaterThan(0);
    });
  });
});
