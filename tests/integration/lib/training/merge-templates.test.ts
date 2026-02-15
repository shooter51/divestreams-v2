import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mergeTemplateUpdates } from "../../../../lib/training/merge-templates.server";
import { db } from "../../../../lib/db";
import { trainingCourses, certificationAgencies, agencyCourseTemplates } from "../../../../lib/db/schema/training";
import { organization } from "../../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { generateContentHash } from "../../../../lib/utils/content-hash.server";

const hasDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('divestreams:divestreams');

describe.skipIf(!hasDb)("mergeTemplateUpdates", () => {
  let testOrgId: string;
  let testAgencyId: string;
  let testTemplateId: string;
  let testCourseId: string;
  let uniqueCode: string;

  beforeEach(async () => {
    uniqueCode = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Get or create org for testing
    let existingOrg = await db.query.organization.findFirst();
    if (!existingOrg) {
      const [org] = await db.insert(organization).values({
        id: crypto.randomUUID(),
        name: "Test Organization",
        slug: `test-org-${Date.now()}`,
      }).returning();
      existingOrg = org;
    }
    testOrgId = existingOrg.id;

    // Create test agency
    const [agency] = await db
      .insert(certificationAgencies)
      .values({ organizationId: testOrgId, name: "Test Agency", code: uniqueCode })
      .returning();
    testAgencyId = agency.id;

    // Create template
    const templateData = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: ["course.jpg"],
      durationDays: 3,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: "None",
      minAge: 10,
      medicalRequirements: "Medical form",
      requiredItems: ["mask", "fins"],
      materialsIncluded: true,
    };

    const [template] = await db
      .insert(agencyCourseTemplates)
      .values({
        agencyId: testAgencyId,
        ...templateData,
        contentHash: generateContentHash(templateData),
        sourceType: "static_json",
        sourceUrl: null,
      })
      .returning();
    testTemplateId = template.id;

    // Create course linked to template with TENANT-SPECIFIC fields
    const [course] = await db
      .insert(trainingCourses)
      .values({
        organizationId: testOrgId,
        name: "Open Water Diver",
        description: "Learn to dive",
        templateId: testTemplateId,
        templateHash: template.contentHash,
        // Tenant-specific fields
        price: "450.00",
        maxStudents: 8,
        isActive: true,
        images: ["custom-shop-photo.jpg"],
      })
      .returning();
    testCourseId = course.id;
  });

  afterEach(async () => {
    if (testCourseId) {
      await db.delete(trainingCourses).where(eq(trainingCourses.id, testCourseId));
    }
    if (testTemplateId) {
      await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.id, testTemplateId));
    }
    if (testAgencyId) {
      await db.delete(certificationAgencies).where(eq(certificationAgencies.id, testAgencyId));
    }
  });

  it("should update agency fields while preserving tenant fields", async () => {
    // Update template with new agency data
    const updatedTemplateData = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Updated agency description",
      images: ["new-agency-photo.jpg"],
      durationDays: 4, // Changed from 3
      classroomHours: 10, // Changed from 8
      poolHours: 8,
      openWaterDives: 5, // Changed from 4
      prerequisites: "Medical clearance required", // Changed
      minAge: 12, // Changed from 10
      medicalRequirements: "Updated medical form",
      requiredItems: ["mask", "fins", "dive computer"], // Added item
      materialsIncluded: true,
    };

    await db
      .update(agencyCourseTemplates)
      .set({
        ...updatedTemplateData,
        contentHash: generateContentHash(updatedTemplateData),
        updatedAt: new Date(),
      })
      .where(eq(agencyCourseTemplates.id, testTemplateId));

    // Run merge
    await mergeTemplateUpdates(testOrgId);

    // Check results
    const updatedCourse = await db.query.trainingCourses.findFirst({
      where: eq(trainingCourses.id, testCourseId),
    });

    expect(updatedCourse).toBeDefined();

    // Agency fields should be UPDATED
    expect(updatedCourse!.description).toBe("Updated agency description");
    expect(updatedCourse!.durationDays).toBe(4);
    expect(updatedCourse!.classroomHours).toBe(10);
    expect(updatedCourse!.openWaterDives).toBe(5);
    expect(updatedCourse!.prerequisites).toBe("Medical clearance required");
    expect(updatedCourse!.minAge).toBe(12);

    // Tenant fields should be PRESERVED
    expect(updatedCourse!.price).toBe("450.00");
    expect(updatedCourse!.maxStudents).toBe(8);
    expect(updatedCourse!.isActive).toBe(true);
    expect(updatedCourse!.images).toEqual(["custom-shop-photo.jpg"]);

    // Template hash should be updated
    const newTemplate = await db.query.agencyCourseTemplates.findFirst({
      where: eq(agencyCourseTemplates.id, testTemplateId),
    });
    expect(updatedCourse!.templateHash).toBe(newTemplate!.contentHash);
  });

  it("should skip courses not linked to templates", async () => {
    // Create course WITHOUT template link
    const [standaloneCourseBefore] = await db
      .insert(trainingCourses)
      .values({
        organizationId: testOrgId,
        name: "Custom Course",
        description: "Shop-specific course",
        price: "300.00",
        maxStudents: 6,
        isActive: true,
        templateId: null,
        templateHash: null,
      })
      .returning();

    await mergeTemplateUpdates(testOrgId);

    // Standalone course should be unchanged
    const standaloneAfter = await db.query.trainingCourses.findFirst({
      where: eq(trainingCourses.id, standaloneCourseBefore.id),
    });

    expect(standaloneAfter!.description).toBe("Shop-specific course");

    // Cleanup
    await db.delete(trainingCourses).where(eq(trainingCourses.id, standaloneCourseBefore.id));
  });
});
