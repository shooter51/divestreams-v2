/**
 * DS-b01: S3 path traversal prevention tests
 *
 * Verifies that getImageKey sanitizes all path components
 * to prevent directory traversal attacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = vi.fn(); },
  PutObjectCommand: class {},
  DeleteObjectCommand: class {},
}));

describe("DS-b01: S3 path traversal prevention", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("strips path traversal characters from tenantId", async () => {
    const { getImageKey } = await import("../../../../lib/storage/s3");
    const key = getImageKey("../../../etc", "tour", "abc-123", "photo.jpg");
    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc");
    expect(key.split("/")[0]).toBe("etc");
  });

  it("strips path traversal characters from entityType", async () => {
    const { getImageKey } = await import("../../../../lib/storage/s3");
    const key = getImageKey("tenant-1", "../../secrets", "abc-123", "photo.jpg");
    expect(key).not.toContain("..");
    expect(key.split("/")[1]).toBe("secrets");
  });

  it("strips path traversal characters from entityId", async () => {
    const { getImageKey } = await import("../../../../lib/storage/s3");
    const key = getImageKey("tenant-1", "tour", "../../../etc/passwd", "photo.jpg");
    expect(key).not.toContain("..");
    expect(key.split("/")[2]).toBe("etcpasswd");
  });

  it("sanitizes filename to replace non-safe characters with underscores", async () => {
    const { getImageKey } = await import("../../../../lib/storage/s3");
    const key = getImageKey("tenant-1", "tour", "abc-123", "../../etc/passwd.jpg");
    // Slashes are replaced with underscores; dots are preserved (safe in filename position)
    const filename = key.split("/").pop()!;
    // The filename portion replaces [^a-zA-Z0-9.-] with _
    // So ../../etc/passwd.jpg → .._.._etc_passwd.jpg
    expect(filename).toMatch(/^\d+-[a-zA-Z0-9._-]+$/);
    // The key has exactly 4 path segments (tenant/type/id/filename) — no extra traversal
    expect(key.split("/")).toHaveLength(4);
  });

  it("produces a clean path for normal inputs", async () => {
    const { getImageKey } = await import("../../../../lib/storage/s3");
    const key = getImageKey("tenant-1", "tour", "abc-123", "photo.jpg");
    const parts = key.split("/");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("tenant-1");
    expect(parts[1]).toBe("tour");
    expect(parts[2]).toBe("abc-123");
    expect(parts[3]).toMatch(/^\d+-photo\.jpg$/);
  });
});
