import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

vi.fn();
vi.fn();
vi.fn();
vi.fn();
vi.fn();
vi.fn();
vi.fn();
vi.fn();
vi.fn();

// Chain builders
const buildSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    leftJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
      groupBy: vi.fn().mockResolvedValue([]),
      limit: vi.fn().mockResolvedValue([]),
    }),
    orderBy: vi.fn().mockResolvedValue([]),
  }),
});

const buildInsertChain = () => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "img-1", organizationId: "org-1" }]),
  }),
});

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "img-1", organizationId: "org-1" }]),
    }),
  }),
});

const buildDeleteChain = () => ({
  where: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "img-1" }]),
  }),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let updateChain = buildUpdateChain();
let deleteChain = buildDeleteChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    selectDistinct: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
  },
}));

vi.mock("../../../../lib/db/schema/gallery", () => ({
  galleryImages: {
    id: "id",
    organizationId: "organizationId",
    albumId: "albumId",
    title: "title",
    description: "description",
    imageUrl: "imageUrl",
    thumbnailUrl: "thumbnailUrl",
    category: "category",
    tags: "tags",
    dateTaken: "dateTaken",
    location: "location",
    photographer: "photographer",
    tripId: "tripId",
    width: "width",
    height: "height",
    sortOrder: "sortOrder",
    isFeatured: "isFeatured",
    status: "status",
    metadata: "metadata",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  galleryAlbums: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    slug: "slug",
    coverImageUrl: "coverImageUrl",
    sortOrder: "sortOrder",
    isPublic: "isPublic",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args.filter(Boolean) })),
  desc: vi.fn((a) => ({ desc: a })),
  asc: vi.fn((a) => ({ asc: a })),
  sql: vi.fn(),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}));

describe("gallery.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    updateChain = buildUpdateChain();
    deleteChain = buildDeleteChain();
  });

  describe("type exports", () => {
    it("exports GalleryFilters interface shape", async () => {
      const filters: import("../../../../lib/db/gallery.server").GalleryFilters = {
        albumId: "album-1",
        category: "underwater",
        tags: ["reef"],
        featured: true,
        status: "published",
        limit: 10,
        offset: 0,
      };
      expect(filters.albumId).toBe("album-1");
    });
  });

  describe("getPublicGalleryImages", () => {
    it("returns empty array when no images found", async () => {
      const { getPublicGalleryImages } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getPublicGalleryImages("org-1");
      expect(result).toEqual([]);
    });

    it("accepts filters parameter", async () => {
      const { getPublicGalleryImages } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getPublicGalleryImages("org-1", {
        albumId: "album-1",
        category: "underwater",
        featured: true,
        limit: 10,
        offset: 5,
      });
      expect(result).toEqual([]);
    });
  });

  describe("getPublicGalleryImage", () => {
    it("returns null when image not found", async () => {
      const { getPublicGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getPublicGalleryImage("org-1", "img-999");
      expect(result).toBeNull();
    });
  });

  describe("getPublicGalleryAlbums", () => {
    it("returns empty array when no albums found", async () => {
      // Rebuild to return empty from first select
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getPublicGalleryAlbums } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getPublicGalleryAlbums("org-1");
      expect(result).toEqual([]);
    });
  });

  describe("createGalleryImage", () => {
    it("creates image and returns it", async () => {
      const { createGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await createGalleryImage("org-1", {
        title: "Test Image",
        imageUrl: "https://example.com/img.jpg",
      } as unknown);
      expect(result).toBeDefined();
      expect(result.id).toBe("img-1");
    });
  });

  describe("updateGalleryImage", () => {
    it("updates and returns image", async () => {
      const { updateGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await updateGalleryImage("org-1", "img-1", {
        title: "Updated Title",
      });
      expect(result).toBeDefined();
    });

    it("returns null when image not found", async () => {
      updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const { updateGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await updateGalleryImage("org-1", "img-999", {
        title: "Nope",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteGalleryImage", () => {
    it("returns true when image deleted", async () => {
      const { deleteGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await deleteGalleryImage("org-1", "img-1");
      expect(result).toBe(true);
    });

    it("returns false when image not found", async () => {
      deleteChain = {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      };

      const { deleteGalleryImage } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await deleteGalleryImage("org-1", "img-999");
      expect(result).toBe(false);
    });
  });

  describe("createGalleryAlbum", () => {
    it("creates album and returns it", async () => {
      insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "album-1", organizationId: "org-1", name: "Test Album" }]),
        }),
      };

      const { createGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await createGalleryAlbum("org-1", {
        name: "Test Album",
        slug: "test-album",
      } as unknown);
      expect(result).toBeDefined();
      expect(result.id).toBe("album-1");
    });
  });

  describe("updateGalleryAlbum", () => {
    it("updates and returns album", async () => {
      updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "album-1", name: "Updated" }]),
          }),
        }),
      };

      const { updateGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await updateGalleryAlbum("org-1", "album-1", { name: "Updated" });
      expect(result).toBeDefined();
    });

    it("returns null when album not found", async () => {
      updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const { updateGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await updateGalleryAlbum("org-1", "album-999", { name: "Nope" });
      expect(result).toBeNull();
    });
  });

  describe("deleteGalleryAlbum", () => {
    it("returns true when album deleted", async () => {
      const { deleteGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await deleteGalleryAlbum("org-1", "album-1");
      expect(result).toBe(true);
    });

    it("returns false when album not found", async () => {
      deleteChain = {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      };

      const { deleteGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await deleteGalleryAlbum("org-1", "album-999");
      expect(result).toBe(false);
    });
  });

  describe("getFeaturedGalleryImages", () => {
    it("returns empty array when no featured images", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getFeaturedGalleryImages } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getFeaturedGalleryImages("org-1");
      expect(result).toEqual([]);
    });

    it("accepts custom limit", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getFeaturedGalleryImages } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getFeaturedGalleryImages("org-1", 3);
      expect(result).toEqual([]);
    });
  });

  describe("getGalleryCategories", () => {
    it("returns empty array when no categories", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getGalleryCategories } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getGalleryCategories("org-1");
      expect(result).toEqual([]);
    });
  });

  describe("getGalleryTags", () => {
    it("returns empty array when no tags", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getGalleryTags } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getGalleryTags("org-1");
      expect(result).toEqual([]);
    });

    it("deduplicates and sorts tags", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { tags: ["reef", "coral"] },
            { tags: ["wreck", "reef"] },
            { tags: null },
          ]),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getGalleryTags } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getGalleryTags("org-1");
      expect(result).toEqual(["coral", "reef", "wreck"]);
    });
  });

  describe("getGalleryAlbum", () => {
    it("returns null when album not found", async () => {
      selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };

      const { getGalleryAlbum } = await import(
        "../../../../lib/db/gallery.server"
      );
      const result = await getGalleryAlbum("org-1", "album-999");
      expect(result).toBeNull();
    });
  });
});
