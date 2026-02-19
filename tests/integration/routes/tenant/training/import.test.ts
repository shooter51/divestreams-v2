import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock org-context (6 levels deep from source file: app/routes/tenant/training/import/index.tsx)
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock training DB functions
vi.mock("../../../../../lib/db/training.server", () => ({
  getAgencies: vi.fn(),
  createAgency: vi.fn(),
  createCourse: vi.fn(),
}));

// Mock training templates
vi.mock("../../../../../lib/db/training-templates.server", () => ({
  getGlobalAgencyCourseTemplates: vi.fn(),
  getAvailableAgencies: vi.fn(),
}));

// Mock dynamic imports used in csv-upload step
vi.mock("../../../../../lib/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(() => ({
    schema: {
      trainingCourses: {
        organizationId: "organizationId",
        agencyId: "agencyId",
        code: "code",
      },
    },
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getAgencies, createAgency, createCourse } from "../../../../../lib/db/training.server";
import {
  getGlobalAgencyCourseTemplates,
  getAvailableAgencies,
} from "../../../../../lib/db/training-templates.server";
import { loader, action } from "../../../../../app/routes/tenant/training/import/index";

describe("tenant/training/import route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      (getAvailableAgencies as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/training/import");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns available agencies", async () => {
      const mockAgencies = [
        { code: "padi", name: "PADI", description: "Professional Association of Diving Instructors" },
        { code: "ssi", name: "SSI", description: "Scuba Schools International" },
      ];
      (getAvailableAgencies as Mock).mockResolvedValue(mockAgencies);

      const request = new Request("https://demo.divestreams.com/tenant/training/import");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.agencies).toEqual(mockAgencies);
      expect(getAvailableAgencies).toHaveBeenCalled();
    });
  });

  describe("action", () => {
    describe("select-agency step", () => {
      it("returns error when agencyCode is missing", async () => {
        const formData = new FormData();
        formData.append("step", "select-agency");
        formData.append("agencyCode", "");
        formData.append("agencyName", "");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
        expect(result.fieldErrors?.agency).toBeDefined();
      });

      it("returns courses when agency has templates", async () => {
        const mockTemplates = [
          {
            name: "Open Water Diver",
            code: "OWD",
            description: "Entry level course",
            images: [],
            durationDays: 4,
            classroomHours: 8,
            poolHours: 4,
            openWaterDives: 4,
            prerequisites: "",
            minAge: 10,
            medicalRequirements: "",
            requiredItems: [],
            materialsIncluded: true,
          },
        ];
        (getGlobalAgencyCourseTemplates as Mock).mockResolvedValue(mockTemplates);

        const formData = new FormData();
        formData.append("step", "select-agency");
        formData.append("agencyCode", "padi");
        formData.append("agencyName", "PADI");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(true);
        expect(result.step).toBe("select-courses");
        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].name).toBe("Open Water Diver");
        expect(result.courses[0].code).toBe("OWD");
        expect(result.agency).toEqual({ code: "padi", name: "PADI" });
      });

      it("returns error when no templates exist for agency", async () => {
        (getGlobalAgencyCourseTemplates as Mock).mockResolvedValue([]);

        const formData = new FormData();
        formData.append("step", "select-agency");
        formData.append("agencyCode", "unknown");
        formData.append("agencyName", "Unknown Agency");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
        expect(result.error).toContain("Unknown Agency");
      });
    });

    describe("select-courses step", () => {
      it("returns error when no courses are selected", async () => {
        const formData = new FormData();
        formData.append("step", "select-courses");
        formData.append("agencyCode", "padi");
        formData.append("agencyName", "PADI");
        // No courses appended

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
        expect(result.fieldErrors?.courses).toBeDefined();
      });

      it("returns selected courses for preview", async () => {
        const mockTemplates = [
          { name: "Open Water Diver", code: "OWD", description: "Entry level" },
          { name: "Advanced Open Water", code: "AOWD", description: "Advanced course" },
        ];
        (getGlobalAgencyCourseTemplates as Mock).mockResolvedValue(mockTemplates);

        const formData = new FormData();
        formData.append("step", "select-courses");
        formData.append("agencyCode", "padi");
        formData.append("agencyName", "PADI");
        formData.append("courses", "padi-OWD");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(true);
        expect(result.step).toBe("preview");
        expect(result.selectedCourses).toHaveLength(1);
        expect(result.selectedCourses[0].name).toBe("Open Water Diver");
      });
    });

    describe("execute-import step", () => {
      it("creates courses from templates", async () => {
        const mockTemplates = [
          {
            name: "Open Water Diver",
            code: "OWD",
            description: "Entry level",
            durationDays: 4,
            classroomHours: 8,
            poolHours: 4,
            openWaterDives: 4,
            minAge: 10,
            prerequisites: null,
            medicalRequirements: null,
            materialsIncluded: true,
            requiredItems: [],
          },
        ];
        (getGlobalAgencyCourseTemplates as Mock).mockResolvedValue(mockTemplates);
        (getAgencies as Mock).mockResolvedValue([]);
        (createAgency as Mock).mockResolvedValue({
          id: "agency-1",
          name: "PADI",
          code: "padi",
        });
        (createCourse as Mock).mockResolvedValue({
          id: "course-1",
          name: "Open Water Diver",
        });

        const formData = new FormData();
        formData.append("step", "execute-import");
        formData.append("agencyCode", "padi");
        formData.append("agencyName", "PADI");
        formData.append("courseCodes", JSON.stringify(["OWD"]));

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(true);
        expect(result.step).toBe("complete");
        expect(result.importedCount).toBe(1);
        expect(result.importedCourses).toContain("Open Water Diver");
        expect(createCourse).toHaveBeenCalled();
      });

      it("handles errors during import", async () => {
        const mockTemplates = [
          {
            name: "Open Water Diver",
            code: "OWD",
            description: "Entry level",
            durationDays: 4,
          },
        ];
        (getGlobalAgencyCourseTemplates as Mock).mockResolvedValue(mockTemplates);
        (getAgencies as Mock).mockResolvedValue([
          { id: "agency-1", code: "padi", name: "PADI" },
        ]);
        (createCourse as Mock).mockRejectedValue(new Error("duplicate key constraint"));

        const formData = new FormData();
        formData.append("step", "execute-import");
        formData.append("agencyCode", "padi");
        formData.append("agencyName", "PADI");
        formData.append("courseCodes", JSON.stringify(["OWD"]));

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
        expect(result.detailedErrors).toHaveLength(1);
      });

      it("returns error when missing agencyCode or courseCodes", async () => {
        const formData = new FormData();
        formData.append("step", "execute-import");
        formData.append("agencyCode", "");
        formData.append("agencyName", "PADI");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
      });
    });

    describe("csv-upload step", () => {
      it("returns error when no file is uploaded", async () => {
        const formData = new FormData();
        formData.append("step", "csv-upload");

        const request = new Request("https://demo.divestreams.com/tenant/training/import", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(result.error).toBeDefined();
        expect(result.error).toContain("No CSV file");
      });
    });
  });
});
