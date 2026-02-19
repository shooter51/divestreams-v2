import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/page-content.server", () => ({
  getPageContent: vi.fn(),
  updatePageContent: vi.fn(),
  publishPageContent: vi.fn(),
  unpublishPageContent: vi.fn(),
  getPageContentHistory: vi.fn(),
  restorePageContentVersion: vi.fn(),
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
  getPageContent,
  updatePageContent,
  publishPageContent,
  unpublishPageContent,
  getPageContentHistory,
  restorePageContentVersion,
} from "../../../../../lib/db/page-content.server";
import { loader, action } from "../../../../../app/routes/tenant/settings/public-site.pages.$pageId.edit";

describe("tenant/settings/public-site.pages.$pageId.edit route", () => {
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
      const mockPage = {
        id: "page-1",
        pageId: "about",
        pageName: "About Us",
        content: { blocks: [] },
        status: "draft",
        version: 1,
      };
      (getPageContent as Mock).mockResolvedValue(mockPage);
      (getPageContentHistory as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit");
      await loader({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 400 when pageId is missing", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages//edit");

      await expect(
        loader({ request, params: {}, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("throws 404 when page is not found", async () => {
      (getPageContent as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/nonexistent/edit");

      await expect(
        loader({ request, params: { pageId: "nonexistent" }, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("returns page, history, orgSlug, and userId", async () => {
      const mockPage = {
        id: "page-1",
        pageId: "about",
        pageName: "About Us",
        content: { blocks: [{ type: "paragraph", text: "Hello" }] },
        status: "published",
        version: 3,
        metaTitle: "About Us - Demo Dive Shop",
        metaDescription: "Learn about our dive shop",
      };
      const mockHistory = [
        { id: "hist-1", version: 2, changeDescription: "Updated content", createdAt: "2024-01-14T10:00:00Z" },
        { id: "hist-2", version: 1, changeDescription: "Initial version", createdAt: "2024-01-10T10:00:00Z" },
      ];
      (getPageContent as Mock).mockResolvedValue(mockPage);
      (getPageContentHistory as Mock).mockResolvedValue(mockHistory);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit");
      const result = await loader({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

      expect(result.page).toEqual(mockPage);
      expect(result.history).toEqual(mockHistory);
      expect(result.orgSlug).toBe("demo");
      expect(result.userId).toBe("user-1");
    });
  });

  describe("action", () => {
    describe("save intent", () => {
      it("saves page content with parsed JSON blocks", async () => {
        (updatePageContent as Mock).mockResolvedValue(undefined);

        const contentBlocks = JSON.stringify({ blocks: [{ type: "paragraph", text: "Updated content" }] });
        const formData = new FormData();
        formData.append("intent", "save");
        formData.append("contentBlocks", contentBlocks);
        formData.append("metaTitle", "About Us");
        formData.append("metaDescription", "Learn about our dive shop");
        formData.append("changeDescription", "Updated paragraph text");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(updatePageContent).toHaveBeenCalledWith("org-uuid", "about", {
          content: { blocks: [{ type: "paragraph", text: "Updated content" }] },
          metaTitle: "About Us",
          metaDescription: "Learn about our dive shop",
          changeDescription: "Updated paragraph text",
          userId: "user-1",
        });
        expect(result).toEqual({ success: true, message: "Page saved successfully" });
      });

      it("saves with empty content blocks when no JSON provided", async () => {
        (updatePageContent as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "save");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(updatePageContent).toHaveBeenCalledWith("org-uuid", "about", expect.objectContaining({
          content: { blocks: [] },
        }));
        expect(result.success).toBe(true);
      });
    });

    describe("publish intent", () => {
      it("publishes page content", async () => {
        (publishPageContent as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "publish");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(publishPageContent).toHaveBeenCalledWith("org-uuid", "about", "user-1");
        expect(result).toEqual({ success: true, message: "Page published successfully" });
      });
    });

    describe("unpublish intent", () => {
      it("unpublishes page content", async () => {
        (unpublishPageContent as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "unpublish");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(unpublishPageContent).toHaveBeenCalledWith("org-uuid", "about", "user-1");
        expect(result).toEqual({ success: true, message: "Page unpublished successfully" });
      });
    });

    describe("restore intent", () => {
      it("restores a specific version", async () => {
        (restorePageContentVersion as Mock).mockResolvedValue({ id: "page-1", version: 5 });

        const formData = new FormData();
        formData.append("intent", "restore");
        formData.append("version", "2");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(restorePageContentVersion).toHaveBeenCalledWith("org-uuid", "about", 2, "user-1");
        expect(result).toEqual({ success: true, message: "Restored to version 2" });
      });

      it("returns error when version is missing", async () => {
        const formData = new FormData();
        formData.append("intent", "restore");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Version number is required");
      });

      it("returns error when version is not a number", async () => {
        const formData = new FormData();
        formData.append("intent", "restore");
        formData.append("version", "abc");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid version number");
      });

      it("returns error when version does not exist", async () => {
        (restorePageContentVersion as Mock).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("intent", "restore");
        formData.append("version", "99");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to restore version");
      });
    });

    it("throws 400 when pageId is missing", async () => {
      const formData = new FormData();
      formData.append("intent", "save");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages//edit", {
        method: "POST",
        body: formData,
      });

      await expect(
        action({ request, params: {}, context: {}, unstable_pattern: "" } as any)
      ).rejects.toThrow();
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as any);

      expect(result).toBeNull();
    });
  });
});
