/**
 * Embed Course Details Route Tests
 *
 * Tests the course details page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant.courses.$courseId";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourseById: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicCourseById } from "../../../../lib/db/queries.public";

describe("Route: embed/$tenant.courses.$courseId.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return title with course name when course data is available", () => {
      // Arrange
      const data = {
        course: {
          id: "course-456",
          name: "Open Water Diver",
          price: "499.00",
          currency: "USD",
        },
        tenantSlug: "demo",
      };

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Open Water Diver - Enroll Now" }]);
    });

    it("should return default title when course data is not available", () => {
      // Arrange
      const data = undefined;

      // Act
      const result = meta({ data, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Course Details" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockCourse = {
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
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange & Act & Assert
      try {
        await loader({ request: new Request("http://test.com"), params: { courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when courseId parameter is missing", async () => {
      // Arrange & Act & Assert
      try {
        await loader({ request: new Request("http://test.com"), params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({
          request: new Request("http://test.com"),
          params: { tenant: "nonexistent", courseId: "course-456" },
          context: {},
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should throw 404 when course not found", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({
          request: new Request("http://test.com"),
          params: { tenant: "demo", courseId: "nonexistent" },
          context: {},
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getPublicCourseById).toHaveBeenCalledWith("org-123", "nonexistent");
    });

    it("should return course details when all validations pass", async () => {
      // Arrange
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(mockCourse);

      // Act
      const result = await loader({
        request: new Request("http://test.com"),
        params: { tenant: "demo", courseId: "course-456" },
        context: {},
      });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicCourseById).toHaveBeenCalledWith("org-123", "course-456");
      expect(result).toEqual({
        course: mockCourse,
        tenantSlug: "demo",
      });
    });
  });
});
