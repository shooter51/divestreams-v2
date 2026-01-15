import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store mock send function for test control
const mockSend = vi.fn().mockResolvedValue({});

// Mock the AWS SDK before importing the module
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: class MockS3Client {
      constructor(public config: any) {}
      send = mockSend;
    },
    PutObjectCommand: class MockPutObjectCommand {
      constructor(public input: any) {}
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      constructor(public input: any) {}
    },
  };
});

describe("B2 Storage Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockSend.mockClear();
    mockSend.mockResolvedValue({});
    // Reset modules to clear singleton client
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getS3Client", () => {
    it("returns null when B2 is not configured", async () => {
      delete process.env.B2_ENDPOINT;
      delete process.env.B2_KEY_ID;
      delete process.env.B2_APP_KEY;

      const { getS3Client } = await import("../../../../lib/storage/b2");
      const client = getS3Client();
      expect(client).toBeNull();
    });

    it("creates S3 client when properly configured", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_REGION = "us-west-000";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";
      process.env.B2_BUCKET = "test-bucket";

      const { getS3Client } = await import("../../../../lib/storage/b2");
      const client = getS3Client();

      expect(client).not.toBeNull();
      expect((client as any).config).toEqual({
        endpoint: "https://s3.us-west-000.backblazeb2.com",
        region: "us-west-000",
        credentials: {
          accessKeyId: "test-key-id",
          secretAccessKey: "test-app-key",
        },
      });
    });

    it("reuses existing client on subsequent calls", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";

      const { getS3Client } = await import("../../../../lib/storage/b2");
      const client1 = getS3Client();
      const client2 = getS3Client();

      expect(client1).toBe(client2);
    });
  });

  describe("uploadToB2", () => {
    it("returns null when client is not configured", async () => {
      delete process.env.B2_ENDPOINT;

      const { uploadToB2 } = await import("../../../../lib/storage/b2");
      const result = await uploadToB2("test-key", Buffer.from("test"), "image/webp");

      expect(result).toBeNull();
    });

    it("uploads file and returns URLs", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";
      process.env.B2_BUCKET = "test-bucket";
      process.env.CDN_URL = "https://cdn.example.com";

      const { uploadToB2 } = await import("../../../../lib/storage/b2");
      const testBuffer = Buffer.from("test-image-data");
      const result = await uploadToB2("tenant/tour/123/image.webp", testBuffer, "image/webp");

      expect(result).not.toBeNull();
      expect(result?.key).toBe("tenant/tour/123/image.webp");
      expect(result?.url).toContain("s3.us-west-000.backblazeb2.com");
      expect(result?.cdnUrl).toBe("https://cdn.example.com/tenant/tour/123/image.webp");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("falls back to B2 URL when CDN_URL is not set", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";
      process.env.B2_BUCKET = "test-bucket";
      delete process.env.CDN_URL;

      const { uploadToB2 } = await import("../../../../lib/storage/b2");
      const result = await uploadToB2("test-key", Buffer.from("test"), "image/webp");

      expect(result?.cdnUrl).toBe(result?.url);
    });
  });

  describe("deleteFromB2", () => {
    it("returns false when client is not configured", async () => {
      delete process.env.B2_ENDPOINT;

      const { deleteFromB2 } = await import("../../../../lib/storage/b2");
      const result = await deleteFromB2("test-key");

      expect(result).toBe(false);
    });

    it("deletes file and returns true on success", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";
      process.env.B2_BUCKET = "test-bucket";

      const { deleteFromB2 } = await import("../../../../lib/storage/b2");
      const result = await deleteFromB2("tenant/tour/123/image.webp");

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("returns false on delete failure", async () => {
      process.env.B2_ENDPOINT = "https://s3.us-west-000.backblazeb2.com";
      process.env.B2_KEY_ID = "test-key-id";
      process.env.B2_APP_KEY = "test-app-key";

      mockSend.mockRejectedValueOnce(new Error("Delete failed"));

      const { deleteFromB2 } = await import("../../../../lib/storage/b2");
      const result = await deleteFromB2("test-key");

      expect(result).toBe(false);
    });
  });

  describe("getImageKey", () => {
    it("generates correct key format", async () => {
      const { getImageKey } = await import("../../../../lib/storage/b2");
      const key = getImageKey("tenant-123", "tour", "tour-456", "my-image.jpg");

      expect(key).toMatch(/^tenant-123\/tour\/tour-456\/\d+-my-image\.jpg$/);
    });

    it("sanitizes filename with special characters", async () => {
      const { getImageKey } = await import("../../../../lib/storage/b2");
      const key = getImageKey("tenant", "boat", "123", "my file@#$.jpg");

      expect(key).toMatch(/^tenant\/boat\/123\/\d+-my_file___\.jpg$/);
    });

    it("preserves alphanumeric characters and dots", async () => {
      const { getImageKey } = await import("../../../../lib/storage/b2");
      const key = getImageKey("t1", "site", "s1", "photo123.webp");

      expect(key).toMatch(/^t1\/site\/s1\/\d+-photo123\.webp$/);
    });

    it("includes timestamp for uniqueness", async () => {
      const { getImageKey } = await import("../../../../lib/storage/b2");
      const key1 = getImageKey("t", "e", "id", "file.jpg");

      // Wait 5ms to ensure different timestamp (Date.now() has ms resolution)
      await new Promise(resolve => setTimeout(resolve, 5));

      const key2 = getImageKey("t", "e", "id", "file.jpg");

      // Keys should be different due to timestamp
      expect(key1).not.toBe(key2);
    });
  });
});
