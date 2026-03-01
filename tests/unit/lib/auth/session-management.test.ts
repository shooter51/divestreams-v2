import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
const mockFrom = vi.fn();
const mockWhere = vi.fn();

vi.mock("../../../../lib/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    delete: () => ({ where: mockWhere }),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  session: {
    userId: "userId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  sql: vi.fn(),
}));

describe("session-management.server", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("invalidateUserSessions", () => {
    it("returns 0 when user has no sessions", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) });
      mockWhere.mockResolvedValue([]);

      const { invalidateUserSessions } = await import(
        "../../../../lib/auth/session-management.server"
      );
      const count = await invalidateUserSessions("user-123");
      expect(count).toBe(0);
    });

    it("returns count of invalidated sessions", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) });
      mockWhere.mockResolvedValue([]);

      const { invalidateUserSessions } = await import(
        "../../../../lib/auth/session-management.server"
      );
      const count = await invalidateUserSessions("user-456");
      expect(count).toBe(3);
    });

    it("handles missing count result gracefully", async () => {
      mockFrom.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      mockWhere.mockResolvedValue([]);

      const { invalidateUserSessions } = await import(
        "../../../../lib/auth/session-management.server"
      );
      const count = await invalidateUserSessions("user-789");
      expect(count).toBe(0);
    });
  });
});
