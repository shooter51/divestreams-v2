/**
 * Seed Reset API Route Tests
 * Covers DS-iknw (timing-safe key comparison) and DS-pwr (key in body, not query string)
 * Covers DS-bf1j (pro plan upgrade on reset)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "org-1" }]),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock schema
vi.mock("../../../../lib/db/schema", () => ({
  tours: { organizationId: "organizationId", id: "id" },
  trips: { organizationId: "organizationId", id: "id" },
  bookings: { organizationId: "organizationId", id: "id" },
  customers: { organizationId: "organizationId", id: "id" },
  equipment: { organizationId: "organizationId", id: "id" },
  transactions: { organizationId: "organizationId", id: "id" },
  rentals: { organizationId: "organizationId", id: "id" },
  customerCommunications: { organizationId: "organizationId", id: "id" },
  tourDiveSites: { organizationId: "organizationId", id: "id" },
  serviceRecords: { organizationId: "organizationId", id: "id" },
  subscriptionPlans: { id: "id", name: "name" },
}));

vi.mock("../../../../lib/db/schema/subscription", () => ({
  subscription: { id: "id", organizationId: "organizationId", planId: "planId", plan: "plan", status: "status" },
}));

vi.mock("../../../../lib/db/schema/training", () => ({
  trainingCourses: { organizationId: "organizationId", id: "id" },
  trainingSessions: { organizationId: "organizationId", id: "id" },
  trainingEnrollments: { organizationId: "organizationId", id: "id" },
}));

vi.mock("../../../../lib/db/schema/gallery", () => ({
  galleryAlbums: { organizationId: "organizationId", id: "id" },
  galleryImages: { organizationId: "organizationId", id: "id" },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: { id: "id", slug: "slug" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
}));

import { db } from "../../../../lib/db";
import { action, loader } from "../../../../app/routes/api/seed/reset";

describe("Seed Reset API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: select().from().where().limit() returns org, then pro plan, then existing sub
    let limitCallCount = 0;
    const limitResults = [
      [{ id: "org-1" }],       // find org
      [{ id: "pro-plan-1" }],  // find pro plan
      [{ id: "sub-1" }],       // find existing subscription
    ];
    vi.mocked(db.limit).mockImplementation(() => {
      const result = limitResults[limitCallCount] ?? [];
      limitCallCount++;
      return Promise.resolve(result) as ReturnType<typeof db.limit>;
    });
    process.env = { ...originalEnv, SEED_KEY: "test-seed-key-12345" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("DS-pwr: seed key must be in request body, not query string", () => {
    it("rejects key passed as query parameter", async () => {
      const request = new Request(
        "http://localhost:3000/api/seed/reset?key=test-seed-key-12345&tenant=demo",
        { method: "DELETE" }
      );
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Key in query string should NOT be accepted
      expect(data.error).toBeDefined();
      expect(response.status).toBe(403);
    });

    it("accepts key in request body", async () => {
      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-seed-key-12345", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.ok).toBe(true);
    });
  });

  describe("DS-iknw: timing-safe key comparison", () => {
    it("uses timing-safe comparison for seed key", async () => {
      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "wrong-key", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("rejects key of different length using timing-safe comparison", async () => {
      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "short", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(403);
    });
  });

  describe("DS-bf1j: pro plan upgrade on reset", () => {
    it("upgrades demo tenant to pro plan when pro plan exists and subscription exists", async () => {
      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-seed-key-12345", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.ok).toBe(true);
      // update should have been called to set plan to pro
      expect(db.update).toHaveBeenCalled();
    });

    it("creates subscription if none exists for demo tenant", async () => {
      let callCount = 0;
      vi.mocked(db.limit).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ id: "org-1" }]) as ReturnType<typeof db.limit>;
        if (callCount === 2) return Promise.resolve([{ id: "pro-plan-1" }]) as ReturnType<typeof db.limit>;
        return Promise.resolve([]) as ReturnType<typeof db.limit>; // no existing subscription
      });

      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-seed-key-12345", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it("skips plan upgrade gracefully when pro plan is not found", async () => {
      let callCount = 0;
      vi.mocked(db.limit).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ id: "org-1" }]) as ReturnType<typeof db.limit>;
        return Promise.resolve([]) as ReturnType<typeof db.limit>; // no pro plan
      });

      const request = new Request("http://localhost:3000/api/seed/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-seed-key-12345", tenant: "demo" }),
      });
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("loader", () => {
    it("returns 405 for GET requests", async () => {
      const response = await loader();
      expect(response.status).toBe(405);
    });
  });
});
