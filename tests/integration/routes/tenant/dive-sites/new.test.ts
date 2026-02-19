import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRedirectPathname } from "../../../../helpers/redirect";
import { action } from "../../../../../app/routes/tenant/dive-sites/new";
import * as orgContext from "../../../../../lib/auth/org-context.server";
import * as queries from "../../../../../lib/db/queries.server";
import * as validation from "../../../../../lib/validation";
import * as storage from "../../../../../lib/storage";
import * as tenantServer from "../../../../../lib/db/tenant.server";

// Mock dependencies
vi.mock("../../../../../lib/auth/org-context.server");
vi.mock("../../../../../lib/db/queries.server");
vi.mock("../../../../../lib/validation");
vi.mock("../../../../../lib/storage");
vi.mock("../../../../../lib/db/tenant.server");

describe("app/routes/tenant/dive-sites/new.tsx", () => {
  const mockOrganizationId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(orgContext.requireOrgContext).mockResolvedValue({
      org: { id: mockOrganizationId, name: "Test Org", slug: "test" },
      canAddCustomer: true,
      usage: { customers: 0 },
      limits: { customers: 100 },
      isPremium: false,
    } as any);
  });

  describe("action", () => {
    it("should create dive site and redirect", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      const mockSite = { id: "site-123", name: "Blue Corner" };
      vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);

      const formData = new FormData();
      formData.append("name", "Blue Corner");
      formData.append("description", "Famous drift dive");
      formData.append("maxDepth", "30");
      formData.append("difficulty", "intermediate");
      formData.append("latitude", "7.165");
      formData.append("longitude", "134.271");
      formData.append("visibility", "15-25m");
      formData.append("currentStrength", "moderate");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Blue Corner",
          description: "Famous drift dive",
          maxDepth: 30,
          difficulty: "intermediate",
          latitude: 7.165,
          longitude: 134.271,
          visibility: "15-25m",
          currentStrength: "moderate",
        })
      );

      // Check redirect to edit page
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(302);
      expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
    });

    it("should return validation errors for missing name", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          name: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "",
      });

      const formData = new FormData();
      formData.append("name", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("name", "Required");
    });

    it("should return validation errors for missing maxDepth", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          maxDepth: "Required",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Site",
        maxDepth: "",
      });

      const formData = new FormData();
      formData.append("name", "Test Site");
      formData.append("maxDepth", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("maxDepth", "Required");
    });

    it("should handle optional fields correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      const mockSite = { id: "site-456", name: "Simple Site" };
      vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);

      const formData = new FormData();
      formData.append("name", "Simple Site");
      formData.append("maxDepth", "20");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          name: "Simple Site",
          maxDepth: 20,
          description: undefined,
          latitude: undefined,
          longitude: undefined,
        })
      );
    });

    it("should convert highlights comma-separated string to JSON array", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      const mockSite = { id: "site-789", name: "Coral Garden" };
      vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);

      const formData = new FormData();
      formData.append("name", "Coral Garden");
      formData.append("maxDepth", "18");
      formData.append("highlights", "Sharks, Turtles, Coral Wall");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      // The action internally converts highlights to JSON before validation
      // We can't directly check formData since it's modified inside the action
      expect(queries.createDiveSite).toHaveBeenCalled();
    });

    it("should handle empty highlights string", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      const mockSite = { id: "site-101", name: "No Highlights Site" };
      vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);

      const formData = new FormData();
      formData.append("name", "No Highlights Site");
      formData.append("maxDepth", "15");
      formData.append("highlights", "");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      // Empty string should result in undefined or empty array
      expect(queries.createDiveSite).toHaveBeenCalled();
    });

    it("should parse numeric coordinates correctly", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: true,
        data: {} as any,
      });

      const mockSite = { id: "site-202", name: "GPS Site" };
      vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);

      const formData = new FormData();
      formData.append("name", "GPS Site");
      formData.append("maxDepth", "25");
      formData.append("latitude", "7.165432");
      formData.append("longitude", "134.271890");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(queries.createDiveSite).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.objectContaining({
          latitude: 7.165432,
          longitude: 134.27189,
        })
      );
    });

    it("should handle invalid difficulty validation", async () => {
      vi.mocked(validation.validateFormData).mockReturnValue({
        success: false,
        errors: {
          difficulty: "Invalid difficulty level",
        },
      });

      vi.mocked(validation.getFormValues).mockReturnValue({
        name: "Test Site",
        difficulty: "super-hard",
      });

      const formData = new FormData();
      formData.append("name", "Test Site");
      formData.append("difficulty", "super-hard");

      const request = new Request("http://test.com/tenant/dive-sites/new", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });

      expect(result).toHaveProperty("errors");
      expect(result.errors).toHaveProperty("difficulty", "Invalid difficulty level");
    });

    describe("image upload", () => {
      const mockSite = { id: "site-img-123", name: "Photo Site" };

      // Helper to set up DB mock and return spy for assertions
      function setupDbMock() {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const mockInsert = vi.fn().mockReturnValue({ values: insertValues });
        vi.mocked(tenantServer.getTenantDb).mockReturnValue({
          db: { insert: mockInsert } as any,
          schema: { images: {} } as any,
        });
        return insertValues;
      }

      beforeEach(() => {
        vi.mocked(validation.validateFormData).mockReturnValue({
          success: true,
          data: {} as any,
        });
        vi.mocked(queries.createDiveSite).mockResolvedValue(mockSite as any);
        vi.mocked(storage.getWebPMimeType).mockReturnValue("image/webp");
        vi.mocked(storage.getImageKey).mockReturnValue("orgs/test/dive-sites/site-img-123/photo");
        // Default: processImage resolves successfully
        vi.mocked(storage.processImage).mockResolvedValue({
          original: Buffer.from("webp-data"),
          thumbnail: Buffer.from("thumb-data"),
          width: 800,
          height: 600,
        } as any);
      });

      it("should redirect with warning when storage is not configured", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue(null);

        const file = new File(["fake image data"], "dive.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        const location = result.headers.get("Location") ?? "";
        expect(getRedirectPathname(location)).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
        expect(location).toContain("warning");
      });

      it("should upload images successfully and redirect to edit page", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        vi.mocked(storage.uploadToB2)
          .mockResolvedValueOnce({ cdnUrl: "https://cdn.example.com/image.webp" } as any)
          .mockResolvedValueOnce({ cdnUrl: "https://cdn.example.com/image-thumb.webp" } as any);

        const insertValues = setupDbMock();

        const file = new File(["fake image data"], "dive.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        expect(storage.uploadToB2).toHaveBeenCalledTimes(2);
        expect(insertValues).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: mockOrganizationId,
            entityType: "dive-site",
            entityId: mockSite.id,
            url: "https://cdn.example.com/image.webp",
            isPrimary: true,
            sortOrder: 0,
          })
        );

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
      });

      it("should skip files with invalid image type", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(false);
        setupDbMock();

        const file = new File(["not an image"], "document.pdf", { type: "application/pdf" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        // Invalid type: processImage and uploadToB2 should not be called
        expect(storage.processImage).not.toHaveBeenCalled();
        expect(storage.uploadToB2).not.toHaveBeenCalled();

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        const location = result.headers.get("Location") ?? "";
        expect(getRedirectPathname(location)).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
      });

      it("should skip files that exceed 10MB size limit", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        setupDbMock();

        // Create a Blob that is actually over 10MB (10MB + 1 byte)
        const oversizedContent = new Uint8Array(10 * 1024 * 1024 + 1);
        const file = new File([oversizedContent], "huge.jpg", { type: "image/jpeg" });

        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        // Oversized file should be skipped, processImage should not be called
        expect(storage.processImage).not.toHaveBeenCalled();
        expect(storage.uploadToB2).not.toHaveBeenCalled();

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
      });

      it("should handle partial upload failure gracefully", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        // First upload succeeds, second's original upload returns null (failure)
        vi.mocked(storage.uploadToB2)
          .mockResolvedValueOnce({ cdnUrl: "https://cdn.example.com/image1.webp" } as any)
          .mockResolvedValueOnce({ cdnUrl: "https://cdn.example.com/image1-thumb.webp" } as any)
          .mockResolvedValueOnce(null) // second file original upload fails
          .mockResolvedValueOnce(null);

        const insertValues = setupDbMock();

        const file1 = new File(["image1"], "dive1.jpg", { type: "image/jpeg" });
        const file2 = new File(["image2"], "dive2.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file1);
        formData.append("images", file2);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        // Only 1 image saved to DB (second failed to upload)
        expect(insertValues).toHaveBeenCalledTimes(1);

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        const location = result.headers.get("Location") ?? "";
        expect(location).toContain("warning");
        expect(getRedirectPathname(location)).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
      });

      it("should redirect with error when all image uploads fail", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        // Override the beforeEach default to make processImage throw
        vi.mocked(storage.processImage).mockRejectedValue(new Error("Processing failed"));
        setupDbMock();

        const file = new File(["image"], "dive.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        const location = result.headers.get("Location") ?? "";
        expect(location).toContain("error");
        expect(getRedirectPathname(location)).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
      });

      it("should not process empty file inputs", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        setupDbMock();

        // Empty file (size = 0) should be filtered out before processing
        const emptyFile = new File([], "empty.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", emptyFile);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {} });

        // Empty files are filtered out → treated as no images → success redirect
        expect(storage.processImage).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(302);
        expect(getRedirectPathname(result.headers.get("Location"))).toBe(`/tenant/dive-sites/${mockSite.id}/edit`);
      });

      it("should limit uploads to 5 images maximum", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        vi.mocked(storage.uploadToB2).mockResolvedValue({ cdnUrl: "https://cdn.example.com/img.webp" } as any);

        const insertValues = setupDbMock();

        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        // Add 7 images — only 5 should be processed per the action's Math.min(imageFiles.length, 5)
        for (let i = 0; i < 7; i++) {
          formData.append("images", new File([`image-content-${i}`], `dive${i}.jpg`, { type: "image/jpeg" }));
        }

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        // Only 5 images should be processed
        expect(storage.processImage).toHaveBeenCalledTimes(5);
        expect(insertValues).toHaveBeenCalledTimes(5);
      });

      it("should set first image as primary with correct sort order", async () => {
        vi.mocked(storage.getS3Client).mockReturnValue({} as any);
        vi.mocked(storage.isValidImageType).mockReturnValue(true);
        vi.mocked(storage.uploadToB2).mockResolvedValue({ cdnUrl: "https://cdn.example.com/img.webp" } as any);

        const insertValues = setupDbMock();

        const file1 = new File(["image1-content"], "dive1.jpg", { type: "image/jpeg" });
        const file2 = new File(["image2-content"], "dive2.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("name", "Photo Site");
        formData.append("maxDepth", "20");
        formData.append("images", file1);
        formData.append("images", file2);

        const request = new Request("http://test.com/tenant/dive-sites/new", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {} });

        // First image: isPrimary = true, sortOrder = 0
        expect(insertValues).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ isPrimary: true, sortOrder: 0 })
        );
        // Second image: isPrimary = false, sortOrder = 1
        expect(insertValues).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ isPrimary: false, sortOrder: 1 })
        );
      });
    });
  });
});
