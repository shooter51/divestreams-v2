/**
 * Admin Contact Messages Route Tests
 *
 * Tests the contact messages admin page loader and component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../app/routes/admin/contact-messages";

// Mock modules
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/public-site", () => ({
  contactMessages: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    email: "email",
    phone: "phone",
    subject: "subject",
    message: "message",
    status: "status",
    createdAt: "createdAt",
    referrerPage: "referrerPage",
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((field) => ({ desc: field })),
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Import mocked modules
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { db } from "../../../../lib/db";

describe("Route: admin/contact-messages.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset requirePlatformContext to resolve successfully by default
    (requirePlatformContext as any).mockResolvedValue(undefined);
  });

  describe("loader", () => {
    const mockMessages = [
      {
        id: "msg-1",
        organizationId: "org-1",
        organizationName: "Org One",
        name: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
        subject: "Question about pricing",
        message: "I have a question about your pricing plans.",
        status: "new",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        referrerPage: "/pricing",
      },
      {
        id: "msg-2",
        organizationId: "org-1",
        organizationName: "Org One",
        name: "Jane Smith",
        email: "jane@example.com",
        phone: null,
        subject: "Support request",
        message: "I need help with my account.",
        status: "read",
        createdAt: new Date("2024-01-14T15:30:00Z"),
        referrerPage: "/contact",
      },
      {
        id: "msg-3",
        organizationId: "org-2",
        organizationName: "Org Two",
        name: "Bob Johnson",
        email: "bob@example.com",
        phone: "555-5678",
        subject: null,
        message: "When will the new features be available?",
        status: "replied",
        createdAt: new Date("2024-01-13T09:15:00Z"),
        referrerPage: null,
      },
    ];

    beforeEach(() => {
      // Setup default mock for database query chain
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockMessages),
            }),
          }),
        }),
      });
    });

    it("should require platform context authentication", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      await loader({ request, params: {}, context: {} });

      // Assert
      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("should load all contact messages with stats", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages).toHaveLength(3);
      expect(result.stats).toEqual({
        total: 3,
        new: 1,
        read: 1,
        replied: 1,
      });
    });

    it("should return messages with organization names from join", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages[0].organizationName).toBe("Org One");
      expect(result.messages[1].organizationName).toBe("Org One");
      expect(result.messages[2].organizationName).toBe("Org Two");
    });

    it("should handle empty messages list", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages).toHaveLength(0);
      expect(result.stats).toEqual({
        total: 0,
        new: 0,
        read: 0,
        replied: 0,
      });
    });

    it("should calculate stats correctly for various statuses", async () => {
      // Arrange
      const mixedStatusMessages = [
        { ...mockMessages[0], status: "new" },
        { ...mockMessages[1], status: "new" },
        { ...mockMessages[2], status: "read" },
        { id: "msg-4", status: "replied" } as any,
        { id: "msg-5", status: "replied" } as any,
        { id: "msg-6", status: "archived" } as any,
        { id: "msg-7", status: "spam" } as any,
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mixedStatusMessages),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stats).toEqual({
        total: 7,
        new: 2,
        read: 1,
        replied: 2,
      });
    });

    it("should limit results to 100 messages", async () => {
      // Arrange
      const limitFn = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: limitFn,
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      await loader({ request, params: {}, context: {} });

      // Assert
      expect(limitFn).toHaveBeenCalledWith(100);
    });

    it("should handle null organization names (orphaned messages)", async () => {
      // Arrange
      const orphanedMessages = [
        {
          ...mockMessages[0],
          organizationName: null,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(orphanedMessages),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages[0].organizationName).toBeNull();
      expect(result.messages).toHaveLength(1);
    });

    it("should handle authentication failure", async () => {
      // Arrange
      (requirePlatformContext as any).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act & Assert
      await expect(
        loader({ request, params: {}, context: {} })
      ).rejects.toThrow("Unauthorized");
    });

    it("should handle database errors", async () => {
      // Arrange
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("Database connection failed")),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act & Assert
      await expect(
        loader({ request, params: {}, context: {} })
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("Edge Cases", () => {
    it("should handle messages with all nullable fields as null", async () => {
      // Arrange
      const minimalMessage = {
        id: "msg-minimal",
        organizationId: "org-1",
        organizationName: null,
        name: "Minimal User",
        email: "minimal@example.com",
        phone: null,
        subject: null,
        message: "Test message",
        status: "new",
        createdAt: new Date("2024-01-15T10:00:00Z"),
        referrerPage: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([minimalMessage]),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages[0]).toEqual(minimalMessage);
      expect(result.stats.total).toBe(1);
    });

    it("should handle status not in predefined list", async () => {
      // Arrange
      const unknownStatusMessage = {
        id: "msg-unknown",
        organizationId: "org-1",
        organizationName: "Org One",
        name: "User",
        email: "user@example.com",
        phone: null,
        subject: null,
        message: "Test",
        status: "unknown-status",
        createdAt: new Date(),
        referrerPage: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([unknownStatusMessage]),
            }),
          }),
        }),
      });

      const request = new Request("http://admin.divestreams.com/contact-messages");

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.messages[0].status).toBe("unknown-status");
      // Stats should still work (counts won't include unknown status)
      expect(result.stats.new).toBe(0);
      expect(result.stats.read).toBe(0);
      expect(result.stats.replied).toBe(0);
    });
  });
});
