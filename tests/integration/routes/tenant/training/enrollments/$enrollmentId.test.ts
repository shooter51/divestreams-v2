/**
 * Tests for Enrollment Detail Route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockRequireOrgContext = vi.fn();
const mockGetEnrollmentById = vi.fn();
const mockGetSkillCheckoffs = vi.fn();
const mockGetCourseSessions = vi.fn();
const mockUpdateEnrollmentStatus = vi.fn();
const mockUpdateEnrollmentPayment = vi.fn();
const mockGetStudentProgress = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getEnrollmentById: mockGetEnrollmentById,
  getSkillCheckoffs: mockGetSkillCheckoffs,
  getCourseSessions: mockGetCourseSessions,
  updateEnrollmentStatus: mockUpdateEnrollmentStatus,
  updateEnrollmentPayment: mockUpdateEnrollmentPayment,
  getStudentProgress: mockGetStudentProgress,
}));

describe("Enrollment Detail Route", () => {
  const mockEnrollment = {
    enrollment: {
      id: "enrollment-123",
      customerId: "customer-1",
      courseId: "course-1",
      status: "in_progress",
      enrolledAt: new Date("2024-01-01"),
      startedAt: new Date("2024-01-15"),
      totalPrice: "599.00",
      depositAmount: "100.00",
      balanceDue: "499.00",
      paymentStatus: "deposit_paid",
      depositPaidAt: new Date("2024-01-01"),
      examScore: null,
      examPassedAt: null,
      completedAt: null,
      certifiedAt: null,
      certificationNumber: null,
      instructorNotes: "Good progress so far.",
      createdAt: new Date("2024-01-01"),
    },
    customer: {
      id: "customer-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-1234",
      dateOfBirth: "1990-05-15",
      certifications: [{ agency: "PADI", level: "Open Water" }],
    },
    course: {
      id: "course-1",
      name: "PADI Advanced Open Water",
      totalSessions: 3,
      hasExam: true,
      examPassScore: 75,
      minOpenWaterDives: 5,
    },
    agency: { id: "agency-1", name: "PADI", code: "PADI" },
    level: { id: "level-1", name: "Advanced Open Water", code: "AOW" },
  };

  const mockSkillCheckoffs = [
    {
      id: "checkoff-1",
      skillName: "Navigation",
      skillCategory: "advanced",
      status: "demonstrated",
      checkedOffAt: new Date("2024-01-16"),
      notes: "Good underwater navigation skills",
    },
    {
      id: "checkoff-2",
      skillName: "Deep Dive",
      skillCategory: "advanced",
      status: "attempted",
      checkedOffAt: new Date("2024-01-17"),
      notes: null,
    },
  ];

  const mockSessions = [
    {
      session: {
        id: "session-1",
        sessionType: "classroom",
        scheduledDate: "2024-01-15",
        startTime: "09:00",
        location: "Classroom A",
        status: "completed",
      },
    },
    {
      session: {
        id: "session-2",
        sessionType: "open_water",
        scheduledDate: "2024-01-22",
        startTime: "08:00",
        location: "Blue Hole",
        status: "scheduled",
      },
    },
  ];

  const mockProgress = {
    progress: {
      total: 65,
      sessions: { completed: 1, total: 3 },
      skills: { demonstrated: 1, total: 2 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      user: { id: "user-1" },
      isPremium: true,
    });
    mockGetEnrollmentById.mockResolvedValue(mockEnrollment);
    mockGetSkillCheckoffs.mockResolvedValue(mockSkillCheckoffs);
    mockGetCourseSessions.mockResolvedValue(mockSessions);
    mockGetStudentProgress.mockResolvedValue(mockProgress);
    mockUpdateEnrollmentStatus.mockResolvedValue(undefined);
    mockUpdateEnrollmentPayment.mockResolvedValue(undefined);
  });

  describe("loader", () => {
    it("returns enrollment data with all related data for premium users", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );
      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123");
      const result = await loader({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.enrollment).toEqual(mockEnrollment);
      expect(result.skillCheckoffs).toEqual(mockSkillCheckoffs);
      expect(result.sessions).toEqual(mockSessions);
      expect(result.progress).toEqual(mockProgress.progress);
    });

    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );
      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123");
      const result = await loader({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.enrollment).toBe(null);
    });

    it("throws 404 when enrollment not found", async () => {
      mockGetEnrollmentById.mockResolvedValue(null);

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );
      const request = new Request("https://demo.divestreams.com/app/training/enrollments/nonexistent");

      await expect(
        loader({
          request,
          params: { enrollmentId: "nonexistent" },
          context: {},
        } as any)
      ).rejects.toThrow();
    });

    it("throws 400 when enrollmentId is missing", async () => {
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );
      const request = new Request("https://demo.divestreams.com/app/training/enrollments/");

      await expect(
        loader({
          request,
          params: {},
          context: {},
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("updates enrollment status", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "update-status");
      formData.append("status", "completed");
      formData.append("instructorNotes", "Student completed all requirements");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentStatus).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        "completed",
        expect.objectContaining({
          completedAt: expect.any(Date),
          instructorNotes: "Student completed all requirements",
        })
      );
      expect(result.statusUpdated).toBe(true);
    });

    it("records exam score", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "record-exam");
      formData.append("examScore", "85");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentStatus).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        "in_progress",
        expect.objectContaining({
          examScore: 85,
          examPassedAt: expect.any(Date),
        })
      );
      expect(result.examRecorded).toBe(true);
    });

    it("records payment and updates balance", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "record-payment");
      formData.append("paymentAmount", "250.00");
      formData.append("paymentType", "partial");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentPayment).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        expect.objectContaining({
          paymentStatus: expect.any(String),
          balanceDue: "249",
        })
      );
      expect(result.paymentRecorded).toBe(true);
    });

    it("records full payment and sets paid_in_full status", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "record-payment");
      formData.append("paymentAmount", "499.00");
      formData.append("paymentType", "full");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentPayment).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        expect.objectContaining({
          paymentStatus: "paid_in_full",
          balanceDue: "0",
        })
      );
      expect(result.paymentRecorded).toBe(true);
    });

    it("marks student as certified", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "mark-certified");
      formData.append("certificationNumber", "PADI-2024-12345");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentStatus).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        "certified",
        expect.objectContaining({
          certificationNumber: "PADI-2024-12345",
          certifiedAt: expect.any(Date),
          completedAt: expect.any(Date),
        })
      );
      expect(result.certified).toBe(true);
    });

    it("withdraws student from course", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "withdraw");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(mockUpdateEnrollmentStatus).toHaveBeenCalledWith(
        "org-1",
        "enrollment-123",
        "withdrawn"
      );
      expect(result.withdrawn).toBe(true);
    });

    it("returns null for unknown intent", async () => {
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/enrollments/$enrollmentId"
      );

      const formData = new FormData();
      formData.append("intent", "unknown-intent");

      const request = new Request("https://demo.divestreams.com/app/training/enrollments/enrollment-123", {
        method: "POST",
        body: formData,
      });

      const result = await action({
        request,
        params: { enrollmentId: "enrollment-123" },
        context: {},
      } as any);

      expect(result).toBe(null);
    });
  });
});
