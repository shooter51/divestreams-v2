import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { contentTranslations } from "./schema/translations";
import { stripHtmlTags } from "../translation/bedrock.server";

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

  // Defensively strip any HTML tags that may have been stored by earlier
  // versions of the Bedrock worker before post-processing was added (DS-vlcg).
  return Object.fromEntries(rows.map((r) => [r.field, stripHtmlTags(r.value)]));
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
 * Delete content_translations rows that contain corrupted data from stale
 * Bedrock translations generated before post-processing was added.
 *
 * Removes rows where the translated value:
 *   1. Contains HTML tags (e.g. <p>Snorkel Safari</p>) — DS-vlcg
 *   2. Contains the original English appended/prepended as source contamination
 *      (e.g. "Descubre el Buceo Discovery Scuba Diving") — DS-u6vq
 *
 * Deleted rows will be regenerated cleanly by the translation background worker.
 * Returns the number of rows deleted.
 */
export async function cleanupCorruptedTranslations(): Promise<number> {
  const result = await db
    .delete(contentTranslations)
    .where(
      sql`${contentTranslations.value} ~ '<[^>]+(>|$)'`
    )
    .returning({ id: contentTranslations.id });

  return result.length;
}

/**
 * Delete content_translations rows that contain source-language text
 * contamination for a specific entity. Compares the stored translation value
 * against the known original text: if the value ends with or starts with the
 * original English text, the row is deleted so it can be regenerated.
 *
 * Returns the number of rows deleted.
 */
export async function cleanupSourceContaminationForEntity(
  orgId: string,
  entityType: string,
  entityId: string,
  originalTexts: Record<string, string>
): Promise<number> {
  const translations = await getContentTranslations(orgId, entityType, entityId, "es");
  const idsToDelete: string[] = [];

  for (const [field, originalText] of Object.entries(originalTexts)) {
    const translatedValue = translations[field];
    if (!translatedValue || !originalText) continue;

    const trimmedOriginal = originalText.trim();
    const trimmedTranslated = translatedValue.trim();

    // Detect source contamination: translated value ends or starts with original
    const hasSuffixContamination =
      trimmedTranslated.length > trimmedOriginal.length &&
      trimmedTranslated.endsWith(trimmedOriginal);
    const hasPrefixContamination =
      trimmedTranslated.length > trimmedOriginal.length &&
      trimmedTranslated.startsWith(trimmedOriginal);

    if (hasSuffixContamination || hasPrefixContamination) {
      idsToDelete.push(field);
    }
  }

  if (idsToDelete.length === 0) return 0;

  let deletedCount = 0;
  for (const field of idsToDelete) {
    await db
      .delete(contentTranslations)
      .where(
        and(
          eq(contentTranslations.organizationId, orgId),
          eq(contentTranslations.entityType, entityType),
          eq(contentTranslations.entityId, entityId),
          eq(contentTranslations.field, field)
        )
      );
    deletedCount++;
  }

  return deletedCount;
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
    // Defensively strip HTML tags stored by stale Bedrock worker (DS-vlcg)
    result.get(row.entityId)![row.field] = stripHtmlTags(row.value);
  }
  return result;
}
