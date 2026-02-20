import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getSessionById: vi.fn(),
  createEnrollment: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(),
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
import { getSessionById, createEnrollment, getSessions } from "../../../../../lib/db/training.server";
import { getCustomers } from "../../../../../lib/db/queries.server";
import { loader, action } from "../../../../../app/routes/tenant/training/enrollments/new";

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

const mockSessionDetail = {
  id: "session-1",
  courseId: "course-1",
  courseName: "Open Water Diver",
  startDate: "2026-03-01",
  status: "scheduled",
  enrolledCount: 3,
  maxStudents: 8,
};

const mockSessions = [
  { id: "session-1", courseName: "Open Water Diver", startDate: "2026-03-01", startTime: "09:00", enrolledCount: 3, maxStudents: 8 },
  { id: "session-2", courseName: "Advanced Open Water", startDate: "2026-03-15", startTime: null, enrolledCount: 0, maxStudents: 6 },
];

const mockCustomers = [
  { id: "cust-1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
  { id: "cust-2", firstName: "John", lastName: "Smith", email: "john@example.com" },
];

describe("tenant/training/enrollments/new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getSessionById as Mock).mockResolvedValue(mockSessionDetail);
    (getSessions as Mock).mockResolvedValue(mockSessions);
    (getCustomers as Mock).mockResolvedValue({ customers: mockCustomers });
    (createEnrollment as Mock).mockResolvedValue({ id: "new-enroll-1" });
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    describe("with sessionId query param (pre-selected mode)", () => {
      it("returns session and customers", async () => {
        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new?sessionId=session-1");
        const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.session).toEqual(mockSessionDetail);
        expect(result.sessions).toBeNull();
        expect(result.customers).toEqual(mockCustomers);
        expect(result.mode).toBe("pre-selected");
      });

      it("fetches session by id", async () => {
        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new?sessionId=session-1");
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(getSessionById).toHaveBeenCalledWith("org-uuid", "session-1");
        expect(getSessions).not.toHaveBeenCalled();
      });

      it("throws 404 when session is not found", async () => {
        (getSessionById as Mock).mockResolvedValue(null);

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new?sessionId=non-existent");

        try {
          await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
          expect.fail("Should have thrown");
        } catch (error) {
          expect((error as Response).status).toBe(404);
        }
      });
    });

    describe("without sessionId query param (select-session mode)", () => {
      it("returns sessions and customers", async () => {
        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new");
        const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.session).toBeNull();
        expect(result.sessions).toEqual(mockSessions);
        expect(result.customers).toEqual(mockCustomers);
        expect(result.mode).toBe("select-session");
      });

      it("fetches all sessions instead of a specific session", async () => {
        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new");
        await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(getSessions).toHaveBeenCalledWith("org-uuid");
        expect(getSessionById).not.toHaveBeenCalled();
      });
    });
  });

  describe("action", () => {
    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("validates sessionId is required", async () => {
      const formData = new FormData();
      formData.append("customerId", "cust-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.sessionId).toBe("Session is required");
      expect(createEnrollment).not.toHaveBeenCalled();
    });

    it("validates customerId is required", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.customerId).toBe("Customer is required");
      expect(createEnrollment).not.toHaveBeenCalled();
    });

    it("returns both errors when both fields are missing", async () => {
      const formData = new FormData();

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.sessionId).toBe("Session is required");
      expect(result.errors.customerId).toBe("Customer is required");
    });

    it("validates amountPaid is not negative", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");
      formData.append("amountPaid", "-10");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.amountPaid).toBe("Amount cannot be negative");
      expect(createEnrollment).not.toHaveBeenCalled();
    });

    it("validates amountPaid must be at least $1 if greater than 0", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");
      formData.append("amountPaid", "0.50");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.amountPaid).toBe("Amount paid must be at least $1 (or $0 for free enrollment)");
    });

    it("validates amountPaid must be a valid number", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");
      formData.append("amountPaid", "abc");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.amountPaid).toBe("Amount must be a valid number");
    });

    it("creates enrollment with valid data and redirects", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");
      formData.append("paymentStatus", "paid");
      formData.append("amountPaid", "350");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createEnrollment).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        sessionId: "session-1",
        customerId: "cust-1",
        paymentStatus: "paid",
        amountPaid: "350",
      });
      expect((result as Response).status).toBe(302);
    });

    it("defaults paymentStatus to pending and amountPaid to 0.00", async () => {
      const formData = new FormData();
      formData.append("sessionId", "session-1");
      formData.append("customerId", "cust-1");

      const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createEnrollment).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        sessionId: "session-1",
        customerId: "cust-1",
        paymentStatus: "pending",
        amountPaid: "0.00",
      });
    });

    describe("error handling from createEnrollment", () => {
      it("handles already enrolled error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Customer is already enrolled in this session"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.form).toBe("This customer is already enrolled in this session");
      });

      it("handles session not found error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Session not found"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.form).toBe("Training session not found");
      });

      it("handles cancelled session error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Cannot enroll in a cancelled session"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.form).toBe("Cannot enroll in a cancelled session");
      });

      it("handles session full error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Session is full (8/8 enrolled)"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.form).toBe("Session is full (8/8 enrolled)");
      });

      it("handles customer not found error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Customer not found"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.customerId).toBe("Selected customer not found");
      });

      it("handles generic errors", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("Database connection failed"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.errors.form).toBe("Database connection failed");
      });

      it("preserves form values on error", async () => {
        (createEnrollment as Mock).mockRejectedValue(new Error("already enrolled"));

        const formData = new FormData();
        formData.append("sessionId", "session-1");
        formData.append("customerId", "cust-1");
        formData.append("paymentStatus", "paid");
        formData.append("amountPaid", "350");

        const request = new Request("https://demo.divestreams.com/tenant/training/enrollments/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        expect(result.values).toEqual({
          sessionId: "session-1",
          customerId: "cust-1",
          paymentStatus: "paid",
          amountPaid: "350",
        });
      });
    });
  });
});
