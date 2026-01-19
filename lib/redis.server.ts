/**
 * Redis Connection Helper
 *
 * Provides a shared Redis connection for BullMQ queues and workers.
 * Uses ioredis for Redis operations.
 */

import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";

let redisClient: IORedis | null = null;

/**
 * Get or create Redis connection
 * Singleton pattern to reuse connection across modules
 */
export function getRedisConnection(): IORedis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    redisClient.on("connect", () => {
      console.log("Redis connected");
    });
  }

  return redisClient;
}

/**
 * Get Redis connection as BullMQ ConnectionOptions
 * Required for BullMQ Queue and Worker constructors
 */
export function getBullMQConnection(): ConnectionOptions {
  return getRedisConnection() as unknown as ConnectionOptions;
}

/**
 * Close Redis connection
 * Call during graceful shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
