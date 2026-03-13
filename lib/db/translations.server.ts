import { eq, and, inArray, like } from "drizzle-orm";
import { db } from "./index";
import { contentTranslations } from "./schema/translations";
import {
  stripHtmlTags,
  removeSourceContamination,
} from "../translation/bedrock.server";

/**
 * Get all translated fields for a specific entity in a locale.
 * Returns a map of field -> translated value.
 */
export async function getContentTranslations(
  orgId: string,
  entityType: string,
  entityId: string,
  locale: string
): Promise<Record<string, string>> {
  const rows = await db
    .select({
      field: contentTranslations.field,
      value: contentTranslations.value,
    })
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.organizationId, orgId),
        eq(contentTranslations.entityType, entityType),
        eq(contentTranslations.entityId, entityId),
        eq(contentTranslations.locale, locale)
      )
    );

  return Object.fromEntries(rows.map((r) => [r.field, r.value]));
}

/**
 * Get an entity with translations merged over English defaults.
 * Only translatable fields that have translations will be overridden.
 */
export async function getTranslatedEntity<T extends Record<string, unknown>>(
  orgId: string,
  entityType: string,
  entityId: string,
  locale: string,
  entity: T,
  translatableFields: string[]
): Promise<T> {
  if (locale === "en") return entity;

  const translations = await getContentTranslations(
    orgId,
    entityType,
    entityId,
    locale
  );

  const overrides: Record<string, unknown> = {};
  for (const field of translatableFields) {
    if (translations[field] !== undefined) {
      overrides[field] = translations[field];
    }
  }

  return { ...entity, ...overrides };
}

/**
 * Create or update a single translation.
 */
export async function upsertContentTranslation(
  orgId: string,
  entityType: string,
  entityId: string,
  locale: string,
  field: string,
  value: string,
  source: "auto" | "manual" = "auto"
): Promise<void> {
  await db
    .insert(contentTranslations)
    .values({
      organizationId: orgId,
      entityType,
      entityId,
      locale,
      field,
      value,
      source,
    })
    .onConflictDoUpdate({
      target: [
        contentTranslations.organizationId,
        contentTranslations.entityType,
        contentTranslations.entityId,
        contentTranslations.locale,
        contentTranslations.field,
      ],
      set: {
        value,
        source,
        updatedAt: new Date(),
      },
    });
}

/**
 * Delete all translations for an entity (call on entity deletion).
 */
export async function deleteContentTranslations(
  orgId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await db
    .delete(contentTranslations)
    .where(
      and(
        eq(contentTranslations.organizationId, orgId),
        eq(contentTranslations.entityType, entityType),
        eq(contentTranslations.entityId, entityId)
      )
    );
}

/**
 * Bulk get translations for multiple entities (for list pages).
 * Returns a Map of entityId -> { field: value }.
 */
export async function bulkGetContentTranslations(
  orgId: string,
  entityType: string,
  entityIds: string[],
  locale: string
): Promise<Map<string, Record<string, string>>> {
  if (entityIds.length === 0) return new Map();

  const rows = await db
    .select({
      entityId: contentTranslations.entityId,
      field: contentTranslations.field,
      value: contentTranslations.value,
    })
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.organizationId, orgId),
        eq(contentTranslations.entityType, entityType),
        inArray(contentTranslations.entityId, entityIds),
        eq(contentTranslations.locale, locale)
      )
    );

  const result = new Map<string, Record<string, string>>();
  for (const row of rows) {
    if (!result.has(row.entityId)) {
      result.set(row.entityId, {});
    }
    result.get(row.entityId)![row.field] = row.value;
  }
  return result;
}

/**
 * Remove translations that contain HTML tags (e.g. "<p>Snorkel Safari</p>").
 * Strips the tags and updates the stored value in place. If stripping results
 * in an empty string the row is deleted instead.
 *
 * Returns the number of rows fixed.
 */
export async function cleanupCorruptedTranslations(): Promise<number> {
  // Fetch all auto translations that contain an opening HTML tag
  const rows = await db
    .select({
      id: contentTranslations.id,
      value: contentTranslations.value,
    })
    .from(contentTranslations)
    .where(like(contentTranslations.value, "%<%"));

  let fixed = 0;
  for (const row of rows) {
    // Only act when there is actually a tag in the value
    if (!/<\/?[^>]+(>|$)/.test(row.value)) continue;

    const cleaned = stripHtmlTags(row.value);
    if (!cleaned) {
      await db
        .delete(contentTranslations)
        .where(eq(contentTranslations.id, row.id));
    } else {
      await db
        .update(contentTranslations)
        .set({ value: cleaned, updatedAt: new Date() })
        .where(eq(contentTranslations.id, row.id));
    }
    fixed++;
  }
  return fixed;
}

/**
 * Remove source contamination from translations for a specific entity.
 * Compares each translated value against the supplied source fields map
 * (fieldName -> sourceText) and strips any suffix/prefix contamination.
 *
 * Returns the number of rows fixed.
 */
export async function cleanupSourceContaminationForEntity(
  orgId: string,
  entityType: string,
  entityId: string,
  sourceFields: Record<string, string>
): Promise<number> {
  if (Object.keys(sourceFields).length === 0) return 0;

  const rows = await db
    .select({
      id: contentTranslations.id,
      field: contentTranslations.field,
      value: contentTranslations.value,
    })
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.organizationId, orgId),
        eq(contentTranslations.entityType, entityType),
        eq(contentTranslations.entityId, entityId)
      )
    );

  let fixed = 0;
  for (const row of rows) {
    const sourceText = sourceFields[row.field];
    if (!sourceText) continue;

    const cleaned = removeSourceContamination(row.value, sourceText);
    if (cleaned !== row.value) {
      await db
        .update(contentTranslations)
        .set({ value: cleaned, updatedAt: new Date() })
        .where(eq(contentTranslations.id, row.id));
      fixed++;
    }
  }
  return fixed;
}
