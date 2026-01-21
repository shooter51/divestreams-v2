import { db } from "../db";
import { trainingCourses, agencyCourseTemplates } from "../db/schema/training";
import { eq, and, ne } from "drizzle-orm";

/**
 * Merges template updates into tenant courses while preserving tenant-specific fields.
 * Only updates courses where the template contentHash has changed.
 */
export async function mergeTemplateUpdates(organizationId: string) {
  // Find all courses linked to templates where hash differs
  const coursesToUpdate = await db
    .select({
      courseId: trainingCourses.id,
      templateId: trainingCourses.templateId,
      currentHash: trainingCourses.templateHash,
    })
    .from(trainingCourses)
    .innerJoin(
      agencyCourseTemplates,
      eq(trainingCourses.templateId, agencyCourseTemplates.id)
    )
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        ne(trainingCourses.templateHash, agencyCourseTemplates.contentHash)
      )
    );

  for (const course of coursesToUpdate) {
    // Get the latest template data
    const [template] = await db
      .select()
      .from(agencyCourseTemplates)
      .where(eq(agencyCourseTemplates.id, course.templateId!))
      .limit(1);

    if (!template) continue;

    // Update ONLY agency-controlled fields, preserving tenant fields
    await db
      .update(trainingCourses)
      .set({
        // Agency-controlled fields (from template)
        name: template.name,
        description: template.description,
        durationDays: template.durationDays,
        classroomHours: template.classroomHours,
        poolHours: template.poolHours,
        openWaterDives: template.openWaterDives,
        prerequisites: template.prerequisites,
        minAge: template.minAge,
        medicalRequirements: template.medicalRequirements,
        requiredItems: template.requiredItems,
        materialsIncluded: template.materialsIncluded,

        // Update template tracking
        templateHash: template.contentHash,
        updatedAt: new Date(),

        // TENANT fields are NOT included here, so they are preserved:
        // - price
        // - maxParticipants
        // - isActive
        // - images (tenant can override with shop-specific photos)
        // - etc.
      })
      .where(eq(trainingCourses.id, course.courseId));
  }

  return { updated: coursesToUpdate.length };
}
