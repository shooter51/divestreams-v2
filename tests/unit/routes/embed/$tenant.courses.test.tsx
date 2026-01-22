/**
 * Embed Course Listing Route Tests
 *
 * Tests the course listing page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant.courses";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourses: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicCourses } from "../../../../lib/db/queries.public";

describe("Route: embed/$tenant.courses.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return meta title", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Training Courses" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockCourses = [
      {
        id: "course-456",
        name: "Open Water Diver",
        description: "Beginner scuba diving certification course",
        price: "499.00",
        currency: "USD",
        classroomHours: 8,
        poolHours: 12,
        openWaterDives: 4,
        minAge: 10,
        prerequisites: "Basic swimming ability",
        certification: "PADI Open Water Diver",
        upcomingSessions: [
          {
            id: "session-789",
            startDate: "2024-02-15",
            endDate: "2024-02-17",
            startTime: "09:00",
            availableSpots: 8,
            totalSpots: 10,
          },
        ],
      },
      {
        id: "course-789",
        name: "Advanced Open Water",
        description: "Advanced diving techniques and specialties",
        price: "599.00",
        currency: "USD",
        classroomHours: 4,
        poolHours: 6,
        openWaterDives: 5,
        minAge: 15,
        prerequisites: "Open Water Diver certification",
        certification: "PADI Advanced Open Water Diver",
        upcomingSessions: [
          {
            id: "session-abc",
            startDate: "2024-03-01",
            endDate: "2024-03-03",
            startTime: "10:00",
            availableSpots: 6,
            totalSpots: 8,
          },
        ],
      },
    ];

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/courses");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent/courses");
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "nonexistent" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should return courses when organization found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourses as any).mockResolvedValue(mockCourses);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicCourses).toHaveBeenCalledWith("org-123");
      expect(result).toEqual({ courses: mockCourses });
    });

    it("should return empty courses array when no courses available", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourses as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(result).toEqual({ courses: [] });
    });
  });
});
