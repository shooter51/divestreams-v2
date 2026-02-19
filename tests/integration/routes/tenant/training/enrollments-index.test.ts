import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getEnrollments: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(),
  useNotification: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getEnrollments, getSessions } from "../../../../../lib/db/training.server";
import { loader } from "../../../../../app/routes/tenant/training/enrollments/index";

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

describe("tenant/training/enrollments/index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getEnrollments as Mock).mockResolvedValue([]);
    (getSessions as Mock).mockResolvedValue([]);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns enrollments transformed to UI format", async () => {
      const mockEnrollments = [
        {
          id: "enroll-1",
          customerId: "cust-1",
          customerFirstName: "Jane",
          customerLastName: "Doe",
          customerEmail: "jane@example.com",
          courseName: "Open Water Diver",
          agencyName: "PADI",
          levelName: "Beginner",
          sessionStartDate: "2026-03-01",
          status: "enrolled",
          paymentStatus: "paid",
          amountPaid: "350.00",
          certificationNumber: null,
          certificationDate: null,
          enrolledAt: "2026-02-15T10:00:00Z",
          completedAt: null,
        },
      ];
      (getEnrollments as Mock).mockResolvedValue(mockEnrollments);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.enrollments).toHaveLength(1);
      expect(result.enrollments[0]).toMatchObject({
        id: "enroll-1",
        student: {
          id: "cust-1",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
        },
        course: {
          name: "Open Water Diver",
          agencyName: "PADI",
          levelName: "Beginner",
        },
        sessionDate: "2026-03-01",
        status: "enrolled",
        paymentStatus: "paid",
        amountPaid: "350.00",
        certificationNumber: null,
        certificationDate: null,
      });
      expect(result.total).toBe(1);
    });

    it("returns sessions for filter dropdown", async () => {
      const mockSessions = [
        { id: "session-1", courseName: "Open Water Diver", startDate: "2026-03-01" },
      ];
      (getSessions as Mock).mockResolvedValue(mockSessions);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.sessions).toEqual(mockSessions);
      expect(getSessions).toHaveBeenCalledWith("org-uuid");
    });

    it("filters by status query param", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments?status=completed");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getEnrollments).toHaveBeenCalledWith("org-uuid", {
        status: "completed",
        sessionId: undefined,
      });
      expect(result.status).toBe("completed");
    });

    it("filters by sessionId query param", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments?sessionId=session-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getEnrollments).toHaveBeenCalledWith("org-uuid", {
        status: undefined,
        sessionId: "session-1",
      });
      expect(result.sessionId).toBe("session-1");
    });

    it("passes both filters when both are provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments?status=enrolled&sessionId=session-1");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(getEnrollments).toHaveBeenCalledWith("org-uuid", {
        status: "enrolled",
        sessionId: "session-1",
      });
    });

    it("calculates stats correctly", async () => {
      const mockEnrollments = [
        { id: "e-1", status: "enrolled", certificationNumber: null, customerId: "c1", customerFirstName: "A", customerLastName: "B", customerEmail: "a@b.com", courseName: "OW", agencyName: "", levelName: "", sessionStartDate: "2026-03-01", paymentStatus: "pending", amountPaid: "0", certificationDate: null, enrolledAt: "2026-02-01T00:00:00Z", completedAt: null },
        { id: "e-2", status: "enrolled", certificationNumber: null, customerId: "c2", customerFirstName: "C", customerLastName: "D", customerEmail: "c@d.com", courseName: "OW", agencyName: "", levelName: "", sessionStartDate: "2026-03-01", paymentStatus: "pending", amountPaid: "0", certificationDate: null, enrolledAt: "2026-02-01T00:00:00Z", completedAt: null },
        { id: "e-3", status: "in_progress", certificationNumber: null, customerId: "c3", customerFirstName: "E", customerLastName: "F", customerEmail: "e@f.com", courseName: "OW", agencyName: "", levelName: "", sessionStartDate: "2026-03-01", paymentStatus: "partial", amountPaid: "100", certificationDate: null, enrolledAt: "2026-02-01T00:00:00Z", completedAt: null },
        { id: "e-4", status: "completed", certificationNumber: "PADI-001", customerId: "c4", customerFirstName: "G", customerLastName: "H", customerEmail: "g@h.com", courseName: "OW", agencyName: "", levelName: "", sessionStartDate: "2026-03-01", paymentStatus: "paid", amountPaid: "350", certificationDate: "2026-03-05", enrolledAt: "2026-02-01T00:00:00Z", completedAt: "2026-03-05T00:00:00Z" },
        { id: "e-5", status: "completed", certificationNumber: null, customerId: "c5", customerFirstName: "I", customerLastName: "J", customerEmail: "i@j.com", courseName: "OW", agencyName: "", levelName: "", sessionStartDate: "2026-03-01", paymentStatus: "paid", amountPaid: "350", certificationDate: null, enrolledAt: "2026-02-01T00:00:00Z", completedAt: "2026-03-05T00:00:00Z" },
      ];
      (getEnrollments as Mock).mockResolvedValue(mockEnrollments);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.stats).toEqual({
        enrolled: 2,
        inProgress: 1,
        completed: 2,
        certified: 1,
      });
      expect(result.total).toBe(5);
    });

    it("returns zero stats when no enrollments", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.stats).toEqual({
        enrolled: 0,
        inProgress: 0,
        completed: 0,
        certified: 0,
      });
    });

    it("handles enrollments with missing optional fields gracefully", async () => {
      const mockEnrollments = [
        {
          id: "e-1",
          customerId: "c1",
          customerFirstName: null,
          customerLastName: null,
          customerEmail: null,
          courseName: null,
          agencyName: null,
          levelName: null,
          sessionStartDate: null,
          status: "enrolled",
          paymentStatus: null,
          amountPaid: null,
          certificationNumber: null,
          certificationDate: null,
          enrolledAt: null,
          completedAt: null,
        },
      ];
      (getEnrollments as Mock).mockResolvedValue(mockEnrollments);

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.enrollments[0]).toMatchObject({
        student: {
          id: "c1",
          firstName: "",
          lastName: "",
          email: "",
        },
        course: {
          name: "Unknown Course",
          agencyName: "",
          levelName: "",
        },
        sessionDate: "",
        amountPaid: "0.00",
        enrolledAt: "",
        completedAt: null,
      });
    });
  });
});
