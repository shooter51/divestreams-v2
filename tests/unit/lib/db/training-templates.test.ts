import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertAgencyCourseTemplate, getAgencyCourseTemplates } from "../../../../lib/db/training-templates.server";
import { db } from "../../../../lib/db";
import { certificationAgencies, certificationLevels, agencyCourseTemplates } from "../../../../lib/db/schema/training";
import { eq } from "drizzle-orm";

describe("upsertAgencyCourseTemplate", () => {
  let testAgencyId: string;
  let testLevelId: string;
  let testOrgId: string;
  let uniqueCode: string;

  beforeEach(async () => {
    // Generate unique code for this test run
    uniqueCode = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Get an existing organization ID (E2E Test Shop from the dev database)
    const existingOrg = await db.query.organization.findFirst();
    if (!existingOrg) {
      throw new Error("No organization found in test database");
    }
    testOrgId = existingOrg.id;

    // Create test agency with unique code
    const [agency] = await db
      .insert(certificationAgencies)
      .values({
        organizationId: testOrgId,
        name: "Test Agency",
        code: uniqueCode
      })
      .returning();
    testAgencyId = agency.id;

    // Create test level with unique code
    const [level] = await db
      .insert(certificationLevels)
      .values({
        organizationId: testOrgId,
        name: "Test Level",
        code: `level-${uniqueCode}`
      })
      .returning();
    testLevelId = level.id;
  });

  afterEach(async () => {
    // Cleanup - only if testAgencyId was set
    if (testAgencyId) {
      await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.agencyId, testAgencyId));
      await db.delete(certificationAgencies).where(eq(certificationAgencies.id, testAgencyId));
    }
    if (testLevelId) {
      await db.delete(certificationLevels).where(eq(certificationLevels.id, testLevelId));
    }
  });

  it("should insert new template", async () => {
    const template = {
      agencyId: testAgencyId,
      levelId: testLevelId,
      name: "Test Course",
      code: "TC-101",
      description: "Test description",
      images: ["test.jpg"],
      durationDays: 3,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: "None",
      minAge: 10,
      medicalRequirements: "Medical form",
      requiredItems: ["mask", "fins"],
      materialsIncluded: true,
      contentHash: "abc123",
      sourceType: "static_json" as const,
      sourceUrl: null,
    };

    const result = await upsertAgencyCourseTemplate(template);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe("Test Course");
    expect(result.contentHash).toBe("abc123");
  });

  it("should update existing template when code matches", async () => {
    // Insert initial template
    const initial = {
      agencyId: testAgencyId,
      levelId: testLevelId,
      name: "Test Course",
      code: "TC-101",
      description: "Old description",
      images: null,
      durationDays: 3,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: null,
      minAge: 10,
      medicalRequirements: null,
      requiredItems: null,
      materialsIncluded: true,
      contentHash: "old-hash",
      sourceType: "static_json" as const,
      sourceUrl: null,
    };

    await upsertAgencyCourseTemplate(initial);

    // Update with new data
    const updated = {
      ...initial,
      description: "New description",
      contentHash: "new-hash",
    };

    const result = await upsertAgencyCourseTemplate(updated);

    expect(result.description).toBe("New description");
    expect(result.contentHash).toBe("new-hash");

    // Verify only one record exists
    const all = await getAgencyCourseTemplates(testAgencyId);
    expect(all.length).toBe(1);
  });
});
