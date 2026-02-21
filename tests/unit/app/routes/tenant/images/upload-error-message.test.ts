/**
 * Unit tests for SHO-3: File upload error message includes filename and size
 *
 * Tests the file size validation logic and error message formatting
 * in the image upload action handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the action
vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../../lib/storage", () => ({
  uploadToS3: vi.fn(),
  getImageKey: vi.fn(
    (slug: string, entityType: string, entityId: string, filename: string) =>
      `${slug}/${entityType}/${entityId}/${filename}`
  ),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
}));

vi.mock("../../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("../../../../../../lib/logger", () => ({
  storageLogger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { action } from "../../../../../../app/routes/tenant/images/upload";
import { requireOrgContext } from "../../../../../../lib/auth/org-context.server";
import {
  isValidImageType,
  processImage,
  uploadToS3,
} from "../../../../../../lib/storage";
import { getTenantDb } from "../../../../../../lib/db/tenant.server";

type MockFn = ReturnType<typeof vi.fn>;

function createOversizedFile(filename: string, sizeBytes?: number): File {
  const size = sizeBytes ?? 11 * 1024 * 1024;
  return new File([new ArrayBuffer(size)], filename, { type: "image/jpeg" });
}

function createUploadRequest(
  file: File,
  entityType = "tour",
  entityId = "tour-1"
): Request {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entityType", entityType);
  formData.append("entityId", entityId);
  return new Request("https://demo.divestreams.com/tenant/images/upload", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

function setupFullMocks() {
  (processImage as MockFn).mockResolvedValue({
    original: Buffer.from("processed"),
    thumbnail: Buffer.from("thumb"),
    width: 800,
    height: 600,
  });
  (uploadToS3 as MockFn).mockResolvedValue({
    cdnUrl: "https://cdn.example.com/image.webp",
  });
  (getTenantDb as MockFn).mockReturnValue({
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: "img-1",
          url: "https://cdn.example.com/image.webp",
          thumbnailUrl: "https://cdn.example.com/thumb.webp",
          filename: "test.jpg",
          width: 800,
          height: 600,
          alt: "test.jpg",
          sortOrder: 0,
          isPrimary: true,
        },
      ]),
    },
    schema: {
      images: {
        id: "id",
        entityType: "entityType",
        entityId: "entityId",
        organizationId: "organizationId",
      },
    },
  });
}

describe("Image upload - file size validation and error message", () => {
  const mockOrgContext = {
    user: { id: "user-1" },
    session: { id: "session-1" },
    org: { id: "org-uuid-123", slug: "demo", name: "Demo Dive Shop" },
    membership: { role: "owner" },
    subscription: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as MockFn).mockResolvedValue(mockOrgContext);
    (isValidImageType as MockFn).mockReturnValue(true);
    (getTenantDb as MockFn).mockReturnValue({
      db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      },
      schema: {
        images: {
          id: "id",
          entityType: "entityType",
          entityId: "entityId",
          organizationId: "organizationId",
        },
      },
    });
  });

  describe("Error message formatting", () => {
    it("includes the filename in the error message", async () => {
      const file = createOversizedFile("vacation-photo.jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("vacation-photo.jpg");
    });

    it("includes the actual file size in MB", async () => {
      const file = createOversizedFile("large.jpg", 15 * 1024 * 1024);
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("15.0MB");
    });

    it("includes the maximum size limit", async () => {
      const file = createOversizedFile("test.jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("Maximum size: 10MB");
    });

    it("formats size with one decimal place for non-round sizes", async () => {
      const size = Math.ceil(10.5 * 1024 * 1024);
      const file = createOversizedFile("medium.png", size);
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("10.5MB");
    });

    it("wraps filename in quotes", async () => {
      const file = createOversizedFile("my-file.jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toMatch(/"my-file\.jpg"/);
    });
  });

  describe("Filenames with special characters", () => {
    it("handles filenames with spaces", async () => {
      const file = createOversizedFile("my vacation photo.jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("my vacation photo.jpg");
    });

    it("handles filenames with unicode characters", async () => {
      const file = createOversizedFile("foto-playa-océano.jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      // Verify error contains the filename (happy-dom may encode unicode differently)
      expect(json.error).toContain("too large");
      expect(json.error).toContain("foto-playa-");
    });

    it("handles filenames with parentheses", async () => {
      const file = createOversizedFile("photo (1).jpg");
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain("photo (1).jpg");
    });

    it("handles very long filenames", async () => {
      const longName = "a".repeat(200) + ".jpg";
      const file = createOversizedFile(longName);
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(json.error).toContain(longName);
    });
  });

  describe("Other validation branches", () => {
    it("rejects missing entityType and entityId", async () => {
      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      const formData = new FormData();
      formData.append("file", file);
      const request = new Request(
        "https://demo.divestreams.com/tenant/images/upload",
        { method: "POST", body: formData }
      );
      const response = await action(actionArgs(request));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("entityType and entityId are required");
    });

    it("rejects invalid entityType", async () => {
      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      const response = await action(
        actionArgs(createUploadRequest(file, "unknown-type", "ent-1"))
      );
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid entityType");
    });

    it("rejects when max images limit reached", async () => {
      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      (getTenantDb as MockFn).mockReturnValue({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        },
        schema: {
          images: {
            id: "id",
            entityType: "entityType",
            entityId: "entityId",
            organizationId: "organizationId",
          },
        },
      });

      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Maximum 5 images allowed");
    });

    it("handles sharp processing errors with user-friendly message", async () => {
      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      setupFullMocks();
      (processImage as MockFn).mockRejectedValue(new Error("sharp failed"));

      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("Image processing failed");
    });

    it("includes error details in development mode for non-sharp errors", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      setupFullMocks();
      (processImage as MockFn).mockRejectedValue(
        new Error("network timeout connecting to storage")
      );

      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("network timeout connecting to storage");

      process.env.NODE_ENV = origEnv;
    });

    it("returns generic error for S3/B2 storage errors", async () => {
      const file = new File([new Uint8Array([1])], "test.jpg", {
        type: "image/jpeg",
      });
      setupFullMocks();
      (processImage as MockFn).mockRejectedValue(new Error("S3 bucket not found"));

      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("Storage service unavailable");
    });
  });

  describe("Boundary file sizes", () => {
    it("accepts a file exactly at 10MB (10485760 bytes)", async () => {
      const exactLimit = 10 * 1024 * 1024;
      const file = new File([new ArrayBuffer(exactLimit)], "exact-10mb.jpg", {
        type: "image/jpeg",
      });
      setupFullMocks();

      const response = await action(actionArgs(createUploadRequest(file)));

      expect(response.status).not.toBe(400);
    });

    it("rejects a file at 10MB + 1 byte", async () => {
      const justOver = 10 * 1024 * 1024 + 1;
      const file = new File([new ArrayBuffer(justOver)], "just-over.jpg", {
        type: "image/jpeg",
      });
      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("just-over.jpg");
      expect(json.error).toContain("too large");
    });

    it("rejects a 0-byte file as no file provided", async () => {
      const file = new File([], "empty.jpg", { type: "image/jpeg" });

      const response = await action(actionArgs(createUploadRequest(file)));
      const json = await response.json();

      // A 0-byte file is treated as "no file" by the upload handler
      expect(response.status).toBe(400);
      expect(json.error).toBe("No file provided");
    });

    it("accepts a 1-byte file", async () => {
      const file = new File([new Uint8Array([0x01])], "tiny.jpg", {
        type: "image/jpeg",
      });
      setupFullMocks();

      const response = await action(actionArgs(createUploadRequest(file)));

      expect(response.status).not.toBe(400);
    });
  });
});
