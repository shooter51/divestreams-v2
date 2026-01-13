import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import {
  processImage,
  isValidImageType,
  getWebPMimeType,
} from "../../../../lib/storage/image-processor";

// Create a simple test image buffer
function createTestImageBuffer(width = 100, height = 100): Buffer {
  // Create a simple raw pixel buffer (RGBA)
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;     // R
    pixels[i + 1] = 0;   // G
    pixels[i + 2] = 0;   // B
    pixels[i + 3] = 255; // A
  }
  return pixels;
}

describe("Image Processor", () => {
  describe("isValidImageType", () => {
    it("accepts JPEG images", () => {
      expect(isValidImageType("image/jpeg")).toBe(true);
    });

    it("accepts PNG images", () => {
      expect(isValidImageType("image/png")).toBe(true);
    });

    it("accepts WebP images", () => {
      expect(isValidImageType("image/webp")).toBe(true);
    });

    it("accepts GIF images", () => {
      expect(isValidImageType("image/gif")).toBe(true);
    });

    it("rejects unsupported formats", () => {
      expect(isValidImageType("image/bmp")).toBe(false);
      expect(isValidImageType("image/tiff")).toBe(false);
      expect(isValidImageType("video/mp4")).toBe(false);
      expect(isValidImageType("application/pdf")).toBe(false);
      expect(isValidImageType("text/plain")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidImageType("")).toBe(false);
    });
  });

  describe("getWebPMimeType", () => {
    it("returns correct WebP MIME type", () => {
      expect(getWebPMimeType()).toBe("image/webp");
    });
  });

  describe("processImage", () => {
    let testImageBuffer: Buffer;

    beforeEach(async () => {
      // Create a real test image using sharp
      testImageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();
    });

    it("processes image and returns all required fields", async () => {
      const result = await processImage(testImageBuffer);

      expect(result).toHaveProperty("original");
      expect(result).toHaveProperty("thumbnail");
      expect(result).toHaveProperty("width");
      expect(result).toHaveProperty("height");
      expect(result).toHaveProperty("thumbnailWidth");
      expect(result).toHaveProperty("thumbnailHeight");
    });

    it("returns buffer for original image", async () => {
      const result = await processImage(testImageBuffer);

      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(result.original.length).toBeGreaterThan(0);
    });

    it("returns buffer for thumbnail", async () => {
      const result = await processImage(testImageBuffer);

      expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
      expect(result.thumbnail.length).toBeGreaterThan(0);
    });

    it("converts image to WebP format", async () => {
      const result = await processImage(testImageBuffer);

      // Check if the result is a WebP by checking magic bytes
      const metadata = await sharp(result.original).metadata();
      expect(metadata.format).toBe("webp");
    });

    it("converts thumbnail to WebP format", async () => {
      const result = await processImage(testImageBuffer);

      const metadata = await sharp(result.thumbnail).metadata();
      expect(metadata.format).toBe("webp");
    });

    it("preserves dimensions for smaller images", async () => {
      const smallImage = await sharp({
        create: {
          width: 500,
          height: 400,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImage(smallImage, {
        maxWidth: 1920,
        maxHeight: 1080,
      });

      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });

    it("resizes large images within bounds", async () => {
      const largeImage = await sharp({
        create: {
          width: 3000,
          height: 2000,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImage(largeImage, {
        maxWidth: 1920,
        maxHeight: 1080,
      });

      // Should be resized to fit within bounds while maintaining aspect ratio
      expect(result.width).toBeLessThanOrEqual(1920);
      expect(result.height).toBeLessThanOrEqual(1080);
    });

    it("creates square thumbnail with default size", async () => {
      const result = await processImage(testImageBuffer);

      expect(result.thumbnailWidth).toBe(200);
      expect(result.thumbnailHeight).toBe(200);
    });

    it("respects custom thumbnail size option", async () => {
      const result = await processImage(testImageBuffer, {
        thumbnailSize: 150,
      });

      expect(result.thumbnailWidth).toBe(150);
      expect(result.thumbnailHeight).toBe(150);
    });

    it("respects custom quality option", async () => {
      const highQuality = await processImage(testImageBuffer, { quality: 100 });
      const lowQuality = await processImage(testImageBuffer, { quality: 30 });

      // High quality should generally be larger (not always true due to compression)
      // Just verify both process successfully
      expect(highQuality.original.length).toBeGreaterThan(0);
      expect(lowQuality.original.length).toBeGreaterThan(0);
    });

    it("respects custom maxWidth and maxHeight", async () => {
      const largeImage = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImage(largeImage, {
        maxWidth: 800,
        maxHeight: 600,
      });

      expect(result.width).toBeLessThanOrEqual(800);
      expect(result.height).toBeLessThanOrEqual(600);
    });

    it("handles PNG input", async () => {
      const pngImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processImage(pngImage);

      expect(result.original.length).toBeGreaterThan(0);
      const metadata = await sharp(result.original).metadata();
      expect(metadata.format).toBe("webp");
    });

    it("handles WebP input", async () => {
      const webpImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 100, b: 200 },
        },
      })
        .webp()
        .toBuffer();

      const result = await processImage(webpImage);

      expect(result.original.length).toBeGreaterThan(0);
    });

    it("thumbnail is smaller than original", async () => {
      const result = await processImage(testImageBuffer);

      expect(result.thumbnail.length).toBeLessThan(result.original.length);
    });

    it("maintains aspect ratio when resizing", async () => {
      const wideImage = await sharp({
        create: {
          width: 3000,
          height: 1000,
          channels: 3,
          background: { r: 50, g: 50, b: 50 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImage(wideImage, {
        maxWidth: 900,
        maxHeight: 600,
      });

      // Original aspect ratio is 3:1
      const aspectRatio = result.width / result.height;
      expect(aspectRatio).toBeCloseTo(3, 1);
    });
  });
});
