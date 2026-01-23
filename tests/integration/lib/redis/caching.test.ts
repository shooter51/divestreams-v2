/**
 * Redis Caching Integration Tests
 *
 * Tests Redis caching operations, session management,
 * and cache invalidation strategies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import IORedis from "ioredis";

describe("Redis Caching", () => {
  let redis: IORedis;

  beforeEach(async () => {
    // Create test Redis connection
    redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      db: 1, // Use separate database for tests
    });

    // Clear test database
    await redis.flushdb();
  });

  afterEach(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  describe("Basic Cache Operations", () => {
    it("should set and get cache values", async () => {
      await redis.set("test:key", "test value");
      const value = await redis.get("test:key");

      expect(value).toBe("test value");
    });

    it("should handle cache expiration", async () => {
      await redis.set("test:expiring", "will expire", "EX", 1);

      // Should exist immediately
      let value = await redis.get("test:expiring");
      expect(value).toBe("will expire");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be gone
      value = await redis.get("test:expiring");
      expect(value).toBeNull();
    });

    it("should support JSON caching", async () => {
      const data = {
        id: "123",
        name: "Test Customer",
        bookings: [1, 2, 3],
      };

      await redis.set("test:json", JSON.stringify(data));
      const cached = await redis.get("test:json");
      const parsed = JSON.parse(cached!);

      expect(parsed).toEqual(data);
    });

    it("should handle cache misses gracefully", async () => {
      const value = await redis.get("nonexistent:key");
      expect(value).toBeNull();
    });
  });

  describe("Session Management", () => {
    it("should store and retrieve session data", async () => {
      const sessionId = "sess:user-123";
      const sessionData = {
        userId: "user-123",
        organizationId: "org-abc",
        role: "owner",
        expiresAt: Date.now() + 3600000,
      };

      await redis.set(sessionId, JSON.stringify(sessionData), "EX", 3600);
      const cached = await redis.get(sessionId);
      const parsed = JSON.parse(cached!);

      expect(parsed.userId).toBe("user-123");
      expect(parsed.organizationId).toBe("org-abc");
    });

    it("should invalidate expired sessions", async () => {
      const sessionId = "sess:user-456";
      const sessionData = {
        userId: "user-456",
        token: "abc123",
      };

      // Set with 1 second expiration
      await redis.set(sessionId, JSON.stringify(sessionData), "EX", 1);

      // Should exist
      let session = await redis.get(sessionId);
      expect(session).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      session = await redis.get(sessionId);
      expect(session).toBeNull();
    });

    it("should support session refresh", async () => {
      const sessionId = "sess:user-789";
      const sessionData = { userId: "user-789" };

      await redis.set(sessionId, JSON.stringify(sessionData), "EX", 3600);

      // Get TTL
      const ttl1 = await redis.ttl(sessionId);
      expect(ttl1).toBeGreaterThan(0);

      // Refresh session
      await redis.expire(sessionId, 7200);

      // TTL should be updated
      const ttl2 = await redis.ttl(sessionId);
      expect(ttl2).toBeGreaterThan(ttl1);
    });

    it("should handle concurrent session updates", async () => {
      const sessionId = "sess:concurrent";

      const operations = Array.from({ length: 10 }, (_, i) =>
        redis.set(sessionId, JSON.stringify({ counter: i }))
      );

      await Promise.all(operations);

      // Should have one of the values
      const final = await redis.get(sessionId);
      const parsed = JSON.parse(final!);
      expect(parsed).toHaveProperty("counter");
      expect(typeof parsed.counter).toBe("number");
    });
  });

  describe("Organization-Scoped Caching", () => {
    it("should cache organization-specific data", async () => {
      const orgId = "org-test-123";
      const cacheKey = `org:${orgId}:customers`;
      const customers = [
        { id: "1", name: "Customer 1" },
        { id: "2", name: "Customer 2" },
      ];

      await redis.set(cacheKey, JSON.stringify(customers), "EX", 300);
      const cached = await redis.get(cacheKey);
      const parsed = JSON.parse(cached!);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Customer 1");
    });

    it("should isolate cache between organizations", async () => {
      const org1Key = "org:org1:data";
      const org2Key = "org:org2:data";

      await redis.set(org1Key, JSON.stringify({ org: "org1" }));
      await redis.set(org2Key, JSON.stringify({ org: "org2" }));

      const org1Data = JSON.parse((await redis.get(org1Key))!);
      const org2Data = JSON.parse((await redis.get(org2Key))!);

      expect(org1Data.org).toBe("org1");
      expect(org2Data.org).toBe("org2");
    });

    it("should invalidate organization cache", async () => {
      const orgId = "org-invalidate";
      const keys = [
        `org:${orgId}:customers`,
        `org:${orgId}:bookings`,
        `org:${orgId}:trips`,
      ];

      // Set multiple keys
      for (const key of keys) {
        await redis.set(key, JSON.stringify({ data: "test" }));
      }

      // Verify they exist
      for (const key of keys) {
        const value = await redis.get(key);
        expect(value).not.toBeNull();
      }

      // Invalidate all org keys
      const pattern = `org:${orgId}:*`;
      const orgKeys = await redis.keys(pattern);
      if (orgKeys.length > 0) {
        await redis.del(...orgKeys);
      }

      // Verify they're gone
      for (const key of keys) {
        const value = await redis.get(key);
        expect(value).toBeNull();
      }
    });
  });

  describe("List and Set Operations", () => {
    it("should handle list operations", async () => {
      const listKey = "test:list";

      // Add items
      await redis.rpush(listKey, "item1", "item2", "item3");

      // Get length
      const length = await redis.llen(listKey);
      expect(length).toBe(3);

      // Get range
      const items = await redis.lrange(listKey, 0, -1);
      expect(items).toEqual(["item1", "item2", "item3"]);

      // Pop item
      const popped = await redis.lpop(listKey);
      expect(popped).toBe("item1");

      // Verify length
      const newLength = await redis.llen(listKey);
      expect(newLength).toBe(2);
    });

    it("should handle set operations", async () => {
      const setKey = "test:set";

      // Add members
      await redis.sadd(setKey, "member1", "member2", "member3");

      // Get cardinality
      const count = await redis.scard(setKey);
      expect(count).toBe(3);

      // Check membership
      const isMember = await redis.sismember(setKey, "member2");
      expect(isMember).toBe(1);

      // Get all members
      const members = await redis.smembers(setKey);
      expect(members).toHaveLength(3);
      expect(members).toContain("member2");

      // Remove member
      await redis.srem(setKey, "member2");
      const newCount = await redis.scard(setKey);
      expect(newCount).toBe(2);
    });

    it("should handle sorted set operations", async () => {
      const zsetKey = "test:zset";

      // Add scored members
      await redis.zadd(zsetKey, 100, "item1", 200, "item2", 150, "item3");

      // Get count
      const count = await redis.zcard(zsetKey);
      expect(count).toBe(3);

      // Get range by score
      const range = await redis.zrangebyscore(zsetKey, 100, 200);
      expect(range).toEqual(["item1", "item3", "item2"]);

      // Get rank
      const rank = await redis.zrank(zsetKey, "item2");
      expect(rank).toBe(2); // Highest score

      // Increment score
      await redis.zincrby(zsetKey, 50, "item1");
      const newScore = await redis.zscore(zsetKey, "item1");
      expect(newScore).toBe("150");
    });
  });

  describe("Hash Operations", () => {
    it("should handle hash operations", async () => {
      const hashKey = "test:hash";

      // Set fields
      await redis.hset(hashKey, "field1", "value1", "field2", "value2");

      // Get field
      const value = await redis.hget(hashKey, "field1");
      expect(value).toBe("value1");

      // Get all fields
      const all = await redis.hgetall(hashKey);
      expect(all).toEqual({
        field1: "value1",
        field2: "value2",
      });

      // Check field exists
      const exists = await redis.hexists(hashKey, "field1");
      expect(exists).toBe(1);

      // Delete field
      await redis.hdel(hashKey, "field1");
      const deleted = await redis.hexists(hashKey, "field1");
      expect(deleted).toBe(0);
    });

    it("should handle hash counters", async () => {
      const hashKey = "test:counters";

      // Increment
      await redis.hincrby(hashKey, "counter1", 1);
      await redis.hincrby(hashKey, "counter1", 5);

      const value = await redis.hget(hashKey, "counter1");
      expect(value).toBe("6");

      // Increment float
      await redis.hincrbyfloat(hashKey, "float1", 1.5);
      await redis.hincrbyfloat(hashKey, "float1", 2.3);

      const floatValue = await redis.hget(hashKey, "float1");
      expect(parseFloat(floatValue!)).toBeCloseTo(3.8);
    });
  });

  describe("Cache Patterns", () => {
    it("should implement cache-aside pattern", async () => {
      const cacheKey = "cache:customer:123";
      const dbData = { id: "123", name: "John Doe", email: "john@example.com" };

      // Simulate cache miss
      let cached = await redis.get(cacheKey);
      expect(cached).toBeNull();

      // Simulate DB fetch and cache
      await redis.set(cacheKey, JSON.stringify(dbData), "EX", 300);

      // Cache hit
      cached = await redis.get(cacheKey);
      const data = JSON.parse(cached!);
      expect(data.name).toBe("John Doe");
    });

    it("should implement write-through cache", async () => {
      const cacheKey = "cache:customer:456";
      const updatedData = { id: "456", name: "Jane Smith", email: "jane@example.com" };

      // Simulate write to both DB and cache
      // DB write would happen here in real scenario
      await redis.set(cacheKey, JSON.stringify(updatedData), "EX", 300);

      // Verify cache is updated
      const cached = await redis.get(cacheKey);
      const data = JSON.parse(cached!);
      expect(data.name).toBe("Jane Smith");
    });

    it("should implement cache with fallback", async () => {
      const cacheKey = "cache:unavailable:data";

      // Try cache
      let data = await redis.get(cacheKey);

      if (!data) {
        // Fallback to DB (simulated)
        const dbData = { id: "fallback", source: "database" };
        data = JSON.stringify(dbData);
        await redis.set(cacheKey, data, "EX", 60);
      }

      const parsed = JSON.parse(data);
      expect(parsed.source).toBe("database");
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle high throughput operations", async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(redis.set(`perf:key:${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // Verify all keys were set
      const keys = await redis.keys("perf:key:*");
      expect(keys).toHaveLength(100);
    });

    it("should handle pipeline operations", async () => {
      const pipeline = redis.pipeline();

      for (let i = 0; i < 50; i++) {
        pipeline.set(`pipeline:key:${i}`, `value${i}`);
      }

      const results = await pipeline.exec();
      expect(results).toHaveLength(50);

      // Verify keys exist
      const keys = await redis.keys("pipeline:key:*");
      expect(keys).toHaveLength(50);
    });

    it("should handle atomic operations", async () => {
      const counterKey = "atomic:counter";

      // Initialize counter
      await redis.set(counterKey, "0");

      // Concurrent increments
      const increments = Array.from({ length: 50 }, () => redis.incr(counterKey));

      await Promise.all(increments);

      // Counter should be exactly 50
      const final = await redis.get(counterKey);
      expect(final).toBe("50");
    });
  });
});
