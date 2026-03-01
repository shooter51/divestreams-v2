import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock the org-context module
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../../lib/db/training.server", () => ({
  getAgencies: vi.fn(),
  getLevels: vi.fn(),
  createCourse: vi.fn(),
}));

// Mock use-notification
vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn(
    (path: string, msg: string, type: string) =>
      `${path}?notification=${encodeURIComponent(msg)}&type=${type}`
  ),
  useNotification: vi.fn(),
}));

// Mock react-router redirect
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn(
      (url: string) => new Response(null, { status: 302, headers: { Location: url } })
    ),
  };
});

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getAgencies,
  getLevels,
  createCourse,
} from "../../../../../lib/db/training.server";
import { redirect } from "react-router";
import { loader, action } from "../../../../../app/routes/tenant/training/courses/new";

describe("tenant/training/courses/new route", () => {
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

  const mockAgencies = [
    { id: "agency-1", name: "PADI" },
    { id: "agency-2", name: "SSI" },
  ];

  const mockLevels = [
    { id: "level-1", name: "Open Water", agencyName: "PADI" },
    { id: "level-2", name: "Advanced", agencyName: "PADI" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getAgencies as Mock).mockResolvedValue(mockAgencies);
    (getLevels as Mock).mockResolvedValue(mockLevels);
    (createCourse as Mock).mockResolvedValue({ id: "new-course-1" });
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns agencies and levels", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.agencies).toEqual(mockAgencies);
      expect(result.levels).toEqual(mockLevels);
      expect(getAgencies).toHaveBeenCalledWith("org-uuid");
      expect(getLevels).toHaveBeenCalledWith("org-uuid");
    });

    it("returns empty arrays when no agencies or levels exist", async () => {
      (getAgencies as Mock).mockResolvedValue([]);
      (getLevels as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.agencies).toEqual([]);
      expect(result.levels).toEqual([]);
    });
  });

  describe("action", () => {
    it("requires organization context", async () => {
      const formData = new FormData();
      formData.append("name", "Test Course");
      formData.append("price", "100");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns error when name is missing", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("price", "100");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.name).toBe("Course name is required");
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("returns error when name is whitespace only", async () => {
      const formData = new FormData();
      formData.append("name", "   ");
      formData.append("price", "100");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.name).toBe("Course name is required");
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("returns error when price is missing", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("price", "");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.price).toBe("Valid price is required");
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("returns error when price is not a number", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("price", "abc");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.price).toBe("Valid price is required");
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("returns error when price is negative", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("price", "-50");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.price).toBe("Price cannot be negative");
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("allows zero price for free courses", async () => {
      const formData = new FormData();
      formData.append("name", "Free Intro Course");
      formData.append("price", "0");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      // Should not return errors - should redirect
      expect(result).toBeInstanceOf(Response);
      expect(createCourse).toHaveBeenCalled();
    });

    it("returns both name and price errors when both invalid", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("price", "abc");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.errors.name).toBeDefined();
      expect(result.errors.price).toBeDefined();
      expect(createCourse).not.toHaveBeenCalled();
    });

    it("returns form values when validation fails", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("price", "100");
      formData.append("code", "OWD");
      formData.append("description", "Test description");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(result.values).toBeDefined();
      expect(result.values.price).toBe("100");
      expect(result.values.code).toBe("OWD");
      expect(result.values.description).toBe("Test description");
    });

    it("creates course and redirects on success", async () => {
      const formData = new FormData();
      formData.append("name", "Open Water Diver");
      formData.append("code", "OWD");
      formData.append("description", "Learn to dive");
      formData.append("agencyId", "agency-1");
      formData.append("levelId", "level-1");
      formData.append("durationDays", "3");
      formData.append("classroomHours", "8");
      formData.append("poolHours", "4");
      formData.append("openWaterDives", "4");
      formData.append("price", "399.00");
      formData.append("currency", "USD");
      formData.append("maxStudents", "6");
      formData.append("minAge", "10");
      formData.append("prerequisites", "Swimming ability");
      formData.append("isActive", "true");
      formData.append("isPublic", "true");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createCourse).toHaveBeenCalledWith({
        organizationId: "org-uuid",
        name: "Open Water Diver",
        code: "OWD",
        description: "Learn to dive",
        agencyId: "agency-1",
        levelId: "level-1",
        durationDays: 3,
        classroomHours: 8,
        poolHours: 4,
        openWaterDives: 4,
        price: "399.00",
        currency: "USD",
        maxStudents: 6,
        minAge: 10,
        prerequisites: "Swimming ability",
        isActive: true,
        isPublic: true,
      });

      expect(redirect).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it("trims name before creating course", async () => {
      const formData = new FormData();
      formData.append("name", "  Open Water Diver  ");
      formData.append("price", "399");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createCourse).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Open Water Diver" })
      );
    });

    it("sets optional fields to undefined when empty", async () => {
      const formData = new FormData();
      formData.append("name", "Basic Course");
      formData.append("price", "100");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(createCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-uuid",
          name: "Basic Course",
          code: undefined,
          description: undefined,
          agencyId: undefined,
          levelId: undefined,
          durationDays: undefined,
          classroomHours: undefined,
          poolHours: undefined,
          openWaterDives: undefined,
          price: "100",
          currency: "USD",
          maxStudents: undefined,
          minAge: undefined,
          prerequisites: undefined,
          isActive: false,
          isPublic: false,
        })
      );
    });

    it("includes course name in redirect notification", async () => {
      const formData = new FormData();
      formData.append("name", "Rescue Diver");
      formData.append("price", "500");
      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      expect(redirect).toHaveBeenCalledWith(
        expect.stringContaining("Rescue%20Diver")
      );
    });
  });
});
