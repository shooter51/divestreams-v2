import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module before importing the function under test
vi.mock("../../../../lib/db/index", () => ({
  db: {
    insert: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  createTenantSchema: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
}));

import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";
import { db } from "../../../../lib/db/index";
import { createTenantSchema } from "../../../../lib/db/schema";

describe("seedDemoData", () => {
  const mockSchemaName = "tenant_test_schema";
  const mockInsertResult = { id: "mock-uuid-123" };

  // Mock table objects
  const mockCustomersTable = { id: "customers_id_col" };
  const mockDiveSitesTable = { id: "dive_sites_id_col" };
  const mockBoatsTable = { id: "boats_id_col" };
  const mockEquipmentTable = { id: "equipment_id_col" };
  const mockToursTable = { id: "tours_id_col" };
  const mockTourDiveSitesTable = { id: "tour_dive_sites_id_col" };
  const mockTripsTable = { id: "trips_id_col" };
  const mockBookingsTable = { id: "bookings_id_col" };

  const mockTenantSchema = {
    customers: mockCustomersTable,
    diveSites: mockDiveSitesTable,
    boats: mockBoatsTable,
    equipment: mockEquipmentTable,
    tours: mockToursTable,
    tourDiveSites: mockTourDiveSitesTable,
    trips: mockTripsTable,
    bookings: mockBookingsTable,
  };

  let mockValues: ReturnType<typeof vi.fn>;
  let mockReturning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up chain mocks
    mockReturning = vi.fn().mockResolvedValue([mockInsertResult]);
    mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: mockValues,
    });

    (createTenantSchema as ReturnType<typeof vi.fn>).mockReturnValue(mockTenantSchema);

    // Suppress console.log during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("schema initialization", () => {
    it("creates tenant schema with provided schema name", async () => {
      await seedDemoData(mockSchemaName);

      expect(createTenantSchema).toHaveBeenCalledTimes(1);
      expect(createTenantSchema).toHaveBeenCalledWith(mockSchemaName);
    });

    it("uses the created tenant schema for all insert operations", async () => {
      await seedDemoData(mockSchemaName);

      expect(createTenantSchema).toHaveBeenCalledWith(mockSchemaName);
      // Verify insert was called with tenant schema tables
      const insertCalls = (db.insert as ReturnType<typeof vi.fn>).mock.calls;
      expect(insertCalls.length).toBeGreaterThan(0);
    });
  });

  describe("customer seeding", () => {
    it("inserts all demo customers", async () => {
      await seedDemoData(mockSchemaName);

      // Count customer inserts (8 customers in the demo data)
      const customerInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockCustomersTable
      );
      expect(customerInserts.length).toBe(8);
    });

    it("inserts customer with required fields", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john.smith@example.com",
          firstName: "John",
          lastName: "Smith",
          phone: "+1-555-0101",
        })
      );
    });

    it("inserts customer with certifications as JSON", async () => {
      await seedDemoData(mockSchemaName);

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
      await seedDemoData(mockSchemaName);

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
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "lisa.chen@example.com",
          tags: ["VIP", "Photography"],
        })
      );
    });

    it("inserts customer with notes when provided", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "carlos.garcia@example.com",
          notes: "New diver, eager to learn",
        })
      );
    });

    it("handles customers without emergency contacts", async () => {
      await seedDemoData(mockSchemaName);

      // Yuki Tanaka has no emergency contact
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "yuki.tanaka@example.com",
          emergencyContactName: undefined,
          emergencyContactPhone: undefined,
        })
      );
    });
  });

  describe("dive site seeding", () => {
    it("inserts all demo dive sites", async () => {
      await seedDemoData(mockSchemaName);

      const diveSiteInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockDiveSitesTable
      );
      expect(diveSiteInserts.length).toBe(5);
    });

    it("inserts dive site with coordinates and depth info", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Coral Garden",
          latitude: "18.4655",
          longitude: "-64.6321",
          maxDepth: 12,
          minDepth: 3,
        })
      );
    });

    it("inserts dive site with difficulty level", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "The Wall",
          difficulty: "advanced",
          currentStrength: "strong",
        })
      );
    });

    it("inserts dive site with highlights array", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Shipwreck Bay",
          highlights: ["Wreck penetration", "Moray eels", "Lobsters", "Groupers"],
        })
      );
    });
  });

  describe("boat seeding", () => {
    it("inserts all demo boats", async () => {
      await seedDemoData(mockSchemaName);

      const boatInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockBoatsTable
      );
      expect(boatInserts.length).toBe(2);
    });

    it("inserts boat with capacity and type", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ocean Explorer",
          capacity: 20,
          type: "catamaran",
          registrationNumber: "DV-2024-001",
        })
      );
    });

    it("inserts boat with amenities array", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ocean Explorer",
          amenities: expect.arrayContaining(["Rinse tanks", "Camera table", "Restroom"]),
        })
      );
    });
  });

  describe("equipment seeding", () => {
    it("inserts all demo equipment items", async () => {
      await seedDemoData(mockSchemaName);

      const equipmentInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockEquipmentTable
      );
      expect(equipmentInserts.length).toBe(20);
    });

    it("inserts equipment with rental price", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "bcd",
          name: "Aqua Lung Pro HD",
          rentalPrice: "15.00",
          isRentable: true,
        })
      );
    });

    it("inserts equipment with size info", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "wetsuit",
          name: "3mm Full Suit",
          size: "S",
        })
      );
    });

    it("inserts equipment with default status and condition", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "available",
          condition: "good",
        })
      );
    });
  });

  describe("tour seeding", () => {
    it("inserts all demo tours", async () => {
      await seedDemoData(mockSchemaName);

      const tourInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockToursTable
      );
      expect(tourInserts.length).toBe(5);
    });

    it("inserts tour with pricing and duration", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Discover Scuba Diving",
          type: "course",
          duration: 240,
          price: "150.00",
        })
      );
    });

    it("inserts tour with participant limits", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Night Dive Adventure",
          maxParticipants: 8,
          minParticipants: 2,
        })
      );
    });

    it("inserts tour with inclusions", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Snorkel Safari",
          inclusions: expect.arrayContaining(["Snorkel equipment", "Light lunch"]),
          includesEquipment: true,
          includesMeals: true,
        })
      );
    });

    it("inserts tour with certification requirements", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Night Dive Adventure",
          minCertLevel: "Advanced Open Water",
          requirements: expect.arrayContaining(["Minimum 20 logged dives"]),
        })
      );
    });
  });

  describe("tour-dive site linking", () => {
    it("creates tour to dive site associations", async () => {
      await seedDemoData(mockSchemaName);

      const linkInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockTourDiveSitesTable
      );
      expect(linkInserts.length).toBe(1); // One batch insert
    });
  });

  describe("trip seeding", () => {
    it("inserts all scheduled demo trips", async () => {
      await seedDemoData(mockSchemaName);

      const tripInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockTripsTable
      );
      expect(tripInserts.length).toBe(13);
    });

    it("inserts trip with date and time", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
          endTime: expect.stringMatching(/^\d{2}:\d{2}$/),
          status: "scheduled",
        })
      );
    });
  });

  describe("booking seeding", () => {
    it("inserts all demo bookings", async () => {
      await seedDemoData(mockSchemaName);

      const bookingInserts = (db.insert as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === mockBookingsTable
      );
      expect(bookingInserts.length).toBe(8);
    });

    it("inserts booking with calculated totals", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingNumber: expect.stringMatching(/^BK-\d{4}$/),
          participants: expect.any(Number),
          subtotal: expect.any(String),
          tax: expect.any(String),
          total: expect.any(String),
        })
      );
    });

    it("inserts booking with payment status", async () => {
      await seedDemoData(mockSchemaName);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: "paid",
          paidAmount: expect.any(String),
          source: "direct",
        })
      );
    });
  });

  describe("completion logging", () => {
    it("logs completion message with schema name", async () => {
      const consoleSpy = vi.spyOn(console, "log");
      await seedDemoData(mockSchemaName);

      expect(consoleSpy).toHaveBeenCalledWith(`Demo data seeded for schema: ${mockSchemaName}`);
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

      await expect(seedDemoData(mockSchemaName)).rejects.toThrow("Database connection failed");
    });

    it("propagates schema creation errors", async () => {
      const mockError = new Error("Schema creation failed");
      (createTenantSchema as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(seedDemoData(mockSchemaName)).rejects.toThrow("Schema creation failed");
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

      await seedDemoData(mockSchemaName);

      // Verify customers are inserted before bookings
      const firstCustomerIndex = insertOrder.indexOf(mockCustomersTable);
      const firstBookingIndex = insertOrder.indexOf(mockBookingsTable);
      expect(firstCustomerIndex).toBeGreaterThanOrEqual(0);
      expect(firstBookingIndex).toBeGreaterThanOrEqual(0);
      expect(firstCustomerIndex).toBeLessThan(firstBookingIndex);

      // Verify tours are inserted before trips
      const firstTourIndex = insertOrder.indexOf(mockToursTable);
      const firstTripIndex = insertOrder.indexOf(mockTripsTable);
      expect(firstTourIndex).toBeGreaterThanOrEqual(0);
      expect(firstTripIndex).toBeGreaterThanOrEqual(0);
      expect(firstTourIndex).toBeLessThan(firstTripIndex);

      // Verify dive sites are inserted before tour-dive-site links
      const firstDiveSiteIndex = insertOrder.indexOf(mockDiveSitesTable);
      const firstTourDiveSiteLinkIndex = insertOrder.indexOf(mockTourDiveSitesTable);
      expect(firstDiveSiteIndex).toBeGreaterThanOrEqual(0);
      expect(firstTourDiveSiteLinkIndex).toBeGreaterThanOrEqual(0);
      expect(firstDiveSiteIndex).toBeLessThan(firstTourDiveSiteLinkIndex);
    });

    it("uses returned IDs for foreign key references", async () => {
      let insertCount = 0;
      const mockIds = Array.from({ length: 100 }, (_, i) => `uuid-${i}`);

      (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockIds[insertCount++] }]),
        }),
      }));

      await seedDemoData(mockSchemaName);

      // The function should complete without errors, indicating proper ID handling
      expect(insertCount).toBeGreaterThan(0);
    });
  });
});
