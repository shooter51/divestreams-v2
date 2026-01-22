import { db } from "../db";
import { trainingCourses, agencyCourseTemplates } from "../db/schema/training";
import { eq, and, ne, inArray } from "drizzle-orm";

/**
 * Merges template updates into tenant courses while preserving tenant-specific fields.
 * Only updates courses where the template contentHash has changed.
 */
export async function mergeTemplateUpdates(organizationId: string) {
  try {
    return await db.transaction(async (tx) => {
      // Find all courses linked to templates where hash differs
      const coursesToUpdate = await tx
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

      if (coursesToUpdate.length === 0) {
        return { updated: 0 };
      }

      // Fix N+1 query: Fetch all unique template IDs in a single query
      const templateIds = [...new Set(coursesToUpdate.map(c => c.templateId!))];
      const templates = await tx
        .select()
        .from(agencyCourseTemplates)
        .where(inArray(agencyCourseTemplates.id, templateIds));

      // Create a Map for O(1) lookup
      const templateMap = new Map(templates.map(t => [t.id, t]));

      for (const course of coursesToUpdate) {
        const template = templateMap.get(course.templateId!);

        if (!template) {
          console.warn(`Template ${course.templateId} not found for course ${course.courseId}`);
          continue;
        }

        // Update ONLY agency-controlled fields, preserving tenant fields
        await tx
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
    });
  } catch (error) {
    console.error(`Failed to merge template updates for org ${organizationId}:`, error);
    throw new Error(`Template merge failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
