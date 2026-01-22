/**
 * Site Index (Homepage) Route Tests
 *
 * Tests the homepage loader with featured trips, courses, and tour images.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all imports before importing loader
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
  },
}));

vi.mock("../../../../lib/db/schema", () => ({
  images: {
    entityId: "entityId",
    url: "url",
    organizationId: "organizationId",
    entityType: "entityType",
    isPrimary: "isPrimary",
  },
}));

vi.mock("../../../../lib/db/public-site.server", () => ({
  getPublicTrips: vi.fn(),
  getPublicCourses: vi.fn(),
}));

describe("Route: site/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
  };

  const mockTripsResult = {
    trips: [
      {
        id: "trip-1",
        date: "2024-06-01",
        startTime: "09:00",
        price: "150.00",
        tour: {
          id: "tour-1",
          name: "Beginner Dive",
          description: "Perfect for first-time divers",
          type: "dive",
          duration: 120,
          price: "150.00",
          currency: "USD",
        },
      },
      {
        id: "trip-2",
        date: "2024-06-02",
        startTime: "14:00",
        price: null,
        tour: {
          id: "tour-2",
          name: "Advanced Wreck Dive",
          description: "Explore sunken ships",
          type: "dive",
          duration: 180,
          price: "200.00",
          currency: "USD",
        },
      },
    ],
    totalPages: 10,
    totalCount: 40,
  };

  const mockCoursesResult = {
    courses: [
      {
        id: "course-1",
        name: "Open Water Certification",
        description: "Get your diving license",
        price: "450.00",
        duration: 48,
      },
      {
        id: "course-2",
        name: "Advanced Open Water",
        description: "Take your skills to the next level",
        price: "350.00",
        duration: 24,
      },
    ],
    totalPages: 5,
    totalCount: 20,
  };

  const mockTourImages = [
    {
      tourId: "tour-1",
      url: "https://example.com/tour1.jpg",
    },
    {
      tourId: "tour-2",
      url: "https://example.com/tour2.jpg",
    },
  ];

  describe("loader", () => {
    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      // Dynamic import mock
      const { db } = await import("../../../../lib/db");
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

      // Import loader after mocks are set up
      const { loader } = await import("../../../../app/routes/site/index");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should load featured trips and courses with images", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      // Mock db.select to handle both queries
      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        if (selectCallCount === 1) {
          // First call: organization query
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            limit: mockLimit,
          });
          mockLimit.mockResolvedValue([mockOrganization]);
        } else if (selectCallCount === 2) {
          // Second call: tour images query
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockTourImages);
        }

        return {
          from: mockFrom,
        };
      });

      (getPublicTrips as any).mockResolvedValue(mockTripsResult);
      (getPublicCourses as any).mockResolvedValue(mockCoursesResult);

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicTrips).toHaveBeenCalledWith("org-123", { limit: 4, page: 1 });
      expect(getPublicCourses).toHaveBeenCalledWith("org-123", { limit: 4, page: 1 });

      expect(result.featuredTrips).toHaveLength(2);
      expect(result.featuredTrips[0]).toEqual({
        id: "trip-1",
        date: "2024-06-01",
        startTime: "09:00",
        price: "150.00",
        primaryImage: "https://example.com/tour1.jpg",
        tour: mockTripsResult.trips[0].tour,
      });
      expect(result.featuredTrips[1]).toEqual({
        id: "trip-2",
        date: "2024-06-02",
        startTime: "14:00",
        price: null,
        primaryImage: "https://example.com/tour2.jpg",
        tour: mockTripsResult.trips[1].tour,
      });

      expect(result.featuredCourses).toHaveLength(2);
      expect(result.featuredCourses[0]).toEqual({
        id: "course-1",
        name: "Open Water Certification",
        description: "Get your diving license",
        price: "450.00",
        duration: 48,
      });
      expect(result.featuredCourses[1]).toEqual({
        id: "course-2",
        name: "Advanced Open Water",
        description: "Take your skills to the next level",
        price: "350.00",
        duration: 24,
      });
    });

    it("should handle trips without tour images", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            limit: mockLimit,
          });
          mockLimit.mockResolvedValue([mockOrganization]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue([]); // No images
        }

        return {
          from: mockFrom,
        };
      });

      (getPublicTrips as any).mockResolvedValue(mockTripsResult);
      (getPublicCourses as any).mockResolvedValue(mockCoursesResult);

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.featuredTrips[0].primaryImage).toBeNull();
      expect(result.featuredTrips[1].primaryImage).toBeNull();
    });

    it("should handle empty trips result", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      let callCount = 0;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockOrganization]);
        // No second call for images because tripIds is empty
        return Promise.resolve([]);
      });

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      (getPublicTrips as any).mockResolvedValue({ trips: [], totalPages: 0, totalCount: 0 });
      (getPublicCourses as any).mockResolvedValue(mockCoursesResult);

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.featuredTrips).toEqual([]);
      expect(result.featuredCourses).toHaveLength(2);
    });

    it("should handle empty courses result", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => {
        selectCallCount++;

        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        if (selectCallCount === 1) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockReturnValue({
            limit: mockLimit,
          });
          mockLimit.mockResolvedValue([mockOrganization]);
        } else if (selectCallCount === 2) {
          mockFrom.mockReturnValue({
            where: mockWhere,
          });
          mockWhere.mockResolvedValue(mockTourImages);
        }

        return {
          from: mockFrom,
        };
      });

      (getPublicTrips as any).mockResolvedValue(mockTripsResult);
      (getPublicCourses as any).mockResolvedValue({ courses: [], totalPages: 0, totalCount: 0 });

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.featuredTrips).toHaveLength(2);
      expect(result.featuredCourses).toEqual([]);
    });

    it("should handle trips without tour reference", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      const tripsWithoutTour = {
        trips: [
          {
            id: "trip-orphan",
            date: "2024-06-01",
            startTime: "09:00",
            price: "150.00",
            tour: null,
          },
        ],
        totalPages: 1,
        totalCount: 1,
      };

      let callCount = 0;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockOrganization]);
        // No second call because tripIds will be empty after filter
        return Promise.resolve([]);
      });

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      (getPublicTrips as any).mockResolvedValue(tripsWithoutTour);
      (getPublicCourses as any).mockResolvedValue(mockCoursesResult);

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.featuredTrips[0]).toEqual({
        id: "trip-orphan",
        date: "2024-06-01",
        startTime: "09:00",
        price: "150.00",
        primaryImage: null,
        tour: null,
      });
    });

    it("should resolve organization by subdomain", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site");

      const { db } = await import("../../../../lib/db");
      const { getPublicTrips, getPublicCourses } = await import("../../../../lib/db/public-site.server");

      let callCount = 0;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([mockOrganization]);
        if (callCount === 2) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      (getPublicTrips as any).mockResolvedValue({ trips: [], totalPages: 0, totalCount: 0 });
      (getPublicCourses as any).mockResolvedValue({ courses: [], totalPages: 0, totalCount: 0 });

      const { loader } = await import("../../../../app/routes/site/index");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeDefined();
      expect(result.featuredTrips).toEqual([]);
      expect(result.featuredCourses).toEqual([]);
    });
  });
});
