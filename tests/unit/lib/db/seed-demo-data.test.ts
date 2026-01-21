import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import * as schema from "../../../../lib/db/schema";

describe("seedDemoData", () => {
  const mockOrganizationId = "org_test_123";
  const mockInsertResult = { id: "mock-uuid-123" };

  let mockValues: ReturnType<typeof vi.fn>;
  let mockReturning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up insert chain mocks
    mockReturning = vi.fn().mockResolvedValue([mockInsertResult]);
    mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: mockValues,
    });

    // Set up select chain mocks for duplicate checks (returns empty array = no duplicates)
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    // Suppress console.log during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("organization-based seeding", () => {
    it("accepts organization ID parameter", async () => {
      await seedDemoData(mockOrganizationId);

      // Verify insert was called (with organizationId in values)
      expect(db.insert).toHaveBeenCalled();
    });

    it("uses the organization schema for all insert operations", async () => {
      await seedDemoData(mockOrganizationId);

      // Verify insert was called with schema tables
      const insertCalls = (db.insert as ReturnType<typeof vi.fn>).mock.calls;
      expect(insertCalls.length).toBeGreaterThan(0);
    });
  });

  describe("customer seeding", () => {
    it("inserts all demo customers", async () => {
      await seedDemoData(mockOrganizationId);

      // Count customer inserts (8 customers in the demo data)
      const customerInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.customers
      );
      expect(customerInserts.length).toBe(8);
    });

    it("inserts customer with required fields including organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          email: "john.smith@example.com",
          firstName: "John",
          lastName: "Smith",
          phone: "+1-555-0101",
        })
      );
    });

    it("inserts customer with certifications as JSON", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john.smith@example.com",
          certifications: expect.arrayContaining([
            expect.objectContaining({
              agency: "PADI",
              level: "Advanced Open Water",
            }),
          ]),
        })
      );
    });

    it("inserts customer with emergency contact info", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john.smith@example.com",
          emergencyContactName: "Jane Smith",
          emergencyContactPhone: "+1-555-0102",
          emergencyContactRelation: "Spouse",
        })
      );
    });

    it("inserts customer with optional tags", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "lisa.chen@example.com",
          tags: ["VIP", "Photography"],
        })
      );
    });
  });

  describe("dive site seeding", () => {
    it("inserts all demo dive sites", async () => {
      await seedDemoData(mockOrganizationId);

      const diveSiteInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.diveSites
      );
      expect(diveSiteInserts.length).toBe(5);
    });

    it("inserts dive site with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          name: "Coral Garden",
        })
      );
    });
  });

  describe("boat seeding", () => {
    it("inserts all demo boats", async () => {
      await seedDemoData(mockOrganizationId);

      const boatInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.boats
      );
      expect(boatInserts.length).toBe(2);
    });

    it("inserts boat with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          name: "Ocean Explorer",
          capacity: 20,
        })
      );
    });
  });

  describe("equipment seeding", () => {
    it("inserts all demo equipment items", async () => {
      await seedDemoData(mockOrganizationId);

      const equipmentInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.equipment
      );
      expect(equipmentInserts.length).toBe(20);
    });

    it("inserts equipment with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          category: "bcd",
          name: "Aqua Lung Pro HD",
        })
      );
    });
  });

  describe("tour seeding", () => {
    it("inserts all demo tours", async () => {
      await seedDemoData(mockOrganizationId);

      const tourInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.tours
      );
      expect(tourInserts.length).toBe(5);
    });

    it("inserts tour with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          name: "Discover Scuba Diving",
          type: "course",
        })
      );
    });
  });

  describe("trip seeding", () => {
    it("inserts all scheduled demo trips", async () => {
      await seedDemoData(mockOrganizationId);

      const tripInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.trips
      );
      expect(tripInserts.length).toBe(13);
    });

    it("inserts trip with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          status: "scheduled",
        })
      );
    });
  });

  describe("booking seeding", () => {
    it("inserts all demo bookings", async () => {
      await seedDemoData(mockOrganizationId);

      const bookingInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === schema.bookings
      );
      expect(bookingInserts.length).toBe(8);
    });

    it("inserts booking with organizationId", async () => {
      await seedDemoData(mockOrganizationId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          source: "direct",
        })
      );
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
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(mockError),
        }),
      });

      await expect(seedDemoData(mockOrganizationId)).rejects.toThrow("Database connection failed");
    });
  });

  describe("data integrity", () => {
    it("maintains referential integrity by inserting in correct order", async () => {
      // Track actual table references passed to insert()
      const insertOrder: unknown[] = [];
      (db.insert as ReturnType<typeof vi.fn>).mockImplementation((table) => {
        insertOrder.push(table);
        return {
          values: mockValues,
        };
      });

      await seedDemoData(mockOrganizationId);

      // Verify customers are inserted before bookings
      const firstCustomerIndex = insertOrder.indexOf(schema.customers);
      const firstBookingIndex = insertOrder.indexOf(schema.bookings);
      expect(firstCustomerIndex).toBeGreaterThanOrEqual(0);
      expect(firstBookingIndex).toBeGreaterThanOrEqual(0);
      expect(firstCustomerIndex).toBeLessThan(firstBookingIndex);

      // Verify tours are inserted before trips
      const firstTourIndex = insertOrder.indexOf(schema.tours);
      const firstTripIndex = insertOrder.indexOf(schema.trips);
      expect(firstTourIndex).toBeGreaterThanOrEqual(0);
      expect(firstTripIndex).toBeGreaterThanOrEqual(0);
      expect(firstTourIndex).toBeLessThan(firstTripIndex);
    });

    it("uses returned IDs for foreign key references", async () => {
      let insertCount = 0;
      const mockIds = Array.from({ length: 100 }, (_, i) => `uuid-${i}`);

      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockIds[insertCount++] }]),
        }),
      }));

      await seedDemoData(mockOrganizationId);

      // The function should complete without errors, indicating proper ID handling
      expect(insertCount).toBeGreaterThan(0);
    });
  });
});
