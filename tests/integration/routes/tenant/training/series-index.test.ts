import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/training.server", () => ({
  getSeriesList: vi.fn(),
  getCourses: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  useNotification: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSeriesList, getCourses } from "../../../../../lib/db/training.server";
import { loader } from "../../../../../app/routes/tenant/training/series/index";

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

const mockSeriesList = [
  {
    id: "series-1",
    name: "Open Water Spring 2026",
    courseId: "course-1",
    courseName: "Open Water Diver",
    status: "active",
    maxStudents: 8,
    sessionCount: 4,
  },
  {
    id: "series-2",
    name: "AOW Summer 2026",
    courseId: "course-2",
    courseName: "Advanced Open Water",
    status: "active",
    maxStudents: 6,
    sessionCount: 5,
  },
];

const mockCourses = [
  { id: "course-1", name: "Open Water Diver", agencyName: "PADI" },
  { id: "course-2", name: "Advanced Open Water", agencyName: "PADI" },
];

describe("tenant/training/series/index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getSeriesList as Mock).mockResolvedValue(mockSeriesList);
    (getCourses as Mock).mockResolvedValue(mockCourses);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns all series for the organization", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.seriesList).toEqual(mockSeriesList);
      expect(getSeriesList).toHaveBeenCalledWith("org-uuid", { courseId: undefined, status: undefined });
    });

    it("returns total count", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/series");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.total).toBe(2);
    });

    it("filters by courseId when provided", async () => {
      (getSeriesList as Mock).mockResolvedValue([mockSeriesList[0]]);
      const request = new Request("https://demo.divestreams.com/tenant/training/series?courseId=course-1");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(getSeriesList).toHaveBeenCalledWith("org-uuid", { courseId: "course-1", status: undefined });
      expect(result.seriesList).toHaveLength(1);
    });

    it("returns empty series list when none exist", async () => {
      (getSeriesList as Mock).mockResolvedValue([]);
      const request = new Request("https://demo.divestreams.com/tenant/training/series");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(result.seriesList).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
