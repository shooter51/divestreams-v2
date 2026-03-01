/**
 * Storage Index Tests
 *
 * Tests for storage module exports.
 */

import { describe, it, expect } from "vitest";

describe("Storage Index", () => {
  describe("Module re-exports", () => {
    it("exports S3 storage functions", async () => {
      const storageModule = await import("../../../../lib/storage");

      // S3 exports
      expect(storageModule.uploadToS3).toBeDefined();
      expect(storageModule.deleteFromS3).toBeDefined();
      expect(storageModule.getImageKey).toBeDefined();
    });

    it("exports image processor functions", async () => {
      const storageModule = await import("../../../../lib/storage");

      // Image processor exports
      expect(storageModule.processImage).toBeDefined();
    });

    it("uploadToS3 is a function", async () => {
      const { uploadToS3 } = await import("../../../../lib/storage");
      expect(typeof uploadToS3).toBe("function");
    });

    it("deleteFromS3 is a function", async () => {
      const { deleteFromS3 } = await import("../../../../lib/storage");
      expect(typeof deleteFromS3).toBe("function");
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
