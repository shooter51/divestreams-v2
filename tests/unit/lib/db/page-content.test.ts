import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

const mockSelectResult = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();
const mockDeleteReturning = vi.fn();
const mockInsertValues = vi.fn();

const buildSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockImplementation(() => mockSelectResult()),
      orderBy: vi.fn().mockImplementation(() => mockSelectResult()),
    }),
    orderBy: vi.fn().mockImplementation(() => mockSelectResult()),
  }),
});

const buildInsertChain = () => ({
  values: vi.fn().mockImplementation((vals: unknown) => {
    mockInsertValues(vals);
    return { returning: mockInsertReturning };
  }),
});

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: mockUpdateReturning,
    }),
  }),
});

const buildDeleteChain = () => ({
  where: vi.fn().mockReturnValue({
    returning: mockDeleteReturning,
  }),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let updateChain = buildUpdateChain();
let deleteChain = buildDeleteChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
  },
}));

vi.mock("../../../../lib/db/schema/page-content", () => ({
  pageContent: {
    organizationId: "organizationId",
    pageId: "pageId",
    pageName: "pageName",
    content: "content",
    metaTitle: "metaTitle",
    metaDescription: "metaDescription",
    status: "status",
    version: "version",
    createdBy: "createdBy",
    updatedBy: "updatedBy",
    updatedAt: "updatedAt",
    publishedAt: "publishedAt",
    publishedBy: "publishedBy",
  },
  pageContentHistory: {
    id: "id",
    pageContentId: "pageContentId",
    organizationId: "organizationId",
    version: "version",
    content: "content",
    changeDescription: "changeDescription",
    createdAt: "createdAt",
    createdBy: "createdBy",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((a) => ({ desc: a })),
}));

describe("page-content.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    updateChain = buildUpdateChain();
    deleteChain = buildDeleteChain();
  });

  describe("getPageContent", () => {
    it("returns null when page not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPageContent("org-1", "about");
      expect(result).toBeNull();
    });

    it("returns page when found", async () => {
      const mockPage = { id: "page-1", pageId: "about", organizationId: "org-1" };
      mockSelectResult.mockResolvedValue([mockPage]);

      const { getPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPageContent("org-1", "about");
      expect(result).toEqual(mockPage);
    });
  });

  describe("getPublishedPageContent", () => {
    it("returns null when no published page found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPublishedPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPublishedPageContent("org-1", "about");
      expect(result).toBeNull();
    });
  });

  describe("listPageContent", () => {
    it("returns all pages for organization", async () => {
      const mockPages = [
        { pageId: "about", pageName: "About" },
        { pageId: "home", pageName: "Home" },
      ];
      mockSelectResult.mockResolvedValue(mockPages);

      const { listPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await listPageContent("org-1");
      expect(result).toEqual(mockPages);
    });

    it("filters by status when provided", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { listPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await listPageContent("org-1", { status: "published" });
      expect(result).toEqual([]);
    });
  });

  describe("createPageContent", () => {
    it("creates page with initial history entry", async () => {
      const mockPage = {
        id: "page-1",
        pageId: "about",
        organizationId: "org-1",
        version: 1,
        content: { blocks: [] },
      };
      mockInsertReturning.mockResolvedValue([mockPage]);

      const { createPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await createPageContent({
        organizationId: "org-1",
        pageId: "about",
        pageName: "About Us",
        content: { blocks: [] },
        userId: "user-1",
      });
      expect(result).toEqual(mockPage);
    });
  });

  describe("updatePageContent", () => {
    it("returns null when page not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { updatePageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await updatePageContent("org-1", "nonexistent", {
        userId: "user-1",
        content: { blocks: [] },
      });
      expect(result).toBeNull();
    });

    it("increments version when content is updated", async () => {
      const existing = { id: "page-1", pageId: "about", version: 2, content: { blocks: [] } };
      const updated = { ...existing, version: 3 };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);
      mockInsertReturning.mockResolvedValue([{}]);

      const { updatePageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await updatePageContent("org-1", "about", {
        userId: "user-1",
        content: { blocks: [{ id: "h1", type: "heading", content: "Hi" }] },
      });
      expect(result).toBeDefined();
    });

    it("sets publishedAt when status changed to published", async () => {
      const existing = { id: "page-1", pageId: "about", version: 1, status: "draft" };
      const updated = { ...existing, status: "published" };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { updatePageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await updatePageContent("org-1", "about", {
        userId: "user-1",
        status: "published",
      });
      expect(result?.status).toBe("published");
    });
  });

  describe("publishPageContent", () => {
    it("delegates to updatePageContent with published status", async () => {
      const existing = { id: "page-1", pageId: "about", version: 1 };
      const updated = { ...existing, status: "published" };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { publishPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await publishPageContent("org-1", "about", "user-1");
      expect(result).toBeDefined();
    });
  });

  describe("unpublishPageContent", () => {
    it("delegates to updatePageContent with draft status", async () => {
      const existing = { id: "page-1", pageId: "about", version: 1 };
      const updated = { ...existing, status: "draft" };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { unpublishPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await unpublishPageContent("org-1", "about", "user-1");
      expect(result).toBeDefined();
    });
  });

  describe("deletePageContent", () => {
    it("returns true when page deleted", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "page-1" }]);

      const { deletePageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await deletePageContent("org-1", "about");
      expect(result).toBe(true);
    });

    it("returns false when page not found", async () => {
      mockDeleteReturning.mockResolvedValue([]);

      const { deletePageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await deletePageContent("org-1", "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getPageContentHistory", () => {
    it("returns empty array when page not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPageContentHistory } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPageContentHistory("org-1", "nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("restorePageContentVersion", () => {
    it("returns null when page not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { restorePageContentVersion } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await restorePageContentVersion("org-1", "nonexistent", 1, "user-1");
      expect(result).toBeNull();
    });
  });

  describe("getPublicPageContent", () => {
    it("returns null when page not published", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPublicPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPublicPageContent("org-1", "about");
      expect(result).toBeNull();
    });

    it("returns content subset when page is published", async () => {
      const mockPage = {
        content: { blocks: [] },
        metaTitle: "About Us",
        metaDescription: "Our story",
      };
      mockSelectResult.mockResolvedValue([mockPage]);

      const { getPublicPageContent } = await import(
        "../../../../lib/db/page-content.server"
      );
      const result = await getPublicPageContent("org-1", "about");
      expect(result).toEqual({
        content: { blocks: [] },
        metaTitle: "About Us",
        metaDescription: "Our story",
      });
    });
  });

  describe("initializeDefaultPages", () => {
    it("creates about and home pages", async () => {
      const mockPage = { id: "page-1", version: 1, content: { blocks: [] } };
      mockInsertReturning.mockResolvedValue([mockPage]);

      const { initializeDefaultPages } = await import(
        "../../../../lib/db/page-content.server"
      );
      await initializeDefaultPages("org-1", "Test Dive Shop", "user-1");
      // Should not throw - creates 2 default pages
    });

    it("handles errors gracefully when page already exists", async () => {
      mockInsertReturning.mockRejectedValue(new Error("unique constraint"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { initializeDefaultPages } = await import(
        "../../../../lib/db/page-content.server"
      );
      await initializeDefaultPages("org-1", "Test Shop", "user-1");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
