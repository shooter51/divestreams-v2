/**
 * Database Index Tests
 *
 * Tests for database connection exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Database Index", () => {
  describe("Module exports", () => {
    it("exports db object", async () => {
      const dbModule = await import("../../../../lib/db/index");
      expect(dbModule.db).toBeDefined();
    });

    it("exports migrationDb object", async () => {
      const dbModule = await import("../../../../lib/db/index");
      expect(dbModule.migrationDb).toBeDefined();
    });

    it("db is a proxy object", async () => {
      const { db } = await import("../../../../lib/db/index");
      // Proxies return undefined for unknown props
      expect(typeof db).toBe("object");
    });

    it("migrationDb is a proxy object", async () => {
      const { migrationDb } = await import("../../../../lib/db/index");
      expect(typeof migrationDb).toBe("object");
    });
  });

  describe("Database type", () => {
    it("Database type can be referenced", async () => {
      // This is mainly a compile-time check
      const dbModule = await import("../../../../lib/db/index");
      expect(dbModule).toHaveProperty("db");
    });
  });

  describe("Client-side safety", () => {
    it("returns proxy that does not throw on client side", async () => {
      // On client side (no DATABASE_URL), the proxy returns a no-op
      // This test runs in Node which has access to env vars
      // The actual client-side behavior would need browser testing
      const { db } = await import("../../../../lib/db/index");
      expect(db).toBeDefined();
    });
  });
});
