import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/admin/contact-messages";

// Mock the platform-context module
vi.mock("../../../../lib/auth/platform-context.server", () => ({
  requirePlatformContext: vi.fn(),
}));

// Mock the database module
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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
  organization: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
}));

import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { db } from "../../../../lib/db";

describe("admin/contact-messages route", () => {
  const mockPlatformContext = {
    user: { id: "user-1", name: "Admin", email: "admin@example.com" },
    session: { id: "session-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("requires platform context", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      (db.limit as Mock).mockResolvedValue([]);

      const request = new Request("https://admin.divestreams.com/contact-messages");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requirePlatformContext).toHaveBeenCalledWith(request);
    });

    it("throws when platform context fails", async () => {
      (requirePlatformContext as Mock).mockRejectedValue(new Response(null, { status: 401 }));

      await expect(
        loader({
          request: new Request("https://admin.divestreams.com/contact-messages"),
          params: {},
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 401 }));
    });

    it("returns messages and stats", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      const mockMessages = [
        { id: "m1", organizationId: "org-1", organizationName: "Shop A", name: "John", email: "john@example.com", phone: "555-1234", subject: "Inquiry", message: "Hello", status: "new", createdAt: new Date(), referrerPage: "/contact" },
        { id: "m2", organizationId: "org-1", organizationName: "Shop A", name: "Jane", email: "jane@example.com", phone: null, subject: null, message: "Hi there", status: "read", createdAt: new Date(), referrerPage: null },
        { id: "m3", organizationId: "org-2", organizationName: "Shop B", name: "Bob", email: "bob@example.com", phone: null, subject: "Question", message: "Help", status: "replied", createdAt: new Date(), referrerPage: "/about" },
      ];
      (db.limit as Mock).mockResolvedValue(mockMessages);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/contact-messages"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.messages).toEqual(mockMessages);
      expect(result.stats.total).toBe(3);
      expect(result.stats.new).toBe(1);
      expect(result.stats.read).toBe(1);
      expect(result.stats.replied).toBe(1);
    });

    it("returns empty stats when no messages", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      (db.limit as Mock).mockResolvedValue([]);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/contact-messages"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.messages).toEqual([]);
      expect(result.stats).toEqual({ total: 0, new: 0, read: 0, replied: 0 });
    });

    it("correctly counts multiple messages with same status", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      const mockMessages = [
        { id: "m1", status: "new", name: "A", email: "a@test.com", message: "1" },
        { id: "m2", status: "new", name: "B", email: "b@test.com", message: "2" },
        { id: "m3", status: "new", name: "C", email: "c@test.com", message: "3" },
        { id: "m4", status: "read", name: "D", email: "d@test.com", message: "4" },
        { id: "m5", status: "replied", name: "E", email: "e@test.com", message: "5" },
        { id: "m6", status: "replied", name: "F", email: "f@test.com", message: "6" },
      ];
      (db.limit as Mock).mockResolvedValue(mockMessages);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/contact-messages"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.stats.total).toBe(6);
      expect(result.stats.new).toBe(3);
      expect(result.stats.read).toBe(1);
      expect(result.stats.replied).toBe(2);
    });

    it("does not count archived or spam statuses in named stats", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      const mockMessages = [
        { id: "m1", status: "archived", name: "A", email: "a@test.com", message: "1" },
        { id: "m2", status: "spam", name: "B", email: "b@test.com", message: "2" },
      ];
      (db.limit as Mock).mockResolvedValue(mockMessages);

      const result = await loader({
        request: new Request("https://admin.divestreams.com/contact-messages"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.stats.total).toBe(2);
      expect(result.stats.new).toBe(0);
      expect(result.stats.read).toBe(0);
      expect(result.stats.replied).toBe(0);
    });

    it("calls db.select to fetch messages", async () => {
      (requirePlatformContext as Mock).mockResolvedValue(mockPlatformContext);
      (db.limit as Mock).mockResolvedValue([]);

      await loader({
        request: new Request("https://admin.divestreams.com/contact-messages"),
        params: {},
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.leftJoin).toHaveBeenCalled();
      expect(db.orderBy).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(100);
    });
  });
});
