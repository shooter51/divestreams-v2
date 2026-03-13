import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getSeriesById: vi.fn(),
  getEnrollments: vi.fn(),
  updateSeries: vi.fn(),
  deleteSeries: vi.fn(),
  addSessionToSeries: vi.fn(),
  removeSessionFromSeries: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(
    (path, msg, type) => `${path}?notification=${encodeURIComponent(msg)}&type=${type}`
  ),
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
  getSeriesById,
  getEnrollments,
  updateSeries,
  deleteSeries,
} from "../../../../../lib/db/training.server";
import { loader, action } from "../../../../../app/routes/tenant/training/series/$id";

const mockOrgContext = {
  user: { id: "user-1", name: "Test User", email: "test@example.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  subscription: null,
  limits: {},
  usage: {},
  canAddCustomer: true,
  canAddTour: true,
  canAddBooking: true,
  isPremium: false,
};

const mockSeries = {
  id: "series-1",
  name: "Open Water Spring 2026",
  courseId: "course-1",
  courseName: "Open Water Diver",
  status: "active",
  maxStudents: 8,
  priceOverride: null,
  instructorName: null,
  notes: null,
  sessions: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mockEnrollments = [
  {
    id: "enrollment-1",
    seriesId: "series-1",
    sessionId: "session-1",
    customerId: "customer-1",
    status: "enrolled",
    amountPaid: null,
    paymentStatus: "pending",
  },
];

describe("tenant/training/series/$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getSeriesById as Mock).mockResolvedValue(mockSeries);
    (getEnrollments as Mock).mockResolvedValue(mockEnrollments);
    (updateSeries as Mock).mockResolvedValue({ ...mockSeries, status: "completed" });
    (deleteSeries as Mock).mockResolvedValue(undefined);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/series-1");
      await loader({ request, params: { id: "series-1" }, context: {}, unstable_pattern: "" } as unknown);
      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns series and enrollments", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/series-1");
      const result = await loader({ request, params: { id: "series-1" }, context: {}, unstable_pattern: "" } as unknown);
      expect(result.series).toEqual(mockSeries);
      expect(result.enrollments).toEqual(mockEnrollments);
      expect(getSeriesById).toHaveBeenCalledWith("org-uuid", "series-1");
      expect(getEnrollments).toHaveBeenCalledWith("org-uuid", { seriesId: "series-1" });
    });

    it("throws 404 when series not found", async () => {
      (getSeriesById as Mock).mockResolvedValue(undefined);
      const request = new Request("https://demo.divestreams.com/tenant/training/series/nonexistent");

      await expect(
        loader({ request, params: { id: "nonexistent" }, context: {}, unstable_pattern: "" } as unknown)
      ).rejects.toThrow();
    });

    it("throws 400 when no series ID provided", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series/");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown)
      ).rejects.toThrow();
    });
  });

  describe("action", () => {
    it("handles delete-series intent", async () => {
      const formData = new FormData();
      formData.append("intent", "delete-series");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/series-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "series-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(deleteSeries).toHaveBeenCalledWith("org-uuid", "series-1");
      expect((result as Response).status).toBe(302);
    });

    it("handles update-series intent", async () => {
      const formData = new FormData();
      formData.append("intent", "update-series");
      formData.append("status", "completed");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/series-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "series-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(updateSeries).toHaveBeenCalledWith("org-uuid", "series-1", {
        status: "completed",
        instructorName: null,
        notes: null,
        priceOverride: null,
      });
      expect((result as Response).status).toBe(302);
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/training/series/series-1", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: { id: "series-1" }, context: {}, unstable_pattern: "" } as unknown);

      expect(result).toBeNull();
    });
  });
});
