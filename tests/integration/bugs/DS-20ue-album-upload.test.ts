/**
 * DS-20ue: Album image upload fails
 *
 * Integration tests to verify the gallery upload action returns redirect URLs
 * with detectable success/error params (matching what the E2E test captures
 * via route.fetch({ maxRedirects: 0 })).
 *
 * Root cause: The E2E test's page.route() interceptor called route.fetch()
 * without maxRedirects: 0. Since route.fetch() defaults to following up to
 * 20 redirects, capturedRedirectLocation was always empty — the test never
 * detected success or storage errors and fell through to DOM checks that
 * also failed (no images, no notification in the HTML at the wrong URL).
 *
 * Fix: Added { maxRedirects: 0 } to route.fetch() in the E2E test so the
 * 302 redirect is captured directly and the Location header is inspectable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../app/routes/tenant/gallery/upload";

vi.mock("../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
      org: { id: "test-org-id", name: "Test Org", slug: "test" },
      membership: { role: "owner" },
      subscription: null,
    })
  ),
  requireRole: vi.fn(),
}));

vi.mock("../../../lib/storage", () => ({
  uploadToS3: vi.fn((key: string) =>
    Promise.resolve({ cdnUrl: `https://cdn.example.com/${key}`, key })
  ),
  getImageKey: vi.fn(),
  getWebPMimeType: vi.fn(() => "image/webp"),
  processImage: vi.fn((buffer: Buffer) =>
    Promise.resolve({ original: buffer, thumbnail: buffer, width: 800, height: 600 })
  ),
  isValidImageType: vi.fn((type: string) => type.startsWith("image/")),
  getS3Client: vi.fn(() => ({ config: {} })),
}));

vi.mock("../../../lib/db/gallery.server", () => ({
  createGalleryImage: vi.fn((orgId, data) =>
    Promise.resolve({ id: "test-image-id", ...data, createdAt: new Date(), updatedAt: new Date() })
  ),
}));

describe("DS-20ue: Gallery upload redirect URL format", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { isValidImageType, uploadToS3, getS3Client } = await import("../../../lib/storage");
    vi.mocked(isValidImageType).mockImplementation((type: string) => type.startsWith("image/"));
    vi.mocked(uploadToS3).mockImplementation((key: string) =>
      Promise.resolve({ cdnUrl: `https://cdn.example.com/${key}`, key })
    );
    vi.mocked(getS3Client).mockReturnValue({ config: {} } as unknown);
  });

  it("success redirect Location contains parseable ?success= param", async () => {
    // This is what page.route() + route.fetch({ maxRedirects: 0 }) captures in the E2E test.
    // The capturedRedirectLocation must have a ?success= param for the test to pass early.
    const formData = new FormData();
    const file = new File(["fake-jpeg-data"], "test.jpg", { type: "image/jpeg" });
    formData.append("file", file);
    formData.append("albumId", "album-123");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location")!;

    // Simulate what the E2E test does after capturing capturedRedirectLocation
    const locUrl = new URL(location, "http://localhost");
    const successParam = locUrl.searchParams.get("success");

    expect(successParam).toBeTruthy();
    expect(successParam!.toLowerCase()).toMatch(/successfully uploaded/);
  });

  it("storage-error redirect Location contains parseable ?error= param with 'storage' keyword", async () => {
    // When S3 is not configured, the E2E test should detect this and skip.
    // This requires capturedRedirectLocation to have ?error= containing 'storage'.
    const { getS3Client } = await import("../../../lib/storage");
    vi.mocked(getS3Client).mockReturnValueOnce(null);

    const formData = new FormData();
    const file = new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" });
    formData.append("file", file);
    formData.append("albumId", "album-123");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location")!;

    // Simulate E2E test's errLower.includes('storage') check
    const locUrl = new URL(location, "http://localhost");
    const errorParam = locUrl.searchParams.get("error")!;

    expect(errorParam).toBeTruthy();
    expect(errorParam.toLowerCase()).toContain("storage");
  });

  it("no-file redirect Location contains parseable ?error= param with 'no files' keyword", async () => {
    const formData = new FormData();
    formData.append("albumId", "album-123");

    const request = new Request("http://localhost/tenant/gallery/upload", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as unknown);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location")!;

    const locUrl = new URL(location, "http://localhost");
    const errorParam = locUrl.searchParams.get("error")!;

    expect(errorParam).toBeTruthy();
    // E2E test checks errLower.includes('no files')
    expect(errorParam.toLowerCase()).toContain("no files");
  });
});
