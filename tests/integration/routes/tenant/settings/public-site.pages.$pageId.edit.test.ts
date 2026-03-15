/**
 * Public Site Page Edit Route Tests
 *
 * Tests for the page content editor route, including bidirectional
 * translation support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/page-content.server", () => ({
  getPageContent: vi.fn(),
  updatePageContent: vi.fn(),
  publishPageContent: vi.fn(),
  unpublishPageContent: vi.fn(),
  getPageContentHistory: vi.fn(),
  restorePageContentVersion: vi.fn(),
}));

vi.mock("../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
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
  getPageContentHistory,
} from "../../../../../lib/db/page-content.server";
import { enqueueTranslation } from "../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../app/i18n/resolve-locale";
import { loader, action } from "../../../../../app/routes/tenant/settings/public-site.pages.$pageId.edit";

describe("tenant/settings/public-site.pages.$pageId.edit route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
    membership: { role: "owner" },
    subscription: null,
    limits: {},
    usage: {},
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  const mockPage = {
    id: "page-1",
    pageId: "about",
    pageName: "About Us",
    content: { blocks: [] },
    status: "draft",
    version: 1,
    metaTitle: null,
    metaDescription: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      (getPageContent as Mock).mockResolvedValue(mockPage);
      (getPageContentHistory as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit");
      await loader({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as unknown);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("throws 404 when page not found", async () => {
      (getPageContent as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit");

      await expect(
        loader({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as unknown)
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("action - save intent", () => {
    it("uses Spanish source locale when resolveLocale returns es", async () => {
      (resolveLocale as Mock).mockReturnValue("es");
      (updatePageContent as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("intent", "save");
      formData.set("contentBlocks", JSON.stringify({ blocks: [] }));
      formData.set("metaTitle", "Sobre Nuestra Tienda de Buceo");
      formData.set("metaDescription", "Aprende sobre nuestro equipo");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("es");
        expect(data.targetLocale).not.toBe("es");
      }
    });

    it("defaults to English source locale when resolveLocale returns en", async () => {
      (resolveLocale as Mock).mockReturnValue("en");
      (updatePageContent as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("intent", "save");
      formData.set("contentBlocks", JSON.stringify({ blocks: [] }));
      formData.set("metaTitle", "About Page");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages/about/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { pageId: "about" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("en");
      }
    });
  });
});
