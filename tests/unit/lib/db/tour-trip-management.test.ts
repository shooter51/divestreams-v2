/**
 * Tour and Trip Management Business Logic Tests
 *
 * Tests for tour and trip CRUD operations, filtering,
 * and status management.
 */

import { db } from "../../../../lib/db/index";

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database before imports

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    returning: vi.fn(),
  },
}));
vi.mock("../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    logo: "logo",
    metadata: "metadata",
    customDomain: "customDomain",
    publicSiteSettings: "publicSiteSettings",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  tours: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    type: "type",
    duration: "duration",
    maxParticipants: "maxParticipants",
    minParticipants: "minParticipants",
    price: "price",
    currency: "currency",
    includesEquipment: "includesEquipment",
    includesMeals: "includesMeals",
    includesTransport: "includesTransport",
    minCertLevel: "minCertLevel",
    minAge: "minAge",
    isActive: "isActive",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    boatId: "boatId",
    date: "date",
    startTime: "startTime",
    endTime: "endTime",
    status: "status",
    maxParticipants: "maxParticipants",
    price: "price",
    notes: "notes",
    isPublic: "isPublic",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  boats: {
    id: "id",
    name: "name",
  },
  bookings: {
    tripId: "tripId",
    participants: "participants",
    status: "status",
  },
  tourDiveSites: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    diveSiteId: "diveSiteId",
    createdAt: "createdAt",
  },
}));

// Mock Google Calendar integration
vi.mock("../../../../lib/integrations/google-calendar.server", () => ({
  syncTripToCalendar: vi.fn().mockResolvedValue(undefined),
}));

import {
  getTours,
  getAllTours,
  getTourById,
  createTour,
  updateTourActiveStatus,
  deleteTour,
  createTrip,
  updateTripStatus,
} from "../../../../lib/db/queries.server";

