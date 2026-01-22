/**
 * Admin Organizations Index Route Tests
 *
 * Tests the admin organizations list page with search and delete functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  meta,
  loader,
  action,
} from "../../../../app/routes/admin/index";

// Mock modules
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
  PLATFORM_ORG_SLUG: "platform",
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
    slug: "slug",
    logo: "logo",
    createdAt: "createdAt",
  },
  member: {
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
  },
}));

vi.mock("../../../../lib/db/schema/subscription", () => ({
  subscription: {
    organizationId: "organizationId",
    status: "status",
    plan: "plan",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  ne: vi.fn((a, b) => ({ ne: [a, b] })),
  ilike: vi.fn((a, b) => ({ ilike: [a, b] })),
  or: vi.fn((...args) => ({ or: args })),
  desc: vi.fn((field) => ({ desc: field })),
  sql: vi.fn((strings, ...values) => ({ sql: strings, values })),
  count: vi.fn(() => ({ count: true })),
}));

// Import mocked modules
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { db } from "../../../../lib/db";
import { eq } from "drizzle-orm";

describe("Route: admin/index.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset requirePlatformContext to resolve successfully by default
    (requirePlatformContext as any).mockResolvedValue(undefined);
  });

  describe("meta", () => {
    it("should return correct page title", () => {
      const result = meta({
        data: undefined,
        params: {},
        location: {} as any,
        matches: [],
      });

      expect(result).toEqual([{ title: "Organizations - DiveStreams Admin" }]);
    });
  });

  describe("loader", () => {
    const mockOrganizations = [
      {
        id: "org-1",
        name: "Dive Shop One",
        slug: "dive-shop-one",
        logo: "https://example.com/logo1.png",
        createdAt: new Date("2024-01-15T10:00:00Z"),
      },
      {
        id: "org-2",
        name: "Dive Tours Two",
        slug: "dive-tours-two",
        logo: null,
        createdAt: new Date("2024-01-14T15:30:00Z"),
      },
    ];

    beforeEach(() => {
      // Reset db.select mock to default empty implementation
      (db.select as any).mockReset();
    });

    it("should require platform context authentication", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      // Mock empty organization list to avoid further queries
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      // Act
      await loader({ request, params: {}, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should load organizations without search", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: organization query (without search)
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([mockOrganizations[0]]),
          };
        } else if (callCount === 2 || callCount === 5) {
          // Member count queries
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          };
        } else if (callCount === 3 || callCount === 6) {
          // Owner queries
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ email: "owner@example.com" }]),
          };
        } else {
          // Subscription queries
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              { status: "active", plan: "premium" },
            ]),
          };
        }
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations).toHaveLength(1);
      expect(result.search).toBe("");
      expect(result.error).toBeNull();
      expect(result.organizations[0]).toMatchObject({
        id: "org-1",
        name: "Dive Shop One",
        memberCount: 5,
        ownerEmail: "owner@example.com",
        subscriptionStatus: "active",
        subscriptionPlan: "premium",
      });
    });

    it("should load organizations with search query", async () => {
      // Arrange
      const request = new Request(
        "http://admin.divestreams.com?q=dive-shop"
      );

      // Mock with mockReturnThis pattern
      // NOTE: baseQuery is created first but not used when search is present
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // First call: baseQuery creation (not used when search present)
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([]),
          };
        } else if (callCount === 2) {
          // Second call: Organization search query
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "org-1",
                name: "Dive Shop One",
                slug: "dive-shop-one",
                logo: "https://example.com/logo1.png",
                createdAt: new Date("2024-01-15T10:00:00Z"),
              },
            ]),
          };
        } else if (callCount === 3) {
          // Member count: .select().from().where()
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          };
        } else if (callCount === 4) {
          // Owner query: .select().from().where().limit()
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ email: "owner@shop.com" }]),
          };
        } else {
          // Subscription query: .select().from().where().limit()
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              { status: "trialing", plan: "free" },
            ]),
          };
        }
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations).toHaveLength(1);
      expect(result.search).toBe("dive-shop");
      expect(result.organizations[0].slug).toBe("dive-shop-one");
    });

    it("should handle empty organizations list", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const request = new Request("http://admin.divestreams.com");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations).toHaveLength(0);
      expect(result.error).toBeNull();
    });

    it("should return default values when member/owner/sub not found", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      // Mock queries returning empty results
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Organization query
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([mockOrganizations[0]]),
          };
        } else if (callCount === 2) {
          // Member count query returns empty
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]),
          };
        } else {
          // Owner and subscription queries return empty
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations[0]).toMatchObject({
        memberCount: 0,
        ownerEmail: "—",
        subscriptionStatus: "free",
        subscriptionPlan: "free",
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      });

      const request = new Request("http://admin.divestreams.com");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations).toHaveLength(0);
      expect(result.error).toBe(
        "Failed to load organizations. Please check the database connection."
      );
    });

    it("should format createdAt as ISO date string", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      // Mock all detail queries
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([mockOrganizations[0]]),
          };
        } else if (callCount === 2) {
          // Member count
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]),
          };
        } else {
          // Owner and subscription
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations[0].createdAt).toBe("2024-01-15");
    });

    it("should handle authentication failure", async () => {
      // Arrange
      (requirePlatformContext as any).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new Request("http://admin.divestreams.com");

      // Act & Assert
      await expect(
        loader({ request, params: {}, context: {} })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("action", () => {
    it("should require platform context authentication", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("orgId", "org-1");

      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should delete organization when intent is delete", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("orgId", "org-123");

      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      (db.delete as any).mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalledWith({ eq: ["id", "org-123"] });
      expect(result).toEqual({ success: true });
    });

    it("should return null when intent is not delete", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "other");

      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeNull();
      expect(db.delete).not.toHaveBeenCalled();
    });

    it("should return null when orgId is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      // No orgId

      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeNull();
      expect(db.delete).not.toHaveBeenCalled();
    });

    it("should handle authentication failure", async () => {
      // Arrange
      (requirePlatformContext as any).mockRejectedValue(
        new Error("Unauthorized")
      );

      const formData = new FormData();
      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      // Act & Assert
      await expect(
        action({ request, params: {}, context: {} })
      ).rejects.toThrow("Unauthorized");
    });

    it("should handle database delete errors", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("orgId", "org-456");

      const request = new Request("http://admin.divestreams.com", {
        method: "POST",
        body: formData,
      });

      (db.delete as any).mockReturnValue({
        where: vi
          .fn()
          .mockRejectedValue(new Error("Foreign key constraint failed")),
      });

      // Act & Assert
      await expect(
        action({ request, params: {}, context: {} })
      ).rejects.toThrow("Foreign key constraint failed");
    });
  });

  describe("Edge Cases", () => {
    it("should handle organizations with null logo", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com");

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "org-1",
                name: "Test Org",
                slug: "test-org",
                logo: null,
                createdAt: new Date("2024-01-15"),
              },
            ]),
          };
        } else if (callCount === 2) {
          // Member count
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]),
          };
        } else {
          // Owner and subscription
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.organizations[0].logo).toBeNull();
    });

    it("should handle empty search query", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com?q=");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.search).toBe("");
      expect(result.organizations).toHaveLength(0);
    });

    it("should handle whitespace-only search query", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com?q=%20%20");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.search).toBe("  ");
    });
  });
});
