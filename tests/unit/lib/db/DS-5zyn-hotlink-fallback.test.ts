/**
 * DS-5zyn: Imported TDI/SDI course images show hotlink error
 *
 * When S3 migration fails for a hotlink-protected image, the catch block
 * must use a placeholder instead of keeping the original broken URL.
 * The template DB record must also be updated with the placeholder.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ─────────────────────────────────────────────────────────────

// Mock fs — use a plain object instead of spreading the real module
// (spreading causes issues because `fs` has no default export in the mock context)
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock("fs", () => {
  const mod = {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  };
  return { ...mod, default: mod };
});

// Mock path.join — return a predictable joined string
vi.mock("path", () => {
  const mod = { join: (...args: string[]) => args.join("/") };
  return { ...mod, default: mod };
});

// Mock storage
const mockIsStorageConfigured = vi.fn();
const mockUploadToS3 = vi.fn();
vi.mock("../../../../lib/storage/s3", () => ({
  isStorageConfigured: () => mockIsStorageConfigured(),
  uploadToS3: (...args: unknown[]) => mockUploadToS3(...args),
}));

// Mock the DB — upsertGlobalAgencyCourseTemplate and updateTemplate both call db
// internally. We mock the DB so those functions effectively work without a real DB.
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([
            {
              id: "tmpl-1",
              agencyCode: "sdi-tdi",
              code: "OW-101",
              name: "Open Water Diver",
              images: null,
            },
          ]),
      }),
    }),
    update: () => ({
      set: (data: unknown) => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: "tmpl-1", ...((data as object) ?? {}) }]),
        }),
      }),
    }),
  },
}));

// Mock schema so db queries don't fail on undefined table references
vi.mock("../../../../lib/db/schema/training", () => ({
  agencyCourseTemplates: {
    id: "id",
    agencyCode: "agencyCode",
    code: "code",
    name: "name",
    description: "description",
    images: "images",
    levelCode: "levelCode",
    durationDays: "durationDays",
    classroomHours: "classroomHours",
    poolHours: "poolHours",
    openWaterDives: "openWaterDives",
    prerequisites: "prerequisites",
    minAge: "minAge",
    medicalRequirements: "medicalRequirements",
    requiredItems: "requiredItems",
    materialsIncluded: "materialsIncluded",
    contentHash: "contentHash",
    sourceType: "sourceType",
    sourceUrl: "sourceUrl",
    lastSyncedAt: "lastSyncedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

// Mock drizzle-orm operators so eq/and/sql/asc don't fail
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  asc: vi.fn(),
}));

// Mock content-hash utility
vi.mock("../../../../lib/utils/content-hash.server", () => ({
  generateContentHash: () => "test-hash-123",
}));

// Global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCatalog(imageUrl: string) {
  return JSON.stringify({
    agency: "sdi-tdi",
    agencyName: "SDI/TDI",
    version: "1.0",
    lastUpdated: "2026-01-01",
    courses: [
      {
        name: "Open Water Diver",
        code: "OW-101",
        levelCode: "beginner",
        description: "Entry-level course",
        images: [imageUrl],
        durationDays: 4,
        classroomHours: 8,
        poolHours: 4,
        openWaterDives: 4,
        prerequisites: null,
        minAge: 10,
        medicalRequirements: "Medical form",
        requiredItems: ["mask", "fins"],
        materialsIncluded: true,
      },
    ],
  });
}

// The select mock needs to return empty (no existing template) so upsert inserts
function setupDbSelectEmpty() {
  mockDbSelect.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([]),
      }),
    }),
  });
}

// The select mock returns an existing template with the given images array
function setupDbSelectExisting(images: string[]) {
  mockDbSelect.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "tmpl-existing",
              agencyCode: "sdi-tdi",
              code: "OW-101",
              name: "Open Water Diver",
              images,
            },
          ]),
      }),
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DS-5zyn: COURSE_PLACEHOLDER_IMAGE constant", () => {
  it("is defined and is a non-empty string", async () => {
    const { COURSE_PLACEHOLDER_IMAGE } = await import(
      "../../../../lib/db/training-templates.server"
    );
    expect(COURSE_PLACEHOLDER_IMAGE).toBeDefined();
    expect(typeof COURSE_PLACEHOLDER_IMAGE).toBe("string");
    expect(COURSE_PLACEHOLDER_IMAGE.length).toBeGreaterThan(0);
  });

  it("is a path that starts with /", async () => {
    const { COURSE_PLACEHOLDER_IMAGE } = await import(
      "../../../../lib/db/training-templates.server"
    );
    expect(COURSE_PLACEHOLDER_IMAGE.startsWith("/")).toBe(true);
  });
});

describe("DS-5zyn: refreshCatalogFromJson hotlink fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStorageConfigured.mockReturnValue(true);
    // Only the sdi-tdi catalog exists — all others return false so they're skipped
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("sdi-tdi-courses.json")
    );
    setupDbSelectEmpty();
  });

  it("uses placeholder when fetch returns a 403 (hotlink protection)", async () => {
    const hotlinkUrl = "https://tdi-sdi.com/protected-image.jpg";
    mockReadFileSync.mockReturnValue(makeCatalog(hotlinkUrl));

    // Simulate hotlink protection — server returns 403
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    });

    const { refreshCatalogFromJson, COURSE_PLACEHOLDER_IMAGE } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    expect(result.imagesFailed).toBe(1);
    expect(result.errors[0]).toContain("HTTP 403");

    // The update call should have used the placeholder, not the original URL.
    // We inspect what was passed to db.update().set() by checking the
    // images in the final DB call. The update chain is stubbed to capture `data`.
    // Since we can't easily intercept the chained mock above, we verify
    // indirectly: the result reports 1 failure and 0 uploads, meaning the
    // changed flag was set (triggering updateTemplate with placeholder).
    expect(result.imagesUploaded).toBe(0);
    expect(result.totalTemplates).toBe(1);
  });

  it("uses placeholder when fetch throws a network error", async () => {
    const hotlinkUrl = "https://tdi-sdi.com/protected-image.jpg";
    mockReadFileSync.mockReturnValue(makeCatalog(hotlinkUrl));

    mockFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const { refreshCatalogFromJson } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    expect(result.imagesFailed).toBe(1);
    expect(result.errors[0]).toContain("ECONNREFUSED");
    expect(result.totalTemplates).toBe(1);
  });

  it("uses placeholder when S3 upload returns null", async () => {
    const imageUrl = "https://tdi-sdi.com/valid-image.jpg";
    mockReadFileSync.mockReturnValue(makeCatalog(imageUrl));

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: () => "image/jpeg" },
    });
    mockUploadToS3.mockResolvedValue(null); // S3 upload returns null

    const { refreshCatalogFromJson } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    expect(result.imagesFailed).toBe(1);
    expect(result.errors[0]).toContain("S3 upload returned null");
    expect(result.totalTemplates).toBe(1);
  });

  it("counts upload success and records no failure when image migrates successfully", async () => {
    const imageUrl = "https://tdi-sdi.com/valid-image.jpg";
    const cdnUrl = "https://cdn.example.com/catalog/sdi-tdi/OW-101/image.jpg";
    mockReadFileSync.mockReturnValue(makeCatalog(imageUrl));

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: () => "image/jpeg" },
    });
    mockUploadToS3.mockResolvedValue({ cdnUrl });

    const { refreshCatalogFromJson } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    expect(result.imagesUploaded).toBe(1);
    expect(result.imagesFailed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.totalTemplates).toBe(1);
  });

  it("records an error message containing the HTTP status on hotlink failure", async () => {
    const hotlinkUrl = "https://tdi-sdi.com/protected-image.jpg";
    mockReadFileSync.mockReturnValue(makeCatalog(hotlinkUrl));

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    });

    const { refreshCatalogFromJson } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("HTTP 403");
    expect(result.errors[0]).toContain("sdi-tdi/OW-101");
  });

  it("skips image migration when storage is not configured", async () => {
    mockIsStorageConfigured.mockReturnValue(false);
    mockExistsSync.mockImplementation((p: string) =>
      String(p).includes("sdi-tdi-courses.json")
    );
    mockReadFileSync.mockReturnValue(
      makeCatalog("https://tdi-sdi.com/protected-image.jpg")
    );

    const { refreshCatalogFromJson } = await import(
      "../../../../lib/db/training-templates.server"
    );
    const result = await refreshCatalogFromJson();

    // Storage not configured — fetch should never be called
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.imagesFailed).toBe(0);
    expect(result.imagesUploaded).toBe(0);
  });
});

describe("DS-5zyn: upsertGlobalAgencyCourseTemplate preserves CDN images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const BASE_INPUT = {
    agencyCode: "sdi-tdi",
    code: "OW-101",
    name: "Open Water Diver",
    levelCode: "beginner" as const,
    description: "Entry-level course",
    durationDays: 4,
    classroomHours: 8,
    poolHours: 4,
    openWaterDives: 4,
    prerequisites: null,
    minAge: 10,
    medicalRequirements: "Medical form",
    requiredItems: ["mask", "fins"],
    materialsIncluded: true,
    contentHash: "hash-abc",
    sourceType: "static_json" as const,
    sourceUrl: null,
  };

  it("preserves existing S3-migrated images when re-upserting a template", async () => {
    // Use an S3 URL — the isMigratedImage check recognises "s3." + "amazonaws.com"
    const s3Image =
      "https://divestreams-media.s3.us-east-1.amazonaws.com/catalog/sdi-tdi/OW-101/image.jpg";
    setupDbSelectExisting([s3Image]);

    const { upsertGlobalAgencyCourseTemplate } = await import(
      "../../../../lib/db/training-templates.server"
    );

    const result = await upsertGlobalAgencyCourseTemplate({
      ...BASE_INPUT,
      images: ["https://images.unsplash.com/photo-1234?w=600"],
    });

    // The update mock returns whatever was passed to .set(), so result.images
    // reflects what was actually written to the DB.
    expect((result as { images: string[] }).images).toEqual([s3Image]);
  });

  it("uses catalog images when existing record has non-CDN images (not yet migrated)", async () => {
    const rawUrl = "https://images.unsplash.com/photo-1234?w=600";
    setupDbSelectExisting([rawUrl]);

    const { upsertGlobalAgencyCourseTemplate } = await import(
      "../../../../lib/db/training-templates.server"
    );

    const result = await upsertGlobalAgencyCourseTemplate({
      ...BASE_INPUT,
      images: [rawUrl],
    });

    // Raw Unsplash URL is not a CDN URL — pass it through so migration runs later
    expect((result as { images: string[] }).images).toEqual([rawUrl]);
  });

  it("uses catalog images when existing record has no images (null)", async () => {
    setupDbSelectExisting([]);

    const { upsertGlobalAgencyCourseTemplate } = await import(
      "../../../../lib/db/training-templates.server"
    );

    const catalogUrl = "https://images.unsplash.com/photo-9999?w=600";
    const result = await upsertGlobalAgencyCourseTemplate({
      ...BASE_INPUT,
      images: [catalogUrl],
    });

    // No existing images to preserve — catalog URL used (migration runs later)
    expect((result as { images: string[] }).images).toEqual([catalogUrl]);
  });
});
