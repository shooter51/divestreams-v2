import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/page-content.server", () => ({
  listPageContent: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { listPageContent } from "../../../../../lib/db/page-content.server";
import { loader } from "../../../../../app/routes/tenant/settings/public-site.pages";

describe("tenant/settings/public-site.pages route", () => {
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
      (listPageContent as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns pages list", async () => {
      const mockPages = [
        {
          id: "page-1",
          pageId: "about",
          pageName: "About Us",
          status: "published",
          version: 3,
          updatedAt: "2024-01-15T10:00:00Z",
        },
        {
          id: "page-2",
          pageId: "home",
          pageName: "Home Page",
          status: "draft",
          version: 1,
          updatedAt: "2024-01-10T10:00:00Z",
        },
      ];
      (listPageContent as Mock).mockResolvedValue(mockPages);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.pages).toEqual(mockPages);
      expect(result.pages).toHaveLength(2);
    });

    it("returns orgSlug", async () => {
      (listPageContent as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.orgSlug).toBe("demo");
    });

    it("returns empty array when no pages exist", async () => {
      (listPageContent as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/pages");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.pages).toEqual([]);
    });
  });
});
