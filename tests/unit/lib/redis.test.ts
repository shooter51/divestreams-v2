import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

const mockOn = vi.fn();
const mockQuit = vi.fn().mockResolvedValue("OK");
const mockIORedisInstance = {
  on: mockOn,
  quit: mockQuit,
};

// Create a mock class that can be used with `new`
const MockIORedisClass = vi.fn().mockImplementation(function (this: any) {
  Object.assign(this, mockIORedisInstance);
  return this;
});

vi.mock("ioredis", () => ({
  default: MockIORedisClass,
}));

vi.mock("../../../lib/logger", () => ({
  redisLogger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("redis.server", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("getRedisConnection", () => {
    it("creates a new Redis connection", async () => {
      const { getRedisConnection } = await import("../../../lib/redis.server");
      const conn = getRedisConnection();
      expect(conn).toBeDefined();
      expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
    });

    it("returns same connection on subsequent calls (singleton)", async () => {
      const { getRedisConnection } = await import("../../../lib/redis.server");
      const conn1 = getRedisConnection();
      const conn2 = getRedisConnection();
      expect(conn1).toBe(conn2);
    });

    it("uses REDIS_URL env var when set", async () => {
      process.env.REDIS_URL = "redis://custom-host:6380";

      const { getRedisConnection } = await import("../../../lib/redis.server");
      getRedisConnection();

      expect(MockIORedisClass).toHaveBeenCalledWith(
        "redis://custom-host:6380",
        expect.objectContaining({
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        })
      );
    });

    it("defaults to localhost:6379 when REDIS_URL not set", async () => {
      delete process.env.REDIS_URL;

      const { getRedisConnection } = await import("../../../lib/redis.server");
      getRedisConnection();

      expect(MockIORedisClass).toHaveBeenCalledWith(
        "redis://localhost:6379",
        expect.any(Object)
      );
    });

    it("has retry strategy with exponential backoff capped at 2000ms", async () => {
      const { getRedisConnection } = await import("../../../lib/redis.server");
      getRedisConnection();

      const callArgs = MockIORedisClass.mock.calls[0][1];
      const retryStrategy = callArgs.retryStrategy;

      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(10)).toBe(500);
      expect(retryStrategy(100)).toBe(2000);
      expect(retryStrategy(1000)).toBe(2000);
    });

    it("logs error on Redis error event", async () => {
      const { getRedisConnection } = await import("../../../lib/redis.server");
      getRedisConnection();

      // Find the error handler
      const errorHandler = mockOn.mock.calls.find(
        (call) => call[0] === "error"
      )?.[1];
      expect(errorHandler).toBeDefined();

      const { redisLogger } = await import("../../../lib/logger");
      const testError = new Error("connection failed");
      errorHandler(testError);
      expect(redisLogger.error).toHaveBeenCalledWith(
        { err: testError },
        "Redis connection error"
      );
    });

    it("logs info on Redis connect event", async () => {
      const { getRedisConnection } = await import("../../../lib/redis.server");
      getRedisConnection();

      const connectHandler = mockOn.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      expect(connectHandler).toBeDefined();

      const { redisLogger } = await import("../../../lib/logger");
      connectHandler();
      expect(redisLogger.info).toHaveBeenCalledWith("Redis connected");
    });
  });

  describe("getBullMQConnection", () => {
    it("returns Redis connection as ConnectionOptions", async () => {
      const { getBullMQConnection } = await import("../../../lib/redis.server");
      const conn = getBullMQConnection();
      expect(conn).toBeDefined();
    });
  });

  describe("closeRedisConnection", () => {
    it("calls quit on existing connection", async () => {
      const { getRedisConnection, closeRedisConnection } = await import(
        "../../../lib/redis.server"
      );
      getRedisConnection(); // Create connection
      await closeRedisConnection();
      expect(mockQuit).toHaveBeenCalled();
    });

    it("does nothing if no connection exists", async () => {
      const { closeRedisConnection } = await import("../../../lib/redis.server");
      await closeRedisConnection();
      expect(mockQuit).not.toHaveBeenCalled();
    });

    it("allows creating new connection after close", async () => {
      const { getRedisConnection, closeRedisConnection } = await import(
        "../../../lib/redis.server"
      );
      getRedisConnection();
      await closeRedisConnection();

      // After closing, a new getRedisConnection should create a fresh one
      const newConn = getRedisConnection();
      expect(newConn).toBeDefined();
    });
  });
});
