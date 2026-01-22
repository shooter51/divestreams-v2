/**
 * Embed Course Enrollment Form Route Tests
 *
 * Tests the course enrollment form page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader, action } from "../../../../app/routes/embed/$tenant.courses.$courseId.enroll";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourseById: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  createWidgetEnrollment: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug, getPublicCourseById } from "../../../../lib/db/queries.public";
import { createWidgetEnrollment } from "../../../../lib/db/mutations.public";

describe("Route: embed/$tenant.courses.$courseId.enroll.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("meta", () => {
    it("should return meta title", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Complete Your Enrollment" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockCourse = {
      id: "course-456",
      name: "Open Water Diver",
      price: "499.00",
      currency: "USD",
      upcomingSessions: [
        {
          id: "session-789",
          startDate: "2024-02-15",
          endDate: "2024-02-17",
          availableSpots: 8,
        },
        {
          id: "session-abc",
          startDate: "2024-03-01",
          endDate: "2024-03-03",
          availableSpots: 10,
        },
      ],
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/courses/course-456/enroll?sessionId=session-789");

      // Act & Assert
      try {
        await loader({ request, params: { courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when courseId parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses//enroll?sessionId=session-789");

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent/courses/course-456/enroll?sessionId=session-789");
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "nonexistent", courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getOrganizationBySlug).toHaveBeenCalledWith("nonexistent");
    });

    it("should throw 404 when course not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/nonexistent/enroll?sessionId=session-789");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo", courseId: "nonexistent" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getPublicCourseById).toHaveBeenCalledWith("org-123", "nonexistent");
    });

    it("should throw 400 when sessionId parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(mockCourse);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when session not found in course", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll?sessionId=nonexistent");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(mockCourse);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return course and session data when all validations pass", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll?sessionId=session-789");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getPublicCourseById as any).mockResolvedValue(mockCourse);

      // Act
      const result = await loader({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getPublicCourseById).toHaveBeenCalledWith("org-123", "course-456");
      expect(result).toEqual({
        course: mockCourse,
        session: mockCourse.upcomingSessions[0],
        tenantSlug: "demo",
        organizationId: "org-123",
      });
    });
  });

  describe("action", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockEnrollment = {
      id: "enroll-xyz123",
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });

      // Act & Assert
      try {
        await action({ request, params: { courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when courseId parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses//enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });

      // Act & Assert
      try {
        await action({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/nonexistent/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await action({ request, params: { tenant: "nonexistent", courseId: "course-456" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return validation errors for missing required fields", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("firstName", "First name is required");
      expect(result.errors).toHaveProperty("lastName", "Last name is required");
      expect(result.errors).toHaveProperty("email", "Email is required");
    });

    it("should return validation error for invalid email", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "invalid-email",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("email", "Invalid email address");
    });

    it("should return validation error when sessionId is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "No training session selected");
    });

    it("should create enrollment and redirect on success", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          dateOfBirth: "1990-01-01",
          notes: "Previous diving experience",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (createWidgetEnrollment as any).mockResolvedValue(mockEnrollment);

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(createWidgetEnrollment).toHaveBeenCalledWith("org-123", {
        sessionId: "session-789",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        dateOfBirth: "1990-01-01",
        notes: "Previous diving experience",
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe(
        "/embed/demo/courses/confirm?enrollmentId=enroll-xyz123"
      );
    });

    it("should create enrollment without optional fields", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (createWidgetEnrollment as any).mockResolvedValue(mockEnrollment);

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(createWidgetEnrollment).toHaveBeenCalledWith("org-123", {
        sessionId: "session-789",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: undefined,
        dateOfBirth: undefined,
        notes: undefined,
      });
      expect(result.status).toBe(302);
    });

    it("should return error with message when enrollment creation fails with Error", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (createWidgetEnrollment as any).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "Database error");
      expect(console.error).toHaveBeenCalledWith("Enrollment creation failed:", expect.any(Error));
    });

    it("should return generic error when enrollment creation fails with non-Error", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/course-456/enroll", {
        method: "POST",
        body: new URLSearchParams({
          sessionId: "session-789",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }),
      });
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (createWidgetEnrollment as any).mockRejectedValue("String error");

      // Act
      const result = await action({ request, params: { tenant: "demo", courseId: "course-456" }, context: {} });

      // Assert
      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("form", "Failed to create enrollment. Please try again.");
    });
  });
});
