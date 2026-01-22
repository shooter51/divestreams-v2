/**
 * Embed Course Enrollment Confirmation Route Tests
 *
 * Tests the enrollment confirmation page for the embeddable booking widget.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { meta, loader } from "../../../../app/routes/embed/$tenant.courses.confirm";

// Mock modules
vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  getEnrollmentDetails: vi.fn(),
}));

// Import mocked modules
import { getOrganizationBySlug } from "../../../../lib/db/queries.public";
import { getEnrollmentDetails } from "../../../../lib/db/mutations.public";

describe("Route: embed/$tenant.courses.confirm.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return meta title", () => {
      // Act
      const result = meta({ data: {}, params: {}, location: {} as any, matches: [] });

      // Assert
      expect(result).toEqual([{ title: "Enrollment Confirmed - Thank You!" }]);
    });
  });

  describe("loader", () => {
    const mockOrg = { id: "org-123", name: "Demo Dive Shop", slug: "demo" };
    const mockEnrollment = {
      id: "enroll-xyz123",
      studentFirstName: "John",
      studentLastName: "Doe",
      studentEmail: "john@example.com",
      courseName: "Open Water Diver",
      sessionStartDate: "2024-02-15",
      sessionEndDate: "2024-02-17",
      sessionStartTime: "09:00",
      price: "499.00",
      currency: "USD",
      status: "confirmed",
      createdAt: "2024-01-15T10:00:00Z",
    };

    it("should throw 404 when tenant parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/courses/confirm?enrollmentId=enroll-xyz123");

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
      const request = new Request("http://test.com/embed/nonexistent/courses/confirm?enrollmentId=enroll-xyz123");
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

    it("should throw 400 when enrollmentId parameter is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/confirm");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it("should throw 404 when enrollment not found", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/confirm?enrollmentId=nonexistent");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getEnrollmentDetails as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: { tenant: "demo" }, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }

      expect(getEnrollmentDetails).toHaveBeenCalledWith("org-123", "nonexistent");
    });

    it("should return enrollment details when all validations pass", async () => {
      // Arrange
      const request = new Request("http://test.com/embed/demo/courses/confirm?enrollmentId=enroll-xyz123");
      (getOrganizationBySlug as any).mockResolvedValue(mockOrg);
      (getEnrollmentDetails as any).mockResolvedValue(mockEnrollment);

      // Act
      const result = await loader({ request, params: { tenant: "demo" }, context: {} });

      // Assert
      expect(getOrganizationBySlug).toHaveBeenCalledWith("demo");
      expect(getEnrollmentDetails).toHaveBeenCalledWith("org-123", "enroll-xyz123");
      expect(result).toEqual({
        enrollment: mockEnrollment,
        tenantSlug: "demo",
      });
    });
  });
});
