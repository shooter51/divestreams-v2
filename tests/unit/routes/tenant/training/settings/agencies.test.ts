/**
 * Certification Agencies Settings Route Tests
 *
 * Tests for the agencies settings page at /app/training/settings/agencies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
const mockRequireOrgContext = vi.fn();
const mockGetAllCertificationAgencies = vi.fn();
const mockCreateCertificationAgency = vi.fn();
const mockUpdateCertificationAgency = vi.fn();
const mockDeleteCertificationAgency = vi.fn();

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getAllCertificationAgencies: mockGetAllCertificationAgencies,
  createCertificationAgency: mockCreateCertificationAgency,
  updateCertificationAgency: mockUpdateCertificationAgency,
  deleteCertificationAgency: mockDeleteCertificationAgency,
}));

describe("Agencies Settings Route", () => {
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
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(false);
      expect(result.agencies).toEqual([]);
    });

    it("returns agencies list for premium users", async () => {
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
          website: "https://www.padi.com",
          logoUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "agency-2",
          name: "SSI",
          code: "SSI",
          website: "https://www.divessi.com",
          logoUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "agency-3",
          name: "NAUI",
          code: "NAUI",
          website: null,
          logoUrl: null,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetAllCertificationAgencies.mockResolvedValue(mockAgencies);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies"
      );
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.hasAccess).toBe(true);
      expect(result.agencies).toHaveLength(3);
      expect(result.agencies[0].name).toBe("PADI");
      expect(result.agencies[2].isActive).toBe(false);
    });

    it("calls getAllCertificationAgencies with org ID", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-123", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockGetAllCertificationAgencies.mockResolvedValue([]);

      vi.resetModules();
      const { loader } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies"
      );
      await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(mockGetAllCertificationAgencies).toHaveBeenCalledWith("org-123");
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
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("name", "PADI");
      formData.set("code", "PADI");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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

    it("creates a new agency", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockCreateCertificationAgency.mockResolvedValue({
        id: "new-agency",
        name: "PADI",
        code: "PADI",
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("name", "PADI");
      formData.set("code", "padi");
      formData.set("website", "https://www.padi.com");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
      expect(result.message).toBe("Agency created successfully");
      expect(mockCreateCertificationAgency).toHaveBeenCalledWith("org-1", {
        name: "PADI",
        code: "PADI", // Code should be uppercased
        website: "https://www.padi.com",
        logoUrl: undefined,
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
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "create");
      formData.set("name", "");
      formData.set("code", "");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
      expect(result.error).toBe("Name and code are required");
    });

    it("updates an existing agency", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockUpdateCertificationAgency.mockResolvedValue({
        id: "agency-1",
        name: "PADI Updated",
        code: "PADI",
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "update");
      formData.set("agencyId", "agency-1");
      formData.set("name", "PADI Updated");
      formData.set("code", "PADI");
      formData.set("isActive", "true");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
      expect(result.message).toBe("Agency updated successfully");
      expect(mockUpdateCertificationAgency).toHaveBeenCalledWith(
        "org-1",
        "agency-1",
        expect.objectContaining({
          name: "PADI Updated",
          code: "PADI",
          isActive: true,
        })
      );
    });

    it("soft deletes (deactivates) an agency", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockUpdateCertificationAgency.mockResolvedValue({
        id: "agency-1",
        isActive: false,
      });

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "delete");
      formData.set("agencyId", "agency-1");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
      expect(result.message).toBe("Agency deactivated successfully");
      expect(mockUpdateCertificationAgency).toHaveBeenCalledWith(
        "org-1",
        "agency-1",
        { isActive: false }
      );
    });

    it("permanently deletes an agency with hardDelete intent", async () => {
      mockRequireOrgContext.mockResolvedValue({
        org: { id: "org-1", name: "Test Dive Shop" },
        isPremium: true,
        limits: {},
      });

      mockDeleteCertificationAgency.mockResolvedValue(undefined);

      vi.resetModules();
      const { action } = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "hardDelete");
      formData.set("agencyId", "agency-1");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
      expect(result.message).toBe("Agency deleted permanently");
      expect(mockDeleteCertificationAgency).toHaveBeenCalledWith(
        "org-1",
        "agency-1"
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
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );

      const formData = new FormData();
      formData.set("intent", "invalid");

      const request = new Request(
        "https://demo.divestreams.com/app/training/settings/agencies",
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
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      expect(typeof module.default).toBe("function");
    });

    it("exports meta function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      expect(typeof module.meta).toBe("function");
    });

    it("exports loader function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      expect(typeof module.loader).toBe("function");
    });

    it("exports action function", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      expect(typeof module.action).toBe("function");
    });

    it("has correct meta title", async () => {
      const module = await import(
        "../../../../../../app/routes/tenant/training/settings/agencies"
      );
      const meta = module.meta({} as any);
      expect(meta).toContainEqual({
        title: "Certification Agencies - Training Settings - DiveStreams",
      });
    });
  });
});
