/**
 * Storage Index Tests
 *
 * Tests for storage module exports.
 */

import { describe, it, expect } from "vitest";

describe("Storage Index", () => {
  describe("Module re-exports", () => {
    it("exports B2 storage functions", async () => {
      const storageModule = await import("../../../../lib/storage");

      // B2 exports (using native B2 SDK, not S3 client)
      expect(storageModule.uploadToB2).toBeDefined();
      expect(storageModule.deleteFromB2).toBeDefined();
      expect(storageModule.getImageKey).toBeDefined();
    });

    it("exports image processor functions", async () => {
      const storageModule = await import("../../../../lib/storage");

      // Image processor exports
      expect(storageModule.processImage).toBeDefined();
    });

    it("uploadToB2 is a function", async () => {
      const { uploadToB2 } = await import("../../../../lib/storage");
      expect(typeof uploadToB2).toBe("function");
    });

    it("deleteFromB2 is a function", async () => {
      const { deleteFromB2 } = await import("../../../../lib/storage");
      expect(typeof deleteFromB2).toBe("function");
    });

    it("getImageKey is a function", async () => {
      const { getImageKey } = await import("../../../../lib/storage");
      expect(typeof getImageKey).toBe("function");
    });

    it("processImage is a function", async () => {
      const { processImage } = await import("../../../../lib/storage");
      expect(typeof processImage).toBe("function");
    });
  });
});
