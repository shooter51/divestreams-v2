import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module before importing the function under test
vi.mock("../../../../lib/db/index", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

// Use importOriginal to get all schema exports
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

    // Set up Drizzle ORM chain mocks
    const mockReturning = vi.fn().mockResolvedValue([{ id: "mock-uuid-123" }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    // Set up select chain mocks
    // First call: organization lookup (should return the org)
    // Second call: customer existence check (should return empty to allow seeding)
    let selectCallCount = 0;
    const mockLimit = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // First call: organization lookup
        return Promise.resolve([{ id: mockOrganizationId }]);
      } else {
        // Second call: customer existence check (return empty to allow seeding)
        return Promise.resolve([]);
      }
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

    // Mock queries for checking existing data
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Suppress console.log and console.warn during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("architectural changes (KAN-656)", () => {
    it("uses Drizzle ORM instead of raw SQL", async () => {
      await seedDemoData(mockOrganizationId);

      // Verify Drizzle ORM insert was called (not raw SQL client.unsafe)
      expect(db.insert).toHaveBeenCalled();

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(insertMock.values).toHaveBeenCalled();
    });

    it("accepts organization ID parameter", async () => {
      await seedDemoData(mockOrganizationId);

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Verify insert was called with organizationId in values
      expect(insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
        })
      );
    });

    it("does not use tenant schemas", async () => {
      await seedDemoData(mockOrganizationId);

      // With Drizzle ORM, we don't make raw SQL calls with tenant_demo schema
      // The calls should all be through db.insert() which uses PUBLIC schema
      expect(db.insert).toHaveBeenCalled();

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Verify organizationId is passed to entity table inserts (PUBLIC schema pattern)
      // Note: Join tables (like tour_dive_sites) don't have organizationId, only FKs
      const valuesCalls = insertMock.values.mock.calls;
      expect(valuesCalls.length).toBeGreaterThan(0);

      // Filter to entity tables (those with expected entity fields)
      const entityInserts = valuesCalls.filter(([values]: [unknown]) => {
        if (typeof values !== 'object' || values === null) return false;
        // Entity tables have at least one of these fields
        return values.name || values.email || values.latitude || values.category;
      });

      expect(entityInserts.length).toBeGreaterThan(0);

      // All entity inserts should have organizationId
      entityInserts.forEach(([values]: [unknown]) => {
        expect(values).toHaveProperty('organizationId', mockOrganizationId);
      });
    });
  });

  describe("customer seeding", () => {
    it("inserts customers with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Find customer inserts (by checking for email field)
      const customerInserts = insertMock.values.mock.calls.filter(
        ([values]: [unknown]) => values && typeof values.email === 'string'
      );

      expect(customerInserts.length).toBeGreaterThan(0);

      // All customer inserts should have organizationId
      customerInserts.forEach(([values]: [unknown]) => {
        expect(values.organizationId).toBe(mockOrganizationId);
      });
    });
  });

  describe("dive site seeding", () => {
    it("inserts dive sites with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Find dive site inserts (by checking for latitude field)
      const diveSiteInserts = insertMock.values.mock.calls.filter(
        ([values]: [unknown]) => values && typeof values.latitude === 'string'
      );

      expect(diveSiteInserts.length).toBeGreaterThan(0);

      // All dive site inserts should have organizationId
      diveSiteInserts.forEach(([values]: [unknown]) => {
        expect(values.organizationId).toBe(mockOrganizationId);
      });
    });
  });

  describe("equipment seeding", () => {
    it("inserts equipment with organizationId and isPublic", async () => {
      await seedDemoData(mockOrganizationId);

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Find equipment inserts (by checking for rentalPrice field)
      const equipmentInserts = insertMock.values.mock.calls.filter(
        ([values]: [unknown]) => values && typeof values.rentalPrice === 'string'
      );

      expect(equipmentInserts.length).toBeGreaterThan(0);

      // All equipment inserts should have organizationId and isPublic: false
      equipmentInserts.forEach(([values]: [unknown]) => {
        expect(values.organizationId).toBe(mockOrganizationId);
        expect(values.isPublic).toBe(false);
      });
    });
  });

  describe("trip seeding", () => {
    it("inserts trips with organizationId and isPublic", async () => {
      await seedDemoData(mockOrganizationId);

      // Get the mock values function from the insert chain
      const insertMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;

      // Find trip inserts (by checking for tourId field)
      const tripInserts = insertMock.values.mock.calls.filter(
        ([values]: [unknown]) => values && values.tourId && values.date
      );

      expect(tripInserts.length).toBeGreaterThan(0);

      // All trip inserts should have organizationId and isPublic: false
      tripInserts.forEach(([values]: [unknown]) => {
        expect(values.organizationId).toBe(mockOrganizationId);
        expect(values.isPublic).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    it("propagates database insert errors", async () => {
      const mockError = new Error("Database connection failed");
      const mockReturning = vi.fn().mockRejectedValueOnce(mockError);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: mockValues });

      await expect(seedDemoData(mockOrganizationId)).rejects.toThrow("Database connection failed");
    });
  });

  describe("completion logging", () => {
    it("logs completion message with organization ID", async () => {
      const consoleLogSpy = vi.spyOn(console, "log");

      await seedDemoData(mockOrganizationId);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Demo data seeded for organization: ${mockOrganizationId}`)
      );
    });
  });
});
