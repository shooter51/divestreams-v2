import { db } from "./index";
import { agencyCourseTemplates } from "./schema/training";
import { eq, and } from "drizzle-orm";
import type { AgencyFieldsForHash } from "../utils/content-hash.server";

export interface UpsertTemplateInput extends AgencyFieldsForHash {
  agencyId: string;
  levelId: string | null;
  contentHash: string;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

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

export async function getAgencyCourseTemplates(agencyId: string) {
  return db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.agencyId, agencyId))
    .orderBy(agencyCourseTemplates.name);
}
