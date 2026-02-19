import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("logger instance", () => {
    it("exports a logger instance", async () => {
      const { logger } = await import("../../../lib/logger");
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("defaults to debug level in non-production", async () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "development";

      const { logger } = await import("../../../lib/logger");
      expect(logger.level).toBe("debug");
    });

    it("defaults to info level in production", async () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "production";

      const { logger } = await import("../../../lib/logger");
      expect(logger.level).toBe("info");
    });

    it("respects LOG_LEVEL environment variable", async () => {
      process.env.LOG_LEVEL = "warn";

      const { logger } = await import("../../../lib/logger");
      expect(logger.level).toBe("warn");
    });
  });

  describe("child loggers", () => {
    it("exports dbLogger with db module", async () => {
      const { dbLogger } = await import("../../../lib/logger");
      expect(dbLogger).toBeDefined();
      expect(typeof dbLogger.info).toBe("function");
    });

    it("exports authLogger with auth module", async () => {
      const { authLogger } = await import("../../../lib/logger");
      expect(authLogger).toBeDefined();
      expect(typeof authLogger.info).toBe("function");
    });

    it("exports stripeLogger with stripe module", async () => {
      const { stripeLogger } = await import("../../../lib/logger");
      expect(stripeLogger).toBeDefined();
      expect(typeof stripeLogger.info).toBe("function");
    });

    it("exports jobLogger with jobs module", async () => {
      const { jobLogger } = await import("../../../lib/logger");
      expect(jobLogger).toBeDefined();
      expect(typeof jobLogger.info).toBe("function");
    });

    it("exports integrationLogger with integrations module", async () => {
      const { integrationLogger } = await import("../../../lib/logger");
      expect(integrationLogger).toBeDefined();
      expect(typeof integrationLogger.info).toBe("function");
    });

    it("exports emailLogger with email module", async () => {
      const { emailLogger } = await import("../../../lib/logger");
      expect(emailLogger).toBeDefined();
      expect(typeof emailLogger.info).toBe("function");
    });

    it("exports storageLogger with storage module", async () => {
      const { storageLogger } = await import("../../../lib/logger");
      expect(storageLogger).toBeDefined();
      expect(typeof storageLogger.info).toBe("function");
    });

    it("exports redisLogger with redis module", async () => {
      const { redisLogger } = await import("../../../lib/logger");
      expect(redisLogger).toBeDefined();
      expect(typeof redisLogger.info).toBe("function");
    });
  });

  describe("Logger type export", () => {
    it("exports Logger type", async () => {
      const loggerModule = await import("../../../lib/logger");
      // Type-level check - if it compiles, the type exists
      const _testType: import("../../../lib/logger").Logger = loggerModule.logger;
      expect(_testType).toBeDefined();
    });
  });
});
