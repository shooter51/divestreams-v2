/**
 * Contract tests for POST /tenant/images/upload
 *
 * Validates the API response shape and HTTP status codes for the image upload endpoint.
 * Specifically tests the SHO-3 fix: error messages now include filename and actual file size.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the action
vi.mock("../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../lib/storage", () => ({
  uploadToB2: vi.fn(),
  getImageKey: vi.fn(
    (slug: string, entityType: string, entityId: string, filename: string) =>
      `${slug}/${entityType}/${entityId}/${filename}`
  ),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
}));

vi.mock("../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  storageLogger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { action } from "../../app/routes/tenant/images/upload";
import { requireOrgContext } from "../../lib/auth/org-context.server";
import {
  uploadToB2,
  processImage,
  isValidImageType,
} from "../../lib/storage";
import { getTenantDb } from "../../lib/db/tenant.server";

type MockFn = ReturnType<typeof vi.fn>;

function createPostRequest(formData: FormData): Request {
  return new Request("https://demo.divestreams.com/tenant/images/upload", {
    method: "POST",
    body: formData,
  });
}

function actionArgs(request: Request) {
  return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

describe("Contract: POST /tenant/images/upload", () => {
  const mockOrgContext = {
    user: { id: "user-1" },
    session: { id: "session-1" },
    org: { id: "org-uuid-123", slug: "demo", name: "Demo Dive Shop" },
    membership: { role: "owner" },
    subscription: null,
  };

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  const mockSchema = {
    images: {
      id: "id",
      entityType: "entityType",
      entityId: "entityId",
      organizationId: "organizationId",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as MockFn).mockResolvedValue(mockOrgContext);
    (getTenantDb as MockFn).mockReturnValue({
      db: mockDb,
      schema: mockSchema,
    });
    (isValidImageType as MockFn).mockReturnValue(true);
    (processImage as MockFn).mockResolvedValue({
      original: Buffer.from("processed"),
      thumbnail: Buffer.from("thumb"),
      width: 800,
      height: 600,
    });
    mockDb.where.mockResolvedValue([{ count: 0 }]);
  });

  describe("Error response shape", () => {
    it("returns { error: string } with status 400 when file is too large", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new File([new ArrayBuffer(11 * 1024 * 1024)], "big-photo.jpg", { type: "image/jpeg" })
      );
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-1");

      const response = await action(actionArgs(createPostRequest(formData)));
      const json = await response.json();

      // Contract: status must be 400
      expect(response.status).toBe(400);
      // Contract: body must have `error` field of type string
      expect(json).toHaveProperty("error");
      expect(typeof json.error).toBe("string");
      // Contract: error must contain the filename
      expect(json.error).toContain("big-photo.jpg");
    });

    it("returns { error: string } with status 400 when no file provided", async () => {
      const formData = new FormData();
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-1");

      const response = await action(actionArgs(createPostRequest(formData)));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty("error");
      expect(typeof json.error).toBe("string");
    });

    it("returns { error: string } with status 400 for invalid file type", async () => {
      (isValidImageType as MockFn).mockReturnValue(false);
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["test"], { type: "application/pdf" }),
        "test.pdf"
      );
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-1");

      const response = await action(actionArgs(createPostRequest(formData)));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toHaveProperty("error");
      expect(typeof json.error).toBe("string");
    });

    it("returns { error: string } with status 405 for non-POST methods", async () => {
      const request = new Request(
        "https://demo.divestreams.com/tenant/images/upload",
        { method: "GET" }
      );
      const response = await action(actionArgs(request));
      const json = await response.json();

      expect(response.status).toBe(405);
      expect(json).toHaveProperty("error");
      expect(typeof json.error).toBe("string");
    });
  });

  describe("Success response shape", () => {
    it("returns { success: true, image: {...} } with status 200", async () => {
      (uploadToB2 as MockFn).mockResolvedValue({
        cdnUrl: "https://cdn.example.com/image.webp",
      });
      mockDb.returning.mockResolvedValue([
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
      ]);

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["test"], { type: "image/jpeg" }),
        "test.jpg"
      );
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-1");

      const response = await action(actionArgs(createPostRequest(formData)));
      const json = await response.json();

      // Contract: status must be 200
      expect(response.status).toBe(200);
      // Contract: Content-Type must be application/json
      expect(response.headers.get("Content-Type")).toBe("application/json");
      // Contract: body shape
      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("image");
      expect(json.image).toHaveProperty("id");
      expect(json.image).toHaveProperty("url");
      expect(json.image).toHaveProperty("thumbnailUrl");
      expect(json.image).toHaveProperty("filename");
      expect(json.image).toHaveProperty("width");
      expect(json.image).toHaveProperty("height");
      expect(json.image).toHaveProperty("alt");
      expect(json.image).toHaveProperty("sortOrder");
      expect(json.image).toHaveProperty("isPrimary");
    });
  });

  describe("Storage unavailable response shape", () => {
    it("returns { error: string } with status 503 when B2 not configured", async () => {
      (uploadToB2 as MockFn).mockResolvedValue(null);

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["test"], { type: "image/jpeg" }),
        "test.jpg"
      );
      formData.append("entityType", "tour");
      formData.append("entityId", "tour-1");

      const response = await action(actionArgs(createPostRequest(formData)));
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json).toHaveProperty("error");
      expect(typeof json.error).toBe("string");
    });
  });
});
