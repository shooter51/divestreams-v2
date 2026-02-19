import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/utils/url", () => ({
  getSubdomainFromHost: vi.fn().mockReturnValue("demo"),
}));

vi.mock("../../../../lib/db/gallery.server", () => ({
  getPublicGalleryImages: vi.fn().mockResolvedValue([]),
  getPublicGalleryAlbums: vi.fn().mockResolvedValue([]),
  getGalleryCategories: vi.fn().mockResolvedValue([]),
  getGalleryTags: vi.fn().mockResolvedValue([]),
}));

import { db } from "../../../../lib/db";
import { getSubdomainFromHost } from "../../../../lib/utils/url";
import { getPublicGalleryImages, getPublicGalleryAlbums } from "../../../../lib/db/gallery.server";
import { loader } from "../../../../app/routes/site/gallery";

describe("site/gallery route", () => {
  const mockOrg = { id: "org-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSubdomainFromHost as Mock).mockReturnValue("demo");
    (db.limit as Mock).mockResolvedValue([mockOrg]);
  });

  describe("loader", () => {
    it("returns gallery data for valid organization", async () => {
      const request = new Request("https://demo.divestreams.com/site/gallery");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.images).toEqual([]);
      expect(result.albums).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-1", expect.any(Object));
    });

    it("throws 404 when organization not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://unknown.divestreams.com/site/gallery");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("passes filter params to gallery queries", async () => {
      const request = new Request("https://demo.divestreams.com/site/gallery?album=album-1&category=reef&tags=coral,fish");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.filters.albumId).toBe("album-1");
      expect(result.filters.category).toBe("reef");
      expect(result.filters.tags).toEqual(["coral", "fish"]);
      expect(getPublicGalleryImages).toHaveBeenCalledWith("org-1", {
        albumId: "album-1",
        category: "reef",
        tags: ["coral", "fish"],
        limit: 100,
      });
    });

    it("handles no filter params", async () => {
      const request = new Request("https://demo.divestreams.com/site/gallery");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.filters.albumId).toBeUndefined();
      expect(result.filters.category).toBeUndefined();
      expect(result.filters.tags).toBeUndefined();
    });
  });
});