describe("Tour and Trip Management Logic", () => {
  const testOrgId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks - where() returns db for chaining by default
    (db.select as any).mockReturnValue(db);
    (db.from as any).mockReturnValue(db);
    (db.where as any).mockReturnValue(db); // Default: return db for chaining
    (db.innerJoin as any).mockReturnValue(db);
    (db.leftJoin as any).mockReturnValue(db);
    (db.insert as any).mockReturnValue(db);
    (db.values as any).mockReturnValue(db);
    (db.update as any).mockReturnValue(db);
    (db.set as any).mockReturnValue(db);
    (db.delete as any).mockReturnValue(db);
    (db.groupBy as any).mockReturnValue(db);
    (db.orderBy as any).mockResolvedValue([]);
    (db.limit as any).mockResolvedValue([]);
    (db.offset as any).mockResolvedValue([]);
    (db.returning as any).mockResolvedValue([]);
  });

  // ============================================================================
  // Tour Query Tests
  // ============================================================================

  describe("getTours", () => {
    it("should return all tours for organization", async () => {
      const mockTours = [
        {
          id: "tour-1",
          organizationId: testOrgId,
          name: "Reef Dive",
          type: "boat",
          price: "99.00",
          maxParticipants: 10,
          isActive: true,
        },
        {
          id: "tour-2",
          organizationId: testOrgId,
          name: "Wreck Dive",
          type: "boat",
          price: "149.00",
          maxParticipants: 8,
          isActive: true,
        },
      ];

      (db.orderBy as any).mockResolvedValueOnce(mockTours);
      (db.groupBy as any).mockResolvedValueOnce([]);

      const result = await getTours(testOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Reef Dive");
      expect(result[1].name).toBe("Wreck Dive");
    });

    it("should filter tours by active status", async () => {
      const mockTours = [
        {
          id: "tour-1",
          organizationId: testOrgId,
          name: "Reef Dive",
          type: "boat",
          price: "99.00",
          maxParticipants: 10,
          isActive: true,
        },
      ];

      (db.orderBy as any).mockResolvedValueOnce(mockTours);
      (db.groupBy as any).mockResolvedValueOnce([]);

      const result = await getTours(testOrgId, { activeOnly: true });

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it("should filter tours by type", async () => {
      const mockTours = [
        {
          id: "tour-1",
          organizationId: testOrgId,
          name: "Shore Dive",
          type: "shore",
          price: "59.00",
          maxParticipants: 6,
          isActive: true,
        },
      ];

      (db.orderBy as any).mockResolvedValueOnce(mockTours);
      (db.groupBy as any).mockResolvedValueOnce([]);

      const result = await getTours(testOrgId, { type: "shore" });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("shore");
    });

    it("should filter tours by search term", async () => {
      const mockTours = [
        {
          id: "tour-1",
          organizationId: testOrgId,
          name: "Night Reef Dive",
          type: "boat",
          price: "129.00",
          maxParticipants: 8,
          isActive: true,
        },
      ];

      (db.orderBy as any).mockResolvedValueOnce(mockTours);
      (db.groupBy as any).mockResolvedValueOnce([]);

      const result = await getTours(testOrgId, { search: "Night" });

      expect(result).toHaveLength(1);
      expect(result[0].name).toContain("Night");
    });

    it("should return empty array when no tours match filters", async () => {
      (db.orderBy as any).mockResolvedValue([]);

      const result = await getTours(testOrgId, { search: "nonexistent" });

      expect(result).toHaveLength(0);
    });
  });

  describe("getAllTours", () => {
    it("should return only active tours with id and name", async () => {
      const mockTours = [
        { id: "tour-1", name: "Reef Dive" },
        { id: "tour-2", name: "Wreck Dive" },
      ];

      (db.orderBy as any).mockResolvedValue(mockTours);

      const result = await getAllTours(testOrgId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
    });
  });

  describe("getTourById", () => {
    it("should return tour when found", async () => {
      const mockTour = {
        id: "tour-123",
        organizationId: testOrgId,
        name: "Advanced Reef Dive",
        description: "Explore deep reefs",
        type: "boat",
        duration: 120,
        maxParticipants: 12,
        minParticipants: 4,
        price: "159.00",
        currency: "USD",
        includesEquipment: true,
        includesMeals: false,
        includesTransport: true,
        minCertLevel: "Advanced",
        minAge: 18,
        isActive: true,
      };

      (db.limit as any).mockResolvedValue([mockTour]);

      const result = await getTourById(testOrgId, "tour-123");

      expect(result).toBeDefined();
      expect(result?.name).toBe("Advanced Reef Dive");
      expect(result?.minCertLevel).toBe("Advanced");
    });

    it("should return null when tour not found", async () => {
      (db.limit as any).mockResolvedValue([]);

      const result = await getTourById(testOrgId, "nonexistent-id");

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Tour Creation Tests
  // ============================================================================

  describe("createTour", () => {
    it("should create tour with required fields", async () => {
      const newTour = {
        id: "tour-new",
        organizationId: testOrgId,
        name: "Basic Reef Dive",
        type: "boat",
        maxParticipants: 10,
        minParticipants: 1,
        price: "89.00",
        currency: "USD",
        includesEquipment: false,
        includesMeals: false,
        includesTransport: false,
        isActive: true,
      };

      (db.returning as any).mockResolvedValue([newTour]);

      const result = await createTour(testOrgId, {
        name: "Basic Reef Dive",
        type: "boat",
        maxParticipants: 10,
        price: 89.0,
      });

      expect(result.name).toBe("Basic Reef Dive");
      expect(result.type).toBe("boat");
      expect((db.insert as any)).toHaveBeenCalled();
    });

    it("should create tour with all optional fields", async () => {
      const fullTour = {
        id: "tour-full",
        organizationId: testOrgId,
        name: "Premium Dive Experience",
        description: "Full service dive with all amenities",
        type: "liveaboard",
        duration: 480,
        maxParticipants: 16,
        minParticipants: 8,
        price: "499.00",
        currency: "EUR",
        includesEquipment: true,
        includesMeals: true,
        includesTransport: true,
        minCertLevel: "Rescue Diver",
        minAge: 21,
        isActive: true,
      };

      (db.returning as any).mockResolvedValue([fullTour]);

      const result = await createTour(testOrgId, {
        name: "Premium Dive Experience",
        description: "Full service dive with all amenities",
        type: "liveaboard",
        duration: 480,
        maxParticipants: 16,
        minParticipants: 8,
        price: 499.0,
        currency: "EUR",
        includesEquipment: true,
        includesMeals: true,
        includesTransport: true,
        minCertLevel: "Rescue Diver",
        minAge: 21,
      });

      expect(result.description).toBe("Full service dive with all amenities");
      expect(result.currency).toBe("EUR");
      expect(result.minCertLevel).toBe("Rescue Diver");
    });

    it("should default minParticipants to 1 if not provided", async () => {
      const newTour = {
        id: "tour-new",
        organizationId: testOrgId,
        name: "Test Tour",
        type: "boat",
        maxParticipants: 10,
        minParticipants: 1,
        price: "99.00",
        currency: "USD",
      };

      (db.returning as any).mockResolvedValue([newTour]);

      const result = await createTour(testOrgId, {
        name: "Test Tour",
        type: "boat",
        maxParticipants: 10,
        price: 99.0,
      });

      expect(result.minParticipants).toBe(1);
    });

    it("should default currency to USD if not provided", async () => {
      const newTour = {
        id: "tour-new",
        organizationId: testOrgId,
        name: "Test Tour",
        type: "boat",
        maxParticipants: 10,
        price: "99.00",
        currency: "USD",
      };

      (db.returning as any).mockResolvedValue([newTour]);

      const result = await createTour(testOrgId, {
        name: "Test Tour",
        type: "boat",
        maxParticipants: 10,
        price: 99.0,
      });

      expect(result.currency).toBe("USD");
    });
  });

  // ============================================================================
  // Tour Status Management Tests
  // ============================================================================

  describe("updateTourActiveStatus", () => {
    it("should activate inactive tour", async () => {
      const updatedTour = {
        id: "tour-123",
        organizationId: testOrgId,
        name: "Test Tour",
        isActive: true,
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedTour]);

      const result = await updateTourActiveStatus(testOrgId, "tour-123", true);

      expect(result?.isActive).toBe(true);
      expect((db.update as any)).toHaveBeenCalled();
    });

    it("should deactivate active tour", async () => {
      const updatedTour = {
        id: "tour-123",
        organizationId: testOrgId,
        name: "Test Tour",
        isActive: false,
        is_active: false,  // Include snake_case for mapTour
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedTour]);

      const result = await updateTourActiveStatus(testOrgId, "tour-123", false);

      expect(result?.isActive).toBe(false);
    });

    it("should return null when tour not found", async () => {
      (db.returning as any).mockResolvedValue([]);

      const result = await updateTourActiveStatus(testOrgId, "nonexistent-id", true);

      expect(result).toBeNull();
    });
  });

  describe("deleteTour", () => {
    it("should delete tour and related trips", async () => {
      // Mock the count query chain to return 0 trips (allow deletion)
      let whereCallCount = 0;
      (db.where as any) = vi.fn().mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) {
          // First call: trip count check - return array with count
          return Promise.resolve([{ count: 0 }]);
        } else {
          // Subsequent calls: delete operations - return Promise
          return Promise.resolve(undefined);
        }
      });

      const result = await deleteTour(testOrgId, "tour-123");

      expect(result).toBe(true);
      expect((db.delete as any)).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Trip Creation Tests
  // ============================================================================

  describe("createTrip", () => {
    it("should create trip with required fields", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        status: "scheduled",
        isPublic: false,
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
      });

      expect(result.tourId).toBe("tour-123");
      expect(result.date).toBe("2026-02-15");
      expect(result.status).toBe("scheduled");
    });

    it("should create trip with boat assignment", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        boatId: "boat-456",
        date: "2026-02-15",
        startTime: "09:00:00",
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        boatId: "boat-456",
        date: "2026-02-15",
        startTime: "09:00:00",
      });

      expect(result.boatId).toBe("boat-456");
    });

    it("should create trip with custom max participants", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        maxParticipants: 8,
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        maxParticipants: 8,
      });

      expect(result.maxParticipants).toBe(8);
    });

    it("should create trip with custom price override", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        price: "79.00",
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        price: 79.0,
      });

      expect(result.price).toBe("79.00");
    });

    it("should create trip with end time", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        endTime: "13:00:00",
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        endTime: "13:00:00",
      });

      expect(result.endTime).toBe("13:00:00");
    });

    it("should create public trip when isPublic is true", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        isPublic: true,
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        isPublic: true,
      });

      expect(result.isPublic).toBe(true);
    });

    it("should create trip with notes", async () => {
      const newTrip = {
        id: "trip-new",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        notes: "Advanced divers only",
        status: "scheduled",
      };

      (db.returning as any).mockResolvedValue([newTrip]);

      const result = await createTrip(testOrgId, {
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        notes: "Advanced divers only",
      });

      expect(result.notes).toBe("Advanced divers only");
    });
  });

  // ============================================================================
  // Trip Status Management Tests
  // ============================================================================

  describe("updateTripStatus", () => {
    it("should update trip status to in_progress", async () => {
      const updatedTrip = {
        id: "trip-123",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        status: "in_progress",
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedTrip]);

      const result = await updateTripStatus(testOrgId, "trip-123", "in_progress");

      expect(result?.status).toBe("in_progress");
    });

    it("should update trip status to completed", async () => {
      const updatedTrip = {
        id: "trip-123",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        status: "completed",
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedTrip]);

      const result = await updateTripStatus(testOrgId, "trip-123", "completed");

      expect(result?.status).toBe("completed");
    });

    it("should update trip status to cancelled", async () => {
      const updatedTrip = {
        id: "trip-123",
        organizationId: testOrgId,
        tourId: "tour-123",
        date: "2026-02-15",
        startTime: "09:00:00",
        status: "cancelled",
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedTrip]);

      const result = await updateTripStatus(testOrgId, "trip-123", "cancelled");

      expect(result?.status).toBe("cancelled");
    });

    it("should return null when trip not found", async () => {
      (db.returning as any).mockResolvedValue([]);

      const result = await updateTripStatus(testOrgId, "nonexistent-id", "completed");

      expect(result).toBeNull();
    });
  });
});
