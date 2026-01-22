/**
 * API Debug Organizations Route Tests
 *
 * Tests the debug API endpoint that lists all organizations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/api/debug-orgs";

// Mock modules
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    createdAt: "createdAt",
  },
}));

// Import mocked modules
import { db } from "../../../../lib/db";

describe("Route: api/debug-orgs.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return list of organizations", async () => {
      // Arrange
      const mockOrgs = [
        {
          id: "org-1",
          name: "Organization One",
          slug: "org-one",
          createdAt: new Date("2024-01-15T10:00:00Z"),
        },
        {
          id: "org-2",
          name: "Organization Two",
          slug: "org-two",
          createdAt: new Date("2024-02-20T15:30:00Z"),
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockOrgs),
      });

      const request = new Request("http://test.com/api/debug-orgs");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(db.select).toHaveBeenCalled();
      expect(data).toEqual({
        status: "ok",
        count: 2,
        organizations: [
          {
            id: "org-1",
            name: "Organization One",
            slug: "org-one",
            createdAt: "2024-01-15T10:00:00.000Z",
          },
          {
            id: "org-2",
            name: "Organization Two",
            slug: "org-two",
            createdAt: "2024-02-20T15:30:00.000Z",
          },
        ],
      });
    });

    it("should return empty list when no organizations exist", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      });

      const request = new Request("http://test.com/api/debug-orgs");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(data).toEqual({
        status: "ok",
        count: 0,
        organizations: [],
      });
    });

    it("should handle null createdAt dates", async () => {
      // Arrange
      const mockOrgs = [
        {
          id: "org-1",
          name: "Organization One",
          slug: "org-one",
          createdAt: null,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockOrgs),
      });

      const request = new Request("http://test.com/api/debug-orgs");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(data.organizations[0].createdAt).toBeUndefined();
    });

    it("should handle database errors", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      });

      const request = new Request("http://test.com/api/debug-orgs");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: "error",
        error: "Error: Database connection failed",
      });
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockRejectedValue("String error"),
      });

      const request = new Request("http://test.com/api/debug-orgs");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: "error",
        error: "String error",
      });
    });
  });
});
