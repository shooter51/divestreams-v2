import { db } from "./index";
import { agencyCourseTemplates } from "./schema/training";
import { eq, and, isNull } from "drizzle-orm";
import type { AgencyFieldsForHash } from "../utils/content-hash.server";

// Input for global templates (no tenant-specific agency reference)
export interface UpsertGlobalTemplateInput extends AgencyFieldsForHash {
  agencyCode: string; // e.g., "padi", "ssi"
  levelCode: string | null; // e.g., "beginner", "advanced"
  contentHash: string;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

// Input for tenant-specific templates (linked to tenant's agency)
export interface UpsertTemplateInput extends AgencyFieldsForHash {
  agencyId: string;
  levelId: string | null;
  contentHash: string;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

/**
 * Upsert a global agency course template (not tenant-specific)
 * Uses agencyCode for identification instead of agencyId
 */
export async function upsertGlobalAgencyCourseTemplate(input: UpsertGlobalTemplateInput) {
  // Look for existing template by agency code and course code
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
    agencyId: null, // Global templates don't have tenant-specific agency
    levelId: null, // Global templates don't have tenant-specific level
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
    // Update existing
    const [updated] = await db
      .update(agencyCourseTemplates)
      .set(templateData)
      .where(eq(agencyCourseTemplates.id, existing[0].id))
      .returning();
    return updated;
  } else {
    // Insert new
    const [inserted] = await db
      .insert(agencyCourseTemplates)
      .values(templateData)
      .returning();
    return inserted;
  }
}

/**
 * Legacy: Upsert a tenant-specific course template
 * @deprecated Use upsertGlobalAgencyCourseTemplate for seeding global templates
 */
export async function upsertAgencyCourseTemplate(input: UpsertTemplateInput) {
  const existing = input.code
    ? await db
        .select()
        .from(agencyCourseTemplates)
        .where(
          and(
            eq(agencyCourseTemplates.agencyId, input.agencyId),
            eq(agencyCourseTemplates.code, input.code)
          )
        )
        .limit(1)
    : [];

  const templateData = {
    agencyId: input.agencyId,
    levelId: input.levelId,
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
    // Update existing
    const [updated] = await db
      .update(agencyCourseTemplates)
      .set(templateData)
      .where(eq(agencyCourseTemplates.id, existing[0].id))
      .returning();
    return updated;
  } else {
    // Insert new
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
    .where(
      and(
        eq(agencyCourseTemplates.agencyCode, agencyCode),
        isNull(agencyCourseTemplates.agencyId) // Global templates have null agencyId
      )
    )
    .orderBy(agencyCourseTemplates.name);
}

/**
 * Get all global templates (not tenant-specific)
 */
export async function getAllGlobalAgencyCourseTemplates() {
  return db
    .select()
    .from(agencyCourseTemplates)
    .where(isNull(agencyCourseTemplates.agencyId))
    .orderBy(agencyCourseTemplates.agencyCode, agencyCourseTemplates.name);
}

/**
 * Get all available agencies from global templates
 * Returns unique agency codes with metadata
 */
export async function getAvailableAgencies() {
  const agencies = await db
    .selectDistinct({ agencyCode: agencyCourseTemplates.agencyCode })
    .from(agencyCourseTemplates)
    .where(isNull(agencyCourseTemplates.agencyId))
    .orderBy(agencyCourseTemplates.agencyCode);

  // Map agency codes to full names
  const agencyMetadata: Record<string, { name: string; description?: string }> = {
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

  return agencies.map(({ agencyCode }) => ({
    code: agencyCode,
    name: agencyMetadata[agencyCode]?.name || agencyCode.toUpperCase(),
    description: agencyMetadata[agencyCode]?.description,
  }));
}

/**
 * Legacy: Get templates for a tenant-specific agency
 */
export async function getAgencyCourseTemplates(agencyId: string) {
  return db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.agencyId, agencyId))
    .orderBy(agencyCourseTemplates.name);
}
