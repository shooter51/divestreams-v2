import { db } from "./index";
import { agencyCourseTemplates } from "./schema/training";
import { eq, and, sql, asc } from "drizzle-orm";
import type { AgencyFieldsForHash } from "../utils/content-hash.server";
import type { TemplateTranslations } from "./schema/training";

// Input for global templates
export interface UpsertGlobalTemplateInput extends AgencyFieldsForHash {
  agencyCode: string; // e.g., "padi", "ssi"
  levelCode: string | null; // e.g., "beginner", "advanced"
  contentHash: string;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

// Agency metadata (hardcoded for now — could move to DB later)
export const AGENCY_METADATA: Record<string, { name: string; description?: string }> = {
  "padi": { name: "Professional Association of Diving Instructors", description: "World's leading scuba diving training organization" },
  "ssi": { name: "Scuba Schools International", description: "International dive training and certification agency" },
  "naui": { name: "National Association of Underwater Instructors", description: "Non-profit diving certification organization" },
  "sdi-tdi": { name: "Scuba Diving International / Technical Diving International", description: "Recreational and technical diving certification" },
  "gue": { name: "Global Underwater Explorers", description: "Technical diving and education organization" },
  "raid": { name: "Rebreather Association of International Divers", description: "Diving safety and education organization" },
  "bsac": { name: "British Sub-Aqua Club", description: "UK's leading diving club and training organization" },
  "cmas": { name: "World Underwater Federation", description: "International federation for underwater activities" },
  "iantd": { name: "International Association of Nitrox and Technical Divers", description: "Technical diving training organization" },
  "andi": { name: "American Nitrox Divers International", description: "Nitrox and technical diving certification" },
};

/**
 * Upsert a global agency course template
 * Uses agencyCode + code for identification
 */
export async function upsertGlobalAgencyCourseTemplate(input: UpsertGlobalTemplateInput) {
  const existing = input.code
    ? await db
        .select()
        .from(agencyCourseTemplates)
        .where(
          and(
            eq(agencyCourseTemplates.agencyCode, input.agencyCode),
            eq(agencyCourseTemplates.code, input.code)
          )
        )
        .limit(1)
    : [];

  const templateData = {
    agencyCode: input.agencyCode,
    levelCode: input.levelCode,
    name: input.name,
    code: input.code,
    description: input.description,
    images: input.images,
    durationDays: input.durationDays,
    classroomHours: input.classroomHours,
    poolHours: input.poolHours,
    openWaterDives: input.openWaterDives,
    prerequisites: input.prerequisites,
    minAge: input.minAge,
    medicalRequirements: input.medicalRequirements,
    requiredItems: input.requiredItems,
    materialsIncluded: input.materialsIncluded,
    contentHash: input.contentHash,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    const [updated] = await db
      .update(agencyCourseTemplates)
      .set(templateData)
      .where(eq(agencyCourseTemplates.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(agencyCourseTemplates)
      .values(templateData)
      .returning();
    return inserted;
  }
}

/**
 * Get all global templates for a specific agency (by code)
 */
export async function getGlobalAgencyCourseTemplates(agencyCode: string) {
  return db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.agencyCode, agencyCode))
    .orderBy(agencyCourseTemplates.name);
}

/**
 * Get all global templates
 */
export async function getAllGlobalAgencyCourseTemplates() {
  return db
    .select()
    .from(agencyCourseTemplates)
    .orderBy(agencyCourseTemplates.agencyCode, agencyCourseTemplates.name);
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(templateId: string) {
  const [template] = await db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.id, templateId));
  return template;
}

/**
 * Update a template (admin use)
 */
export async function updateTemplate(
  templateId: string,
  data: Partial<{
    name: string;
    description: string | null;
    images: string[] | null;
    translations: TemplateTranslations;
    durationDays: number;
    classroomHours: number | null;
    poolHours: number | null;
    openWaterDives: number | null;
    prerequisites: string | null;
    minAge: number | null;
    medicalRequirements: string | null;
    requiredItems: string[] | null;
    materialsIncluded: boolean | null;
  }>
) {
  const [updated] = await db
    .update(agencyCourseTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agencyCourseTemplates.id, templateId))
    .returning();
  return updated;
}

/**
 * Get all available agencies from global templates
 * Returns unique agency codes with metadata
 */
export async function getAvailableAgencies() {
  const agencies = await db
    .selectDistinct({ agencyCode: agencyCourseTemplates.agencyCode })
    .from(agencyCourseTemplates)
    .orderBy(agencyCourseTemplates.agencyCode);

  return agencies.map(({ agencyCode }) => ({
    code: agencyCode,
    name: agencyCode ? (AGENCY_METADATA[agencyCode]?.name || agencyCode.toUpperCase()) : "UNKNOWN",
    description: agencyCode ? AGENCY_METADATA[agencyCode]?.description : undefined,
  }));
}

/**
 * Get template count per agency
 */
export async function getAgencyTemplateCounts() {
  const result = await db
    .select({
      agencyCode: agencyCourseTemplates.agencyCode,
      count: sql<number>`count(*)::int`,
    })
    .from(agencyCourseTemplates)
    .groupBy(agencyCourseTemplates.agencyCode)
    .orderBy(asc(agencyCourseTemplates.agencyCode));

  return result;
}
