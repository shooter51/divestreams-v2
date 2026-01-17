/**
 * Tests for New Course Route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockRequireOrgContext = vi.fn();
const mockGetCertificationAgencies = vi.fn();
const mockGetCertificationLevels = vi.fn();
const mockCreateTrainingCourse = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getCertificationAgencies: mockGetCertificationAgencies,
  getCertificationLevels: mockGetCertificationLevels,
  createTrainingCourse: mockCreateTrainingCourse,
}));

// Mock react-router redirect
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url: string) => ({ redirect: url })),
  };
});

describe("New Course Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      isPremium: true,
    });
    mockGetCertificationAgencies.mockResolvedValue([
      { id: "agency-1", name: "PADI", code: "PADI" },
      { id: "agency-2", name: "SSI", code: "SSI" },
    ]);
    mockGetCertificationLevels.mockResolvedValue([
      {
        level: { id: "level-1", name: "Open Water Diver", code: "OW", agencyId: "agency-1" },
        agency: { id: "agency-1", name: "PADI" },
      },
      {
        level: { id: "level-2", name: "Advanced Open Water", code: "AOW", agencyId: "agency-1" },
        agency: { id: "agency-1", name: "PADI" },
      },
    ]);
    mockCreateTrainingCourse.mockResolvedValue({
      id: "course-123",
      name: "PADI Open Water",
    });
  });

  describe("loader", () => {
    it("returns agencies and levels for premium users", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/new");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.agencies).toHaveLength(2);
      expect(result.levels).toHaveLength(2);
    });

    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );
      const request = new Request("https://demo.divestreams.com/app/training/courses/new");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.agencies).toHaveLength(0);
      expect(result.levels).toHaveLength(0);
    });
  });

  describe("action", () => {
    it("creates a course with valid data", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );

      const formData = new FormData();
      formData.append("name", "PADI Open Water Diver");
      formData.append("description", "Learn to dive!");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("scheduleType", "fixed");
      formData.append("price", "599.00");
      formData.append("depositAmount", "100.00");
      formData.append("maxStudents", "6");
      formData.append("totalSessions", "5");
      formData.append("hasExam", "true");
      formData.append("examPassScore", "75");
      formData.append("minOpenWaterDives", "4");

      const request = new Request("https://demo.divestreams.com/app/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockCreateTrainingCourse).toHaveBeenCalledWith("org-1", {
        name: "PADI Open Water Diver",
        description: "Learn to dive!",
        agencyId: "agency-1",
        levelId: "level-1",
        scheduleType: "fixed",
        price: "599.00",
        depositAmount: "100.00",
        maxStudents: 6,
        totalSessions: 5,
        hasExam: true,
        examPassScore: 75,
        minOpenWaterDives: 4,
      });

      expect(result).toEqual({ redirect: "/app/training/courses/course-123" });
    });

    it("returns validation errors for missing required fields", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );

      const formData = new FormData();
      formData.append("name", "");
      formData.append("agencyId", "");
      formData.append("levelId", "");
      formData.append("price", "");

      const request = new Request("https://demo.divestreams.com/app/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.errors).toBeDefined();
      expect(result.errors.name).toBe("Course name is required");
      expect(result.errors.agencyId).toBe("Certification agency is required");
      expect(result.errors.levelId).toBe("Certification level is required");
      expect(result.errors.price).toBe("Valid price is required");
      expect(mockCreateTrainingCourse).not.toHaveBeenCalled();
    });

    it("returns error for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );

      const formData = new FormData();
      formData.append("name", "PADI Open Water");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("price", "599.00");

      const request = new Request("https://demo.divestreams.com/app/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.errors.general).toContain("premium feature");
      expect(mockCreateTrainingCourse).not.toHaveBeenCalled();
    });

    it("handles database errors gracefully", async () => {
      mockCreateTrainingCourse.mockRejectedValue(new Error("Database error"));

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/courses/new"
      );

      const formData = new FormData();
      formData.append("name", "PADI Open Water");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("price", "599.00");

      const request = new Request("https://demo.divestreams.com/app/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.errors.general).toContain("Failed to create course");
    });
  });
});
