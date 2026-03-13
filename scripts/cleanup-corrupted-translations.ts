/**
 * One-time cleanup script for DS-vlcg and DS-u6vq.
 *
 * Fixes two classes of corrupted translations that were stored by the Bedrock
 * translation worker before post-processing guards were in place:
 *
 *   DS-vlcg — HTML tags in translated values (e.g. "<p>Snorkel Safari</p>")
 *   DS-u6vq — Source language text concatenated with translation
 *             (e.g. "Descubre el Buceo Discovery Scuba Diving")
 *
 * HTML-tag corruption is handled globally by scanning all rows.
 * Source-contamination cleanup requires the original English text for each
 * entity, so it is run per-entity using the trips table as the primary
 * example (the entity type that surfaced both bugs).
 *
 * Usage:
 *   npx tsx scripts/cleanup-corrupted-translations.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { contentTranslations } from "../lib/db/schema/translations";
import {
  cleanupCorruptedTranslations,
  cleanupSourceContaminationForEntity,
} from "../lib/db/translations.server";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Dynamic import of trip schema — trips is the entity type that triggered
// both bugs, but the cleanup helpers are generic.
// ---------------------------------------------------------------------------
async function getTripSourceFields(
  orgId: string,
  tripId: string
): Promise<Record<string, string>> {
  // Import lazily so the script can fail gracefully if the schema changes
  const { trips } = await import("../lib/db/schema/trips");
  const rows = await db
    .select({
      name: trips.name,
      description: trips.description,
      shortDescription: trips.shortDescription,
    })
    .from(trips)
    .where(and(eq(trips.organizationId, orgId), eq(trips.id, tripId)))
    .limit(1);

  if (rows.length === 0) return {};

  const row = rows[0];
  const fields: Record<string, string> = {};
  if (row.name) fields.name = row.name;
  if (row.description) fields.description = row.description;
  if (row.shortDescription) fields.shortDescription = row.shortDescription;
  return fields;
}

async function run() {
  console.log("=== Translation cleanup script ===");

  // Step 1: Remove HTML-tag corruption from all rows
  console.log("\n[1/2] Cleaning HTML-tagged translations...");
  const htmlFixed = await cleanupCorruptedTranslations();
  console.log(`      Fixed ${htmlFixed} row(s) with HTML tags.`);

  // Step 2: Fix source contamination on trip translations
  console.log("\n[2/2] Cleaning source-contamination on trip translations...");

  // Fetch all distinct (orgId, entityId) pairs for entity_type = 'trip'
  const tripRows = await db
    .selectDistinct({
      organizationId: contentTranslations.organizationId,
      entityId: contentTranslations.entityId,
    })
    .from(contentTranslations)
    .where(eq(contentTranslations.entityType, "trip"));

  let contaminationFixed = 0;
  for (const { organizationId, entityId } of tripRows) {
    const sourceFields = await getTripSourceFields(organizationId, entityId);
    if (Object.keys(sourceFields).length === 0) continue;

    const fixed = await cleanupSourceContaminationForEntity(
      organizationId,
      "trip",
      entityId,
      sourceFields
    );
    contaminationFixed += fixed;
  }
  console.log(
    `      Fixed ${contaminationFixed} row(s) with source contamination.`
  );

  console.log(
    `\nDone. Total rows cleaned: ${htmlFixed + contaminationFixed}.`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Cleanup script failed:", err);
  process.exit(1);
});
