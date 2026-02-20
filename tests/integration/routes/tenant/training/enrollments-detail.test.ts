import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getEnrollmentById: vi.fn(),
  updateEnrollment: vi.fn(),
  deleteEnrollment: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path, msg, type) => `${path}?notification=${encodeURIComponent(msg)}&type=${type}`),
  useNotification: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } })),
  };
});

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
} from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/enrollments/$id";

const mockOrgContext = {
  user: { id: "user-1", name: "Test User", email: "test@example.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  subscription: null,
  limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
  usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
  canAddCustomer: true,
  canAddTour: true,
  canAddBooking: true,
  isPremium: false,
};

const mockEnrollment = {
  id: "enroll-1",
  customerId: "cust-1",
  customerFirstName: "Jane",
  customerLastName: "Doe",
  customerEmail: "jane@example.com",
  customerPhone: "555-1234",
  courseId: "course-1",
  courseName: "Open Water Diver",
  agencyName: "PADI",
  levelName: "Beginner",
  coursePrice: "350.00",
  sessionStartDate: new Date("2026-03-01"),
  sessionEndDate: new Date("2026-03-03"),
  sessionLocation: "Dive Center",
  sessionInstructor: "John Smith",
  status: "enrolled",
  paymentStatus: "pending",
  amountPaid: "0.00",
  certificationNumber: null,
  certificationDate: null,
  enrolledAt: new Date("2026-02-15T10:00:00Z"),
  completedAt: null,
  progress: null,
  skillCheckoffs: null,
  notes: "Great student",
  createdAt: new Date("2026-02-15T10:00:00Z"),
  updatedAt: new Date("2026-02-15T10:00:00Z"),
};

describe("tenant/training/enrollments/$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getEnrollmentById as Mock).mockResolvedValue(mockEnrollment);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1");
      await loader({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 400 when enrollment ID is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/");

      try {
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when enrollment is not found", async () => {
      (getEnrollmentById as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/non-existent");

      try {
        await loader({ request, params: { id: "non-existent" }, context: {}, unstable_pattern: "" } as unknown);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns enrollment with formatted dates", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1");
      const result = await loader({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.enrollment.id).toBe("enroll-1");
      // Date objects should be formatted as ISO date strings
      expect(result.enrollment.enrolledAt).toBe("2026-02-15");
      expect(result.enrollment.sessionStartDate).toBe("2026-03-01");
      expect(result.enrollment.sessionEndDate).toBe("2026-03-03");
      expect(result.enrollment.createdAt).toBe("2026-02-15");
      expect(result.enrollment.updatedAt).toBe("2026-02-15");
      // Null dates remain null
      expect(result.enrollment.completedAt).toBeNull();
      expect(result.enrollment.certificationDate).toBeNull();
    });

    it("handles string dates that are already formatted", async () => {
      const enrollmentWithStrings = {
        ...mockEnrollment,
        enrolledAt: "2026-02-15",
        sessionStartDate: "2026-03-01",
        sessionEndDate: "2026-03-03",
        createdAt: "2026-02-15",
        updatedAt: "2026-02-15",
      };
      (getEnrollmentById as Mock).mockResolvedValue(enrollmentWithStrings);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1");
      const result = await loader({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.enrollment.enrolledAt).toBe("2026-02-15");
      expect(result.enrollment.sessionStartDate).toBe("2026-03-01");
    });

    it("returns enrollment with progress and skillCheckoffs parsed", async () => {
      const enrollmentWithProgress = {
        ...mockEnrollment,
        progress: { classroomComplete: true, poolComplete: false, openWaterDivesCompleted: 2 },
        skillCheckoffs: [{ skill: "Mask Clearing", completedAt: "2026-03-02T10:00:00Z", signedOffBy: "John Smith" }],
      };
      (getEnrollmentById as Mock).mockResolvedValue(enrollmentWithProgress);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1");
      const result = await loader({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result.enrollment.progress).toEqual({
        classroomComplete: true,
        poolComplete: false,
        openWaterDivesCompleted: 2,
      });
      expect(result.enrollment.skillCheckoffs).toHaveLength(1);
      expect(result.enrollment.skillCheckoffs[0].skill).toBe("Mask Clearing");
    });
  });

  describe("action", () => {
    describe("update-status intent", () => {
      it("updates enrollment status", async () => {
        const formData = new FormData();
        formData.append("intent", "update-status");
        formData.append("status", "in_progress");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          status: "in_progress",
          completedAt: null,
        });
        expect((result as Response).status).toBe(302);
      });

      it("sets completedAt when status is completed", async () => {
        const formData = new FormData();
        formData.append("intent", "update-status");
        formData.append("status", "completed");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          status: "completed",
          completedAt: expect.any(Date),
        });
      });
    });

    describe("update-payment intent", () => {
      it("updates payment status and amount", async () => {
        const formData = new FormData();
        formData.append("intent", "update-payment");
        formData.append("paymentStatus", "paid");
        formData.append("amountPaid", "350.00");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          paymentStatus: "paid",
          amountPaid: "350.00",
        });
        expect((result as Response).status).toBe(302);
      });
    });

    describe("update-progress intent", () => {
      it("updates progress fields", async () => {
        const formData = new FormData();
        formData.append("intent", "update-progress");
        formData.append("classroomComplete", "true");
        formData.append("poolComplete", "true");
        formData.append("openWaterDivesCompleted", "4");
        formData.append("quizScore", "85");
        formData.append("finalExamScore", "90");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          progress: {
            classroomComplete: true,
            poolComplete: true,
            openWaterDivesCompleted: 4,
            quizScore: 85,
            finalExamScore: 90,
          },
        });
        expect((result as Response).status).toBe(302);
      });

      it("handles unchecked checkboxes as false", async () => {
        const formData = new FormData();
        formData.append("intent", "update-progress");
        formData.append("openWaterDivesCompleted", "0");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          progress: {
            classroomComplete: false,
            poolComplete: false,
            openWaterDivesCompleted: 0,
            quizScore: undefined,
            finalExamScore: undefined,
          },
        });
      });
    });

    describe("add-skill-checkoff intent", () => {
      it("adds a skill checkoff to existing list", async () => {
        const existingEnrollment = {
          ...mockEnrollment,
          skillCheckoffs: [{ skill: "Mask Clearing", completedAt: "2026-03-02T10:00:00Z", signedOffBy: "John Smith" }],
        };
        (getEnrollmentById as Mock).mockResolvedValue(existingEnrollment);

        const formData = new FormData();
        formData.append("intent", "add-skill-checkoff");
        formData.append("skill", "Buoyancy Control");
        formData.append("signedOffBy", "Jane Instructor");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          skillCheckoffs: [
            { skill: "Mask Clearing", completedAt: "2026-03-02T10:00:00Z", signedOffBy: "John Smith" },
            { skill: "Buoyancy Control", completedAt: expect.any(String), signedOffBy: "Jane Instructor" },
          ],
        });
        expect((result as Response).status).toBe(302);
      });

      it("returns error when skill is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "add-skill-checkoff");
        formData.append("signedOffBy", "Jane Instructor");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(result).toEqual({ error: "Skill name and instructor are required" });
        expect(updateEnrollment).not.toHaveBeenCalled();
      });

      it("returns error when signedOffBy is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "add-skill-checkoff");
        formData.append("skill", "Buoyancy Control");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(result).toEqual({ error: "Skill name and instructor are required" });
        expect(updateEnrollment).not.toHaveBeenCalled();
      });

      it("creates first checkoff when none exist", async () => {
        (getEnrollmentById as Mock).mockResolvedValue({ ...mockEnrollment, skillCheckoffs: null });

        const formData = new FormData();
        formData.append("intent", "add-skill-checkoff");
        formData.append("skill", "Mask Clearing");
        formData.append("signedOffBy", "John Smith");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          skillCheckoffs: [
            { skill: "Mask Clearing", completedAt: expect.any(String), signedOffBy: "John Smith" },
          ],
        });
      });
    });

    describe("issue-certification intent", () => {
      it("issues certification and marks as completed", async () => {
        const formData = new FormData();
        formData.append("intent", "issue-certification");
        formData.append("certificationNumber", "PADI-123456");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          status: "completed",
          completedAt: expect.any(Date),
          certificationNumber: "PADI-123456",
          certificationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
        expect((result as Response).status).toBe(302);
      });

      it("returns error when certificationNumber is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "issue-certification");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(result).toEqual({ error: "Certification number is required" });
        expect(updateEnrollment).not.toHaveBeenCalled();
      });
    });

    describe("update-notes intent", () => {
      it("updates enrollment notes", async () => {
        const formData = new FormData();
        formData.append("intent", "update-notes");
        formData.append("notes", "Updated student notes");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(updateEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1", {
          notes: "Updated student notes",
        });
        expect((result as Response).status).toBe(302);
      });
    });

    describe("delete intent", () => {
      it("deletes enrollment and redirects to enrollments list", async () => {
        const formData = new FormData();
        formData.append("intent", "delete");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

        expect(deleteEnrollment).toHaveBeenCalledWith("org-uuid", "enroll-1");
        expect((result as Response).status).toBe(302);
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/enroll-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "enroll-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });
  });
});
