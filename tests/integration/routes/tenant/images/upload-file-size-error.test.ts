import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/tenant/images/upload";

// Mock dependencies with proper exports
vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("../../../../../lib/storage", () => ({
  uploadToS3: vi.fn(),
  getImageKey: vi.fn((tenant: string, entityType: string, entityId: string, filename: string) =>
    `${tenant}/${entityType}/${entityId}/${filename}`
  ),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
}));

vi.mock("../../../../../lib/logger", () => ({
  storageLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import * as storage from "../../../../../lib/storage";

describe("KAN-669: File upload error specifies which file is too large", () => {
  const mockOrgContext = {
    org: { id: "org-123", slug: "demo", name: "Demo Dive Shop" },
    user: { id: "user-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOrgContext).mockResolvedValue(mockOrgContext as unknown);
    vi.mocked(storage.isValidImageType).mockReturnValue(true);
  });

  function makeUploadRequest(formData: FormData) {
    return new Request("https://demo.divestreams.com/tenant/images/upload", {
      method: "POST",
      body: formData,
    });
  }

  function callAction(request: Request) {
    return action({ request, params: {}, context: {} } as unknown);
  }

  describe("file size validation error messages", () => {
    it("includes the filename in the error message", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "vacation-photo.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("vacation-photo.jpg");
    });

    it("includes the actual file size in MB in the error message", async () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB
      const file = new File([largeBuffer], "big-image.png", { type: "image/png" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("15.0MB");
    });

    it("includes the maximum allowed size in the error message", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "photo.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Maximum size: 10MB");
    });

    it("formats the error message correctly for an 11MB file", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "reef-photo.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('"reef-photo.jpg" is too large (11.0MB). Maximum size: 10MB');
    });

    it("shows correct size for a file just over the 10MB limit", async () => {
      // 10MB + 1 byte
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      const file = new File([largeBuffer], "borderline.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("borderline.jpg");
      expect(data.error).toContain("10.0MB");
      expect(data.error).toContain("too large");
    });

    it("handles filenames with special characters", async () => {
      const largeBuffer = Buffer.alloc(12 * 1024 * 1024);
      const file = new File([largeBuffer], "my photo (1).jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("my photo (1).jpg");
    });

    it("rounds file size to one decimal place", async () => {
      // 10.56MB = 10 * 1024 * 1024 + 0.56 * 1024 * 1024
      const sizeBytes = Math.floor(10.56 * 1024 * 1024);
      const largeBuffer = Buffer.alloc(sizeBytes);
      const file = new File([largeBuffer], "test.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("10.6MB");
    });
  });

  describe("file size validation - boundary cases", () => {
    it("allows a file exactly at the 10MB limit", async () => {
      const exactBuffer = Buffer.alloc(10 * 1024 * 1024); // Exactly 10MB
      const file = new File([exactBuffer], "exact-limit.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "img-1",
          url: "https://cdn.example.com/image.webp",
          thumbnailUrl: "https://cdn.example.com/thumb.webp",
          filename: "exact-limit.jpg",
          width: 800,
          height: 600,
          alt: "exact-limit.jpg",
          sortOrder: 0,
          isPrimary: true,
        }]),
      };

      vi.mocked(getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        },
        schema: { images: {} },
      } as unknown);

      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 800,
        height: 600,
      });
      vi.mocked(storage.uploadToS3).mockResolvedValue({
        cdnUrl: "https://cdn.example.com/image.webp",
        b2Url: "https://b2.example.com/image.webp",
      });

      const response = await callAction(makeUploadRequest(formData));

      // Should NOT return 400 — file is exactly at the limit, not over it
      expect(response.status).not.toBe(400);
    });

    it("rejects a file 1 byte over the 10MB limit", async () => {
      const overBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      const file = new File([overBuffer], "one-byte-over.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("one-byte-over.jpg");
      expect(data.error).toContain("too large");
    });

    it("allows a file under the 10MB limit", async () => {
      const smallBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      const file = new File([smallBuffer], "small.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "img-1",
          url: "https://cdn.example.com/image.webp",
          thumbnailUrl: "https://cdn.example.com/thumb.webp",
          filename: "small.jpg",
          width: 800,
          height: 600,
          alt: "small.jpg",
          sortOrder: 0,
          isPrimary: true,
        }]),
      };

      vi.mocked(getTenantDb).mockReturnValue({
        db: {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        },
        schema: { images: {} },
      } as unknown);

      vi.mocked(storage.processImage).mockResolvedValue({
        original: Buffer.from("processed"),
        thumbnail: Buffer.from("thumb"),
        width: 800,
        height: 600,
      });
      vi.mocked(storage.uploadToS3).mockResolvedValue({
        cdnUrl: "https://cdn.example.com/image.webp",
        b2Url: "https://b2.example.com/image.webp",
      });

      const response = await callAction(makeUploadRequest(formData));

      expect(response.status).not.toBe(400);
    });
  });

  describe("contract: API response shape for file size errors", () => {
    it("returns 400 status code for oversized files", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "test.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));

      expect(response.status).toBe(400);
    });

    it("returns JSON with an error field", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const file = new File([largeBuffer], "test.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-123");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(data).toHaveProperty("error");
      expect(typeof data.error).toBe("string");
    });

    it("error message matches the expected format: \"<filename>\" is too large (<size>MB). Maximum size: 10MB", async () => {
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
      const file = new File([largeBuffer], "whale-shark.png", { type: "image/png" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "dive-site");
      formData.append("entityId", "site-456");

      const response = await callAction(makeUploadRequest(formData));
      const data = await response.json();

      expect(data.error).toMatch(/^"whale-shark\.png" is too large \(20\.0MB\)\. Maximum size: 10MB$/);
    });
  });
});
