/**
 * Health API Route Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing the loader
vi.mock("../../../../lib/redis.server", () => ({
  getRedisConnection: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue("PONG"),
  })),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  sql: vi.fn((strings, ...values) => ({
    strings,
    values,
    op: "sql",
  })),
}));

import { loader } from "../../../../app/routes/api/health";

describe("Health API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns ok status", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      const data = await response.json();

      expect(data.status).toBe("ok");
    });

    it("returns timestamp", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const before = new Date().toISOString();
      const response = await loader({ request, params: {}, context: {} });
      const after = new Date().toISOString();

      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(data.timestamp >= before).toBe(true);
      expect(data.timestamp <= after).toBe(true);
    });

    it("returns version", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      const data = await response.json();

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe("string");
    });

    it("returns JSON content type", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });
});
