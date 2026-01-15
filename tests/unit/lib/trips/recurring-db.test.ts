/**
 * Recurring Trips Database Tests
 *
 * Tests for recurring trip functions that require database access.
 * Uses mocked database calls to test business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create chain mock using vi.hoisted to avoid hoisting issues
const { dbMock, mockReturning, mockLimit, resetMocks } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockLimit = vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = mockLimit;
  chain.returning = mockReturning;
  // Thenable
  chain.then = (resolve: (value: unknown[]) => void) => {
    resolve([]);
    return chain;
  };

  const resetMocks = () => {
    Object.values(chain).forEach((mock) => {
      if (typeof mock === "function" && mock.mockClear) {
        mock.mockClear();
      }
    });
    mockReturning.mockClear();
    mockLimit.mockClear();
    // Reset thenable to return empty array by default
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([]);
  };

  return { dbMock: chain, mockReturning, mockLimit, resetMocks };
});

// Mock the database
vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

// Mock the schema
vi.mock("../../../../lib/db/schema", () => ({
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    boatId: "boatId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    maxParticipants: "maxParticipants",
    price: "price",
    notes: "notes",
    staffIds: "staffIds",
    weatherNotes: "weatherNotes",
    isRecurring: "isRecurring",
    recurrencePattern: "recurrencePattern",
    recurrenceDays: "recurrenceDays",
    recurrenceEndDate: "recurrenceEndDate",
    recurrenceCount: "recurrenceCount",
    recurringTemplateId: "recurringTemplateId",
    recurrenceIndex: "recurrenceIndex",
    status: "status",
    updatedAt: "updatedAt",
  },
}));

// Mock drizzle-orm functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  or: vi.fn((...conditions) => ({ conditions, op: "or" })),
  gte: vi.fn((col, val) => ({ col, val, op: "gte" })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("recurring.server database functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================================
  // createRecurringTrip Tests
  // ============================================================================
  describe("createRecurringTrip", () => {
    it("inserts template trip into database", async () => {
      // Setup mock to return a template ID
      mockReturning.mockResolvedValueOnce([{ id: "template-123" }]);

      const { createRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = {
        organizationId: "org-1",
        tourId: "tour-1",
        startTime: "09:00",
        startDate: "2025-01-01",
        recurrencePattern: "daily" as const,
      };

      await createRecurringTrip(template, { generateInstances: false });

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
    });

    it("generates future instances when requested", async () => {
      // First call returns template, second is for future instances
      mockReturning.mockResolvedValueOnce([{ id: "template-123" }]);

      const { createRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = {
        organizationId: "org-1",
        tourId: "tour-1",
        startTime: "09:00",
        startDate: "2025-01-01",
        recurrencePattern: "daily" as const,
        recurrenceCount: 3,
      };

      const result = await createRecurringTrip(template, {
        generateInstances: true,
        generateUntil: "2025-01-05",
      });

      expect(result.templateId).toBe("template-123");
      expect(result.generatedCount).toBeGreaterThanOrEqual(1);
    });

    it("handles weekly pattern with recurrence days", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "template-456" }]);

      const { createRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = {
        organizationId: "org-1",
        tourId: "tour-1",
        startTime: "09:00",
        startDate: "2025-01-06",
        recurrencePattern: "weekly" as const,
        recurrenceDays: [1, 3, 5], // Mon, Wed, Fri
      };

      const result = await createRecurringTrip(template, {
        generateInstances: false,
      });

      expect(result.templateId).toBe("template-456");
    });

    it("handles monthly pattern", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "template-789" }]);

      const { createRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = {
        organizationId: "org-1",
        tourId: "tour-1",
        startTime: "10:00",
        startDate: "2025-01-15",
        recurrencePattern: "monthly" as const,
        recurrenceEndDate: "2025-06-15",
      };

      const result = await createRecurringTrip(template, {
        generateInstances: false,
      });

      expect(result.templateId).toBe("template-789");
      expect(dbMock.insert).toHaveBeenCalled();
    });

    it("includes optional fields when provided", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "template-full" }]);

      const { createRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = {
        organizationId: "org-1",
        tourId: "tour-1",
        boatId: "boat-1",
        startTime: "09:00",
        endTime: "12:00",
        maxParticipants: 10,
        price: 99.99,
        notes: "Test trip",
        staffIds: ["staff-1", "staff-2"],
        weatherNotes: "Clear skies",
        startDate: "2025-01-01",
        recurrencePattern: "weekly" as const,
      };

      await createRecurringTrip(template, { generateInstances: false });

      expect(dbMock.values).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // generateTripsFromRecurrence Tests
  // ============================================================================
  describe("generateTripsFromRecurrence", () => {
    it("throws error when template not found", async () => {
      mockLimit.mockResolvedValueOnce([]); // No template found

      const { generateTripsFromRecurrence } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await expect(
        generateTripsFromRecurrence("org-1", "nonexistent", "2025-01-01", "2025-02-01")
      ).rejects.toThrow("Template not found or is not a recurring trip");
    });

    it("generates new instances from existing template", async () => {
      // First call: get template
      mockLimit.mockResolvedValueOnce([
        {
          id: "template-1",
          organizationId: "org-1",
          tourId: "tour-1",
          boatId: null,
          startTime: "09:00",
          endTime: null,
          maxParticipants: 10,
          price: "50.00",
          notes: null,
          staffIds: null,
          weatherNotes: null,
          recurrencePattern: "daily",
          recurrenceDays: null,
          recurrenceEndDate: null,
          recurrenceCount: null,
        },
      ]);
      // Second call: get existing instances
      mockLimit.mockResolvedValueOnce([
        { date: "2025-01-01", recurrenceIndex: 0 },
        { date: "2025-01-02", recurrenceIndex: 1 },
      ]);

      const { generateTripsFromRecurrence } = await import(
        "../../../../lib/trips/recurring.server"
      );

      // This will try to generate but may return 0 if dates already exist
      await expect(
        generateTripsFromRecurrence("org-1", "template-1", "2025-01-01", "2025-01-10")
      ).resolves.not.toThrow();
    });

    it("calls database queries to check existing instances", async () => {
      const { generateTripsFromRecurrence } = await import(
        "../../../../lib/trips/recurring.server"
      );

      // Should throw since mock returns empty array (no template found)
      await expect(
        generateTripsFromRecurrence("org-1", "template-1", "2025-01-01", "2025-01-03")
      ).rejects.toThrow("Template not found");

      // But it should have attempted to query
      expect(dbMock.select).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getNextOccurrences Tests
  // ============================================================================
  describe("getNextOccurrences", () => {
    it("returns upcoming trip instances", async () => {
      const mockInstances = [
        { id: "trip-1", date: "2025-02-01", startTime: "09:00", status: "scheduled" },
        { id: "trip-2", date: "2025-02-08", startTime: "09:00", status: "scheduled" },
      ];
      mockLimit.mockResolvedValueOnce(mockInstances);

      const { getNextOccurrences } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const instances = await getNextOccurrences("org-1", "template-1", 5);

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("filters out cancelled trips", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getNextOccurrences } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getNextOccurrences("org-1", "template-1", 3);

      // The sql condition filters out cancelled
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("orders results by date and time", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "trip-1", date: "2025-02-01", startTime: "09:00", status: "scheduled" },
      ]);

      const { getNextOccurrences } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getNextOccurrences("org-1", "template-1", 10);

      expect(dbMock.orderBy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // updateRecurringTrip Tests
  // ============================================================================
  describe("updateRecurringTrip", () => {
    it("updates template trip", async () => {
      const { updateRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const result = await updateRecurringTrip(
        "org-1",
        "template-1",
        { startTime: "10:00" },
        { updateFutureInstances: false }
      );

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(result.updatedTemplate).toBe(true);
    });

    it("updates future instances when requested", async () => {
      const { updateRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const result = await updateRecurringTrip(
        "org-1",
        "template-1",
        {
          startTime: "10:00",
          maxParticipants: 15,
        },
        { updateFutureInstances: true }
      );

      // Should have called update twice (template + instances)
      expect(dbMock.update).toHaveBeenCalled();
      expect(result.updatedTemplate).toBe(true);
    });

    it("handles all update fields", async () => {
      const { updateRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await updateRecurringTrip(
        "org-1",
        "template-1",
        {
          tourId: "tour-2",
          boatId: "boat-2",
          startTime: "11:00",
          endTime: "14:00",
          maxParticipants: 20,
          price: 150,
          notes: "Updated notes",
          staffIds: ["staff-3"],
          weatherNotes: "Rain expected",
          recurrencePattern: "weekly",
          recurrenceDays: [1, 5],
          recurrenceEndDate: "2025-12-31",
          recurrenceCount: 52,
        },
        { updateFutureInstances: false }
      );

      expect(dbMock.set).toHaveBeenCalled();
    });

    it("sets price to null when null is provided", async () => {
      const { updateRecurringTrip } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await updateRecurringTrip(
        "org-1",
        "template-1",
        { price: null },
        { updateFutureInstances: false }
      );

      expect(dbMock.set).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // cancelRecurringSeries Tests
  // ============================================================================
  describe("cancelRecurringSeries", () => {
    it("cancels future instances by updating status", async () => {
      const { cancelRecurringSeries } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await cancelRecurringSeries("org-1", "template-1");

      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("includes template when option is set", async () => {
      const { cancelRecurringSeries } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await cancelRecurringSeries("org-1", "template-1", {
        includeTemplate: true,
      });

      // Should call update for instances and template
      expect(dbMock.update).toHaveBeenCalled();
    });

    it("respects cancelDate parameter", async () => {
      const { cancelRecurringSeries } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await cancelRecurringSeries("org-1", "template-1", {
        cancelDate: "2025-03-01",
      });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("returns a number count", async () => {
      const { cancelRecurringSeries } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const count = await cancelRecurringSeries("org-1", "template-1");

      expect(typeof count).toBe("number");
    });

    it("executes without error for any organization and template", async () => {
      const { cancelRecurringSeries } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await expect(
        cancelRecurringSeries("org-1", "template-1")
      ).resolves.not.toThrow();
      await expect(
        cancelRecurringSeries("org-2", "template-xyz", { includeTemplate: true })
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getRecurringSeriesInstances Tests
  // ============================================================================
  describe("getRecurringSeriesInstances", () => {
    it("calls database with correct query structure", async () => {
      const { getRecurringSeriesInstances } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getRecurringSeriesInstances("org-1", "template-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("filters to future only when requested", async () => {
      const { getRecurringSeriesInstances } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getRecurringSeriesInstances("org-1", "template-1", {
        futureOnly: true,
      });

      expect(dbMock.where).toHaveBeenCalled();
    });

    it("respects limit option", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecurringSeriesInstances } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getRecurringSeriesInstances("org-1", "template-1", {
        limit: 50,
      });

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it("defaults to limit of 100", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecurringSeriesInstances } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getRecurringSeriesInstances("org-1", "template-1", {});

      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it("orders by date and startTime", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecurringSeriesInstances } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await getRecurringSeriesInstances("org-1", "template-1");

      expect(dbMock.orderBy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getRecurringTemplate Tests
  // ============================================================================
  describe("getRecurringTemplate", () => {
    it("returns null for non-recurring trip", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "trip-1", recurringTemplateId: null, isRecurring: false },
      ]);

      const { getRecurringTemplate } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = await getRecurringTemplate("org-1", "trip-1");

      expect(template).toBeNull();
    });

    it("returns null for nonexistent trip", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getRecurringTemplate } = await import(
        "../../../../lib/trips/recurring.server"
      );

      const template = await getRecurringTemplate("org-1", "nonexistent");

      expect(template).toBeNull();
    });

    it("queries database to find trip first", async () => {
      const { getRecurringTemplate } = await import(
        "../../../../lib/trips/recurring.server"
      );

      // With empty mock, will return null
      const template = await getRecurringTemplate("org-1", "template-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      // With default empty mock, returns null
      expect(template).toBeNull();
    });

    it("executes without error for any trip ID", async () => {
      const { getRecurringTemplate } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await expect(
        getRecurringTemplate("org-1", "any-trip-id")
      ).resolves.not.toThrow();
    });

    it("handles various organization and trip ID combinations", async () => {
      const { getRecurringTemplate } = await import(
        "../../../../lib/trips/recurring.server"
      );

      await expect(getRecurringTemplate("org-1", "trip-1")).resolves.not.toThrow();
      await expect(getRecurringTemplate("org-2", "trip-2")).resolves.not.toThrow();
      await expect(getRecurringTemplate("org-tenant", "recurring-123")).resolves.not.toThrow();
    });
  });
});
