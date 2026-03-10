import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup — module-level chain variables so closures pick up reassignments
// ============================================================================

const buildSelectChain = (rows: unknown[] = []) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertChain = () => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  return { values, _onConflictDoUpdate: onConflictDoUpdate };
};

const buildDeleteChain = () => ({
  where: vi.fn().mockResolvedValue(undefined),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let deleteChain = buildDeleteChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => deleteChain),
  },
}));

vi.mock("../../../../lib/db/schema/translations", () => ({
  contentTranslations: {
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
    locale: "locale",
    field: "field",
    value: "value",
    source: "source",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args.filter(Boolean) })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}));

// ============================================================================
// Tests
// ============================================================================

describe("translations.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    deleteChain = buildDeleteChain();
  });

  describe("getContentTranslations", () => {
    it("returns empty object when no translations found", async () => {
      selectChain = buildSelectChain([]);
      const { getContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getContentTranslations("org-1", "tour", "tour-1", "es");
      expect(result).toEqual({});
    });

    it("returns field/value map from DB rows", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Tour en Español" },
        { field: "description", value: "Descripción del tour" },
      ]);
      const { getContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getContentTranslations("org-1", "tour", "tour-1", "es");
      expect(result).toEqual({
        name: "Tour en Español",
        description: "Descripción del tour",
      });
    });

    it("handles multiple fields correctly", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Nom" },
        { field: "shortDescription", value: "Desc courte" },
        { field: "description", value: "Desc longue" },
      ]);
      const { getContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getContentTranslations("org-1", "tour", "tour-2", "fr");
      expect(Object.keys(result)).toHaveLength(3);
      expect(result.name).toBe("Nom");
    });
  });

  describe("getTranslatedEntity", () => {
    it("returns entity unchanged for 'en' locale (no DB call)", async () => {
      const entity = { id: "tour-1", name: "English Tour", description: "Desc" };
      const { getTranslatedEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getTranslatedEntity(
        "org-1",
        "tour",
        "tour-1",
        "en",
        entity,
        ["name", "description"]
      );
      expect(result).toEqual(entity);
    });

    it("merges translations over entity fields for non-en locale", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Tour Español" },
      ]);
      const entity = { id: "tour-1", name: "English Tour", description: "Desc" };
      const { getTranslatedEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getTranslatedEntity(
        "org-1",
        "tour",
        "tour-1",
        "es",
        entity,
        ["name", "description"]
      );
      expect(result.name).toBe("Tour Español");
      expect(result.description).toBe("Desc"); // no translation, keeps original
    });

    it("preserves non-translatable fields unchanged", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Translated Name" },
      ]);
      const entity = { id: "tour-1", name: "Tour", price: "50.00" };
      const { getTranslatedEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getTranslatedEntity(
        "org-1",
        "tour",
        "tour-1",
        "de",
        entity,
        ["name"]
      );
      expect(result.id).toBe("tour-1");
      expect(result.price).toBe("50.00");
      expect(result.name).toBe("Translated Name");
    });

    it("replaces (not concatenates) translated field values", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Safari de Snorkel" },
        { field: "description", value: "Descripción traducida" },
      ]);
      const entity = {
        id: "tour-1",
        name: "Snorkel Safari",
        description: "Original description",
      };
      const { getTranslatedEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getTranslatedEntity(
        "org-1",
        "tour",
        "tour-1",
        "es",
        entity,
        ["name", "description"]
      );
      // Must fully replace, not concatenate
      expect(result.name).toBe("Safari de Snorkel");
      expect(result.name).not.toContain("Snorkel Safari");
      expect(result.description).toBe("Descripción traducida");
      expect(result.description).not.toContain("Original description");
    });

    it("only overrides fields listed in translatableFields", async () => {
      selectChain = buildSelectChain([
        { field: "name", value: "Translated" },
        { field: "description", value: "Also translated" },
      ]);
      const entity = {
        id: "tour-1",
        name: "Original",
        description: "Original desc",
      };
      const { getTranslatedEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await getTranslatedEntity(
        "org-1",
        "tour",
        "tour-1",
        "de",
        entity,
        ["name"] // description not in translatableFields
      );
      expect(result.name).toBe("Translated");
      expect(result.description).toBe("Original desc");
    });
  });

  describe("upsertContentTranslation", () => {
    it("calls insert with correct values", async () => {
      const { upsertContentTranslation } = await import(
        "../../../../lib/db/translations.server"
      );
      await upsertContentTranslation(
        "org-1",
        "tour",
        "tour-1",
        "es",
        "name",
        "Nombre",
        "manual"
      );

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          entityType: "tour",
          entityId: "tour-1",
          locale: "es",
          field: "name",
          value: "Nombre",
          source: "manual",
        })
      );
    });

    it("defaults source to auto", async () => {
      const { upsertContentTranslation } = await import(
        "../../../../lib/db/translations.server"
      );
      await upsertContentTranslation("org-1", "tour", "tour-1", "es", "name", "Nombre");
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ source: "auto" })
      );
    });

    it("calls onConflictDoUpdate with value and source in set", async () => {
      const { upsertContentTranslation } = await import(
        "../../../../lib/db/translations.server"
      );
      await upsertContentTranslation(
        "org-1",
        "tour",
        "tour-1",
        "es",
        "name",
        "Nombre"
      );
      expect(insertChain._onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.objectContaining({ value: "Nombre", source: "auto" }),
        })
      );
    });
  });

  describe("deleteContentTranslations", () => {
    it("calls delete and where for the entity", async () => {
      const { deleteContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      await deleteContentTranslations("org-1", "tour", "tour-1");

      const { db } = await import("../../../../lib/db/index");
      expect(db.delete).toHaveBeenCalled();
      expect(deleteChain.where).toHaveBeenCalled();
    });

    it("resolves without error", async () => {
      const { deleteContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      await expect(
        deleteContentTranslations("org-1", "course", "course-99")
      ).resolves.toBeUndefined();
    });
  });

  describe("bulkGetContentTranslations", () => {
    it("returns empty Map and skips DB when entityIds is empty", async () => {
      const { bulkGetContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await bulkGetContentTranslations("org-1", "tour", [], "es");
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      const { db } = await import("../../../../lib/db/index");
      expect(db.select).not.toHaveBeenCalled();
    });

    it("groups translations by entityId", async () => {
      selectChain = buildSelectChain([
        { entityId: "tour-1", field: "name", value: "Tour Uno" },
        { entityId: "tour-1", field: "description", value: "Desc Uno" },
        { entityId: "tour-2", field: "name", value: "Tour Dos" },
      ]);
      const { bulkGetContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await bulkGetContentTranslations(
        "org-1",
        "tour",
        ["tour-1", "tour-2"],
        "es"
      );
      expect(result.size).toBe(2);
      expect(result.get("tour-1")).toEqual({
        name: "Tour Uno",
        description: "Desc Uno",
      });
      expect(result.get("tour-2")).toEqual({ name: "Tour Dos" });
    });

    it("returns empty Map when no translations exist for the entities", async () => {
      selectChain = buildSelectChain([]);
      const { bulkGetContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await bulkGetContentTranslations(
        "org-1",
        "tour",
        ["tour-1", "tour-2"],
        "es"
      );
      expect(result.size).toBe(0);
    });

    it("handles single entity correctly", async () => {
      selectChain = buildSelectChain([
        { entityId: "tour-5", field: "name", value: "Solo Tour" },
      ]);
      const { bulkGetContentTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const result = await bulkGetContentTranslations(
        "org-1",
        "tour",
        ["tour-5"],
        "pt"
      );
      expect(result.size).toBe(1);
      expect(result.get("tour-5")).toEqual({ name: "Solo Tour" });
    });
  });
});
