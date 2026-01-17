/**
 * Certification Levels Settings Route Tests
 *
 * Tests for the levels settings page at /app/training/settings/levels
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
const mockRequireOrgContext = vi.fn();
const mockGetCertificationAgencies = vi.fn();
const mockGetAllCertificationLevels = vi.fn();
const mockCreateCertificationLevel = vi.fn();
const mockUpdateCertificationLevel = vi.fn();
const mockDeleteCertificationLevel = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getCertificationAgencies: mockGetCertificationAgencies,
  getAllCertificationLevels: mockGetAllCertificationLevels,
  createCertificationLevel: mockCreateCertificationLevel,
  updateCertificationLevel: mockUpdateCertificationLevel,
  deleteCertificationLevel: mockDeleteCertificationLevel,
}));

describe("Levels Settings Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns hasAccess false for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
        limits: {},
      });

      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.agencies).toEqual([]);
      expect(result.levels).toEqual([]);
      expect(result.levelsByAgency).toEqual({});
    });

    it("returns levels list for premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      const mockAgencies = [
        {
          id: "agency-1",
          name: "PADI",
          code: "PADI",
          isActive: true,
        },
      ];

      const mockLevels = [
        {
          level: {
            id: "level-1",
            agencyId: "agency-1",
            name: "Open Water Diver",
            code: "OW",
            level: 1,
            description: "Entry level certification",
            prerequisites: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          agency: mockAgencies[0],
        },
        {
          level: {
            id: "level-2",
            agencyId: "agency-1",
            name: "Advanced Open Water",
            code: "AOW",
            level: 2,
            description: "Advanced certification",
            prerequisites: ["level-1"],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          agency: mockAgencies[0],
        },
        {
          level: {
            id: "level-3",
            agencyId: "agency-1",
            name: "Rescue Diver",
            code: "RD",
            level: 3,
            description: null,
            prerequisites: ["level-2"],
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          agency: mockAgencies[0],
        },
      ];

      mockGetCertificationAgencies.mockResolvedValue(mockAgencies);
      mockGetAllCertificationLevels.mockResolvedValue(mockLevels);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.agencies).toHaveLength(1);
      expect(result.levels).toHaveLength(3);
      expect(result.levels[0].level.name).toBe("Open Water Diver");
      expect(result.levels[2].level.isActive).toBe(false);
    });

    it("groups levels by agency", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      const mockAgencies = [
        { id: "agency-1", name: "PADI", code: "PADI", isActive: true },
        { id: "agency-2", name: "SSI", code: "SSI", isActive: true },
      ];

      const mockLevels = [
        {
          level: { id: "level-1", agencyId: "agency-1", name: "PADI OW", code: "OW", level: 1, isActive: true },
          agency: mockAgencies[0],
        },
        {
          level: { id: "level-2", agencyId: "agency-2", name: "SSI OW", code: "OW", level: 1, isActive: true },
          agency: mockAgencies[1],
        },
      ];

      mockGetCertificationAgencies.mockResolvedValue(mockAgencies);
      mockGetAllCertificationLevels.mockResolvedValue(mockLevels);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(Object.keys(result.levelsByAgency)).toHaveLength(2);
      expect(result.levelsByAgency["agency-1"]).toHaveLength(1);
      expect(result.levelsByAgency["agency-2"]).toHaveLength(1);
    });

    it("filters levels by agency when agencyId is provided", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-123", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockGetCertificationAgencies.mockResolvedValue([]);
      mockGetAllCertificationLevels.mockResolvedValue([]);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels?agencyId=agency-1"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetAllCertificationLevels).toHaveBeenCalledWith("org-123", "agency-1");
    });
  });

  describe("action", () => {
    it("returns error for non-premium users", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: false,
        limits: {},
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("agencyId", "agency-1");
      formData.set("name", "Open Water");
      formData.set("code", "OW");
      formData.set("level", "1");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Premium subscription required");
    });

    it("creates a new level", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockCreateCertificationLevel.mockResolvedValue({
        id: "new-level",
        name: "Open Water Diver",
        code: "OW",
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("agencyId", "agency-1");
      formData.set("name", "Open Water Diver");
      formData.set("code", "ow");
      formData.set("level", "1");
      formData.set("description", "Entry level certification");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Level created successfully");
      expect(mockCreateCertificationLevel).toHaveBeenCalledWith("org-1", {
        agencyId: "agency-1",
        name: "Open Water Diver",
        code: "OW", // Code should be uppercased
        level: 1,
        description: "Entry level certification",
        prerequisites: undefined,
      });
    });

    it("creates a level with prerequisites", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockCreateCertificationLevel.mockResolvedValue({
        id: "new-level",
        name: "Advanced Open Water",
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("agencyId", "agency-1");
      formData.set("name", "Advanced Open Water");
      formData.set("code", "AOW");
      formData.set("level", "2");
      formData.set("prerequisites", "level-1, level-2");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(true);
      expect(mockCreateCertificationLevel).toHaveBeenCalledWith("org-1", {
        agencyId: "agency-1",
        name: "Advanced Open Water",
        code: "AOW",
        level: 2,
        description: undefined,
        prerequisites: ["level-1", "level-2"],
      });
    });

    it("validates required fields on create", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("agencyId", "");
      formData.set("name", "");
      formData.set("code", "");
      formData.set("level", "");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Agency, name, code, and level number are required");
    });

    it("updates an existing level", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockUpdateCertificationLevel.mockResolvedValue({
        id: "level-1",
        name: "Open Water Diver Updated",
        code: "OWD",
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "update");
      formData.set("levelId", "level-1");
      formData.set("name", "Open Water Diver Updated");
      formData.set("code", "OWD");
      formData.set("level", "1");
      formData.set("description", "Updated description");
      formData.set("isActive", "true");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Level updated successfully");
      expect(mockUpdateCertificationLevel).toHaveBeenCalledWith(
        "org-1",
        "level-1",
        expect.objectContaining({
          name: "Open Water Diver Updated",
          code: "OWD",
          level: 1,
          isActive: true,
        })
      );
    });

    it("soft deletes (deactivates) a level", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockUpdateCertificationLevel.mockResolvedValue({
        id: "level-1",
        isActive: false,
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "delete");
      formData.set("levelId", "level-1");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Level deactivated successfully");
      expect(mockUpdateCertificationLevel).toHaveBeenCalledWith(
        "org-1",
        "level-1",
        { isActive: false }
      );
    });

    it("permanently deletes a level with hardDelete intent", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockDeleteCertificationLevel.mockResolvedValue(undefined);

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "hardDelete");
      formData.set("levelId", "level-1");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Level deleted permanently");
      expect(mockDeleteCertificationLevel).toHaveBeenCalledWith(
        "org-1",
        "level-1"
      );
    });

    it("returns error for invalid intent", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );

      const formData = new FormData();
      formData.set("intent", "invalid");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/levels",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid action");
    });
  });

  describe("component exports", () => {
    it("exports default component", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      expect(typeof module.default).toBe("function");
    });

    it("exports meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      expect(typeof module.meta).toBe("function");
    });

    it("exports loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      expect(typeof module.loader).toBe("function");
    });

    it("exports action function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      expect(typeof module.action).toBe("function");
    });

    it("has correct meta title", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/levels"
      );
      const meta = module.meta({} as any);
      expect(meta).toContainEqual({
        title: "Certification Levels - Training Settings - DiveStreams",
      });
    });
  });
});
