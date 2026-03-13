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

const buildUpdateChain = () => {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set, _where: where };
};

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let deleteChain = buildDeleteChain();
let updateChain = buildUpdateChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => deleteChain),
    update: vi.fn(() => updateChain),
    selectDistinct: vi.fn(() => selectChain),
  },
}));

vi.mock("../../../../lib/db/schema/translations", () => ({
  contentTranslations: {
    id: "id",
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
  like: vi.fn((a, b) => ({ like: [a, b] })),
}));

vi.mock("../../../../lib/translation/bedrock.server", () => ({
  stripHtmlTags: vi.fn((text: string) =>
    text.replace(/<\/?[^>]+(>|$)/g, "").trim()
  ),
  removeSourceContamination: vi.fn((translated: string, original: string) => {
    if (!original || !translated) return translated;
    const t = translated.trim();
    const o = original.trim();
    if (t === o) return t;
    if (t.length > o.length && t.endsWith(o)) return t.slice(0, -o.length).trim();
    if (t.length > o.length && t.startsWith(o)) return t.slice(o.length).trim();
    return t;
  }),
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
    updateChain = buildUpdateChain();
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

  // ==========================================================================
  // DS-vlcg: cleanupCorruptedTranslations
  // ==========================================================================

  describe("cleanupCorruptedTranslations", () => {
    it("returns 0 when there are no rows with HTML tags", async () => {
      selectChain = buildSelectChain([
        { id: "t-1", value: "Snorkel Safari" },
        { id: "t-2", value: "Ocean Adventure" },
      ]);
      const { cleanupCorruptedTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupCorruptedTranslations();
      expect(fixed).toBe(0);
    });

    it("updates row when value contains HTML tags", async () => {
      selectChain = buildSelectChain([
        { id: "t-1", value: "<p>Snorkel Safari</p>" },
      ]);
      const { cleanupCorruptedTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupCorruptedTranslations();
      expect(fixed).toBe(1);
      const { db } = await import("../../../../lib/db/index");
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ value: "Snorkel Safari" })
      );
    });

    it("deletes row when stripping HTML leaves empty string", async () => {
      selectChain = buildSelectChain([{ id: "t-2", value: "<br/>" }]);
      const { cleanupCorruptedTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupCorruptedTranslations();
      expect(fixed).toBe(1);
      const { db } = await import("../../../../lib/db/index");
      expect(db.delete).toHaveBeenCalled();
    });

    it("fixes multiple HTML-tagged rows in one call", async () => {
      selectChain = buildSelectChain([
        { id: "t-1", value: "<p>Nombre</p>" },
        { id: "t-2", value: "<span>Descripción</span>" },
        { id: "t-3", value: "Clean value" },
      ]);
      const { cleanupCorruptedTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupCorruptedTranslations();
      expect(fixed).toBe(2);
    });

    it("returns 0 when there are no rows at all", async () => {
      selectChain = buildSelectChain([]);
      const { cleanupCorruptedTranslations } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupCorruptedTranslations();
      expect(fixed).toBe(0);
    });
  });

  // ==========================================================================
  // DS-u6vq: cleanupSourceContaminationForEntity
  // ==========================================================================

  describe("cleanupSourceContaminationForEntity", () => {
    it("returns 0 when sourceFields is empty", async () => {
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        {}
      );
      expect(fixed).toBe(0);
    });

    it("returns 0 when no rows exist for the entity", async () => {
      selectChain = buildSelectChain([]);
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        { name: "Discovery Scuba Diving" }
      );
      expect(fixed).toBe(0);
    });

    it("fixes row with source text appended as suffix", async () => {
      selectChain = buildSelectChain([
        {
          id: "t-1",
          field: "name",
          value: "Descubre el Buceo Discovery Scuba Diving",
        },
      ]);
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        { name: "Discovery Scuba Diving" }
      );
      expect(fixed).toBe(1);
      const { db } = await import("../../../../lib/db/index");
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ value: "Descubre el Buceo" })
      );
    });

    it("does not update rows with clean translations", async () => {
      selectChain = buildSelectChain([
        { id: "t-1", field: "name", value: "Safari de Snorkel" },
      ]);
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        { name: "Snorkel Safari" }
      );
      expect(fixed).toBe(0);
    });

    it("skips rows whose field is not in sourceFields", async () => {
      selectChain = buildSelectChain([
        {
          id: "t-1",
          field: "description",
          value: "Some description Discovery Scuba Diving",
        },
      ]);
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      // sourceFields only has 'name', not 'description'
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        { name: "Discovery Scuba Diving" }
      );
      expect(fixed).toBe(0);
    });

    it("fixes multiple contaminated fields in one call", async () => {
      selectChain = buildSelectChain([
        {
          id: "t-1",
          field: "name",
          value: "Descubre el Buceo Discovery Scuba Diving",
        },
        {
          id: "t-2",
          field: "shortDescription",
          value: "Descripción breve Short Desc",
        },
        { id: "t-3", field: "description", value: "Desc larga Long Desc" },
      ]);
      const { cleanupSourceContaminationForEntity } = await import(
        "../../../../lib/db/translations.server"
      );
      const fixed = await cleanupSourceContaminationForEntity(
        "org-1",
        "trip",
        "trip-1",
        {
          name: "Discovery Scuba Diving",
          shortDescription: "Short Desc",
          description: "Long Desc",
        }
      );
      expect(fixed).toBe(3);
    });
  });
});
