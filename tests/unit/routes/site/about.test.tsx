/**
 * Site About Route Tests
 *
 * Tests the about page with CMS content loading.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/site/about";

// Mock page content server
vi.mock("../../../../lib/db/page-content.server", () => ({
  getPublicPageContent: vi.fn(),
}));

// Import mocked module
import { getPublicPageContent } from "../../../../lib/db/page-content.server";

describe("Route: site/about.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return null pageContent when no subdomain", async () => {
      // Arrange
      const request = new Request("http://divestreams.com/site/about");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ pageContent: null });
    });

    it("should return null pageContent when subdomain is www", async () => {
      // Arrange
      const request = new Request("http://www.divestreams.com/site/about");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ pageContent: null });
    });

    it("should return null pageContent when subdomain is admin", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/site/about");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ pageContent: null });
    });

    it("should return null pageContent when organization not found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/about");

      // Mock dynamic imports
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));
      vi.doMock("../../../../lib/db/schema", () => ({ organization: {} }));
      vi.doMock("drizzle-orm", () => ({ eq: vi.fn() }));

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ pageContent: null });
    });

    it("should fetch and return page content when organization found with localhost subdomain", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/about");
      const mockPageContent = {
        id: "page-123",
        slug: "about",
        content: {
          blocks: [
            {
              type: "heading",
              content: "About Us",
            },
            {
              type: "paragraph",
              content: "We are a dive shop",
            },
          ],
        },
      };

      // Mock dynamic imports
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-123" }]),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));
      vi.doMock("../../../../lib/db/schema", () => ({ organization: {} }));
      vi.doMock("drizzle-orm", () => ({ eq: vi.fn() }));

      (getPublicPageContent as any).mockResolvedValue(mockPageContent);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicPageContent).toHaveBeenCalledWith("org-123", "about");
      expect(result).toEqual({ pageContent: mockPageContent });
    });

    it("should fetch and return page content when organization found with production subdomain", async () => {
      // Arrange
      const request = new Request("http://demo.divestreams.com/site/about");
      const mockPageContent = {
        id: "page-456",
        slug: "about",
        content: {
          blocks: [
            {
              type: "heading",
              content: "Welcome",
            },
          ],
        },
      };

      // Mock dynamic imports
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-456" }]),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));
      vi.doMock("../../../../lib/db/schema", () => ({ organization: {} }));
      vi.doMock("drizzle-orm", () => ({ eq: vi.fn() }));

      (getPublicPageContent as any).mockResolvedValue(mockPageContent);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicPageContent).toHaveBeenCalledWith("org-456", "about");
      expect(result).toEqual({ pageContent: mockPageContent });
    });

    it("should return null pageContent when getPublicPageContent returns null", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/about");

      // Mock dynamic imports
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-789" }]),
      };

      vi.doMock("../../../../lib/db", () => ({ db: mockDb }));
      vi.doMock("../../../../lib/db/schema", () => ({ organization: {} }));
      vi.doMock("drizzle-orm", () => ({ eq: vi.fn() }));

      (getPublicPageContent as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getPublicPageContent).toHaveBeenCalledWith("org-789", "about");
      expect(result).toEqual({ pageContent: null });
    });
  });
});
