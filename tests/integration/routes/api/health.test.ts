import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/api/health";

/**
 * Integration tests for api/health route
 * Tests actual HTTP loader behavior with DB and Redis mocks
 *
 * Note: The health endpoint was hardened to only expose { status }
 * without internal infrastructure details (checks, version, timestamp).
 */

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Mock Redis
vi.mock("../../../../lib/redis.server", () => ({
  getRedisConnection: vi.fn(),
}));

import { db } from "../../../../lib/db";
import { getRedisConnection } from "../../../../lib/redis.server";

describe("api/health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/health", () => {
    it("returns 200 with ok status when all checks pass", async () => {
      // Mock successful DB check
      (db.execute as Mock).mockResolvedValue([]);

      // Mock successful Redis check
      const mockRedis = { ping: vi.fn().mockResolvedValue("PONG") };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
      // Hardened endpoint does not expose checks, version, or timestamp
      expect(data.checks).toBeUndefined();
      expect(data.version).toBeUndefined();
      expect(data.timestamp).toBeUndefined();
    });

    it("returns 503 with degraded status when database fails", async () => {
      // Mock DB failure
      (db.execute as Mock).mockRejectedValue(new Error("Connection refused"));

      // Mock successful Redis check
      const mockRedis = { ping: vi.fn().mockResolvedValue("PONG") };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
    });

    it("returns 503 with degraded status when Redis fails", async () => {
      // Mock successful DB check
      (db.execute as Mock).mockResolvedValue([]);

      // Mock Redis failure
      const mockRedis = { ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
    });

    it("returns 503 with degraded status when both services fail", async () => {
      // Mock DB failure
      (db.execute as Mock).mockRejectedValue(new Error("Connection refused"));

      // Mock Redis failure
      const mockRedis = { ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
    });

    it("only exposes status field (no internal details)", async () => {
      (db.execute as Mock).mockResolvedValue([]);
      const mockRedis = { ping: vi.fn().mockResolvedValue("PONG") };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      const data = await response.json();
      // Only "status" key should be present
      expect(Object.keys(data)).toEqual(["status"]);
    });

    it("executes SELECT 1 query for database health check", async () => {
      const executeMock = vi.fn().mockResolvedValue([]);
      (db.execute as Mock).mockImplementation(executeMock);

      const mockRedis = { ping: vi.fn().mockResolvedValue("PONG") };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      await loader({ request, params: {}, context: {} } as unknown);

      expect(executeMock).toHaveBeenCalled();
    });

    it("calls Redis ping for Redis health check", async () => {
      (db.execute as Mock).mockResolvedValue([]);

      const pingMock = vi.fn().mockResolvedValue("PONG");
      const mockRedis = { ping: pingMock };
      (getRedisConnection as Mock).mockReturnValue(mockRedis);

      const request = new Request("https://divestreams.com/api/health");
      await loader({ request, params: {}, context: {} } as unknown);

      expect(pingMock).toHaveBeenCalled();
    });
  });
});
