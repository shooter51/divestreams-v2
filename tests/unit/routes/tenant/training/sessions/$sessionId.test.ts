/**
 * Session Detail Route Tests
 *
 * Tests for the training session detail route.
 * These tests verify the route exports exist and handle errors properly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock session data
const mockSession = {
  session: {
    id: "session-123",
    organizationId: "org-1",
    courseId: "course-123",
    sessionType: "pool",
    sessionNumber: 1,
    scheduledDate: "2026-01-20",
    startTime: "09:00",
    endTime: "12:00",
    location: "Training Pool",
    status: "scheduled",
    maxStudents: 6,
    notes: "Bring swimsuit",
    instructorIds: ["instructor-1"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  course: {
    id: "course-123",
    name: "Open Water Diver",
    price: "599.99",
    totalSessions: 4,
  },
};

const mockEnrollments = [
  {
    enrollment: {
      id: "enrollment-1",
      status: "enrolled",
      enrolledAt: new Date().toISOString(),
    },
    course: { name: "Open Water Diver" },
    customer: {
      id: "customer-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    },
  },
];

const mockSkillCheckoffs = [
  {
    checkoff: {
      id: "checkoff-1",
      skillName: "Mask clearing",
      skillCategory: "basic",
      status: "demonstrated",
      notes: "Excellent performance",
    },
    enrollment: { id: "enrollment-1" },
    customer: { id: "customer-1", firstName: "John", lastName: "Doe" },
  },
];

// Set up mocks before imports
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getCourseSessionById: vi.fn(),
  getEnrollmentsForSession: vi.fn(),
  getSkillCheckoffsForSession: vi.fn(),
  updateCourseSession: vi.fn(),
  recordSkillCheckoff: vi.fn(),
  updateSkillCheckoff: vi.fn(),
  deleteCourseSession: vi.fn(),
}));

describe("Session Detail Route", () => {
  describe("module exports", () => {
    it("exports loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );
      expect(typeof module.loader).toBe("function");
    });

    it("exports action function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );
      expect(typeof module.action).toBe("function");
    });

    it("exports default component", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );
      expect(typeof module.default).toBe("function");
    });

    it("exports meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );
      expect(typeof module.meta).toBe("function");
    });
  });

  describe("loader error handling", () => {
    beforeEach(async () => {
      vi.resetModules();
    });

    it("throws 400 if sessionId is missing", async () => {
      // Import fresh modules with mocks
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1", name: "Test Shop" },
        user: { id: "user-1" },
        isPremium: true,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const request = new Request("https://demo.divestreams.com/app/training/sessions/");

      try {
        await loader({ request, params: {}, context: {} } as any);
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(400);
      }
    });

    it("throws 404 if session not found", async () => {
      // Import fresh modules with mocks
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { getCourseSessionById } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1", name: "Test Shop" },
        user: { id: "user-1" },
        isPremium: true,
      });
      (getCourseSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123");

      try {
        await loader({ request, params: { sessionId: "session-123" }, context: {} } as any);
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(404);
      }
    });
  });

  describe("loader data", () => {
    beforeEach(async () => {
      vi.resetModules();
    });

    it("returns hasAccess false for non-premium users", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1", name: "Test Shop" },
        user: { id: "user-1" },
        isPremium: false, // Non-premium
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123");
      const result = await loader({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.session).toBeNull();
      expect(result.enrolledStudents).toEqual([]);
      expect(result.skillCheckoffs).toEqual([]);
    });

    it("returns session data for premium users", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { getCourseSessionById, getEnrollmentsForSession, getSkillCheckoffsForSession } =
        await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1", name: "Test Shop" },
        user: { id: "user-1" },
        isPremium: true,
      });
      (getCourseSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      (getEnrollmentsForSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnrollments);
      (getSkillCheckoffsForSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSkillCheckoffs);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123");
      const result = await loader({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(result.enrolledStudents).toEqual(mockEnrollments);
      expect(result.skillCheckoffs).toEqual(mockSkillCheckoffs);
    });
  });

  describe("action handlers", () => {
    beforeEach(async () => {
      vi.resetModules();
    });

    it("handles update-status intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { updateCourseSession } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });
      (updateCourseSession as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "in_progress" });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "in_progress");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toEqual({ updated: true });
      expect(updateCourseSession).toHaveBeenCalledWith("org-1", "session-123", { status: "in_progress" });
    });

    it("handles cancel intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { updateCourseSession } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });
      (updateCourseSession as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "cancelled" });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "cancel");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toEqual({ cancelled: true });
      expect(updateCourseSession).toHaveBeenCalledWith("org-1", "session-123", { status: "cancelled" });
    });

    it("handles delete intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { deleteCourseSession } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });
      (deleteCourseSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "delete");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toEqual({ deleted: true });
      expect(deleteCourseSession).toHaveBeenCalledWith("org-1", "session-123");
    });

    it("handles record-checkoff intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { recordSkillCheckoff } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });
      (recordSkillCheckoff as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-checkoff" });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "record-checkoff");
      formData.append("enrollmentId", "enrollment-1");
      formData.append("skillName", "Mask clearing");
      formData.append("skillCategory", "basic");
      formData.append("status", "demonstrated");
      formData.append("notes", "Good job");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toEqual({ checkoffRecorded: true });
      expect(recordSkillCheckoff).toHaveBeenCalledWith("org-1", {
        enrollmentId: "enrollment-1",
        sessionId: "session-123",
        skillName: "Mask clearing",
        skillCategory: "basic",
        status: "demonstrated",
        instructorId: "user-1",
        notes: "Good job",
      });
    });

    it("handles update-checkoff intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");
      const { updateSkillCheckoff } = await import("../../../../../../lib/db/training.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });
      (updateSkillCheckoff as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "demonstrated" });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "update-checkoff");
      formData.append("checkoffId", "checkoff-1");
      formData.append("status", "demonstrated");
      formData.append("notes", "Updated notes");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toEqual({ checkoffUpdated: true });
      expect(updateSkillCheckoff).toHaveBeenCalledWith("org-1", "checkoff-1", {
        status: "demonstrated",
        instructorId: "user-1",
        notes: "Updated notes",
      });
    });

    it("returns null for unknown intent", async () => {
      const { requireOrgContext } = await import("../../../../../../lib/auth/org-context.server");

      (requireOrgContext as ReturnType<typeof vi.fn>).mockResolvedValue({
        org: { id: "org-1" },
        user: { id: "user-1" },
      });

      const { action } = await import(
        "../../../../../../app/routes/tenant/training/sessions/$sessionId"
      );

      const formData = new FormData();
      formData.append("intent", "unknown-intent");

      const request = new Request("https://demo.divestreams.com/app/training/sessions/session-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { sessionId: "session-123" }, context: {} } as any);

      expect(result).toBeNull();
    });
  });
});
