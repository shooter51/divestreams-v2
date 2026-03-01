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

vi.mock("../../../../lib/db/schema", () => ({
  organization: {
    id: "id",
    slug: "slug",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

vi.mock("../../../../lib/db/page-content.server", () => ({
  getPublicPageContent: vi.fn(),
}));

import { db } from "../../../../lib/db";
import { getPublicPageContent } from "../../../../lib/db/page-content.server";
import { loader } from "../../../../app/routes/site/about";

describe("site/about route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns pageContent when CMS content exists", async () => {
      (db.limit as Mock).mockResolvedValue([{ id: "org-1" }]);
      (getPublicPageContent as Mock).mockResolvedValue({
        content: { blocks: [{ type: "text", data: "About us" }] },
      });

      const request = new Request("https://demo.localhost:3000/site/about");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.pageContent).toBeTruthy();
      expect(getPublicPageContent).toHaveBeenCalledWith("org-1", "about");
    });

    it("returns null pageContent when no subdomain", async () => {
      const request = new Request("https://localhost:3000/site/about");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.pageContent).toBeNull();
    });

    it("returns null pageContent when org not found", async () => {
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.localhost:3000/site/about");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.pageContent).toBeNull();
    });

    it("returns null pageContent when CMS has no content", async () => {
      (db.limit as Mock).mockResolvedValue([{ id: "org-1" }]);
      (getPublicPageContent as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.localhost:3000/site/about");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.pageContent).toBeNull();
    });
  });
});
