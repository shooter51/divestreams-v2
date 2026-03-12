import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertGlobalAgencyCourseTemplate, getGlobalAgencyCourseTemplates } from "../../../../lib/db/training-templates.server";
import { db } from "../../../../lib/db";
import { agencyCourseTemplates } from "../../../../lib/db/schema/training";
import { eq } from "drizzle-orm";

// TODO: Re-enable when CI DB credentials match (password auth fails on ci-postgres)
describe.skip("upsertGlobalAgencyCourseTemplate", () => {
  const testAgencyCode = "test-agency";

  afterEach(async () => {
    await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.agencyCode, testAgencyCode));
  });

  it("should insert new template", async () => {
    const template = {
      agencyCode: testAgencyCode,
      levelCode: "beginner",
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

    const result = await upsertGlobalAgencyCourseTemplate(template);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe("Test Course");
    expect(result.contentHash).toBe("abc123");
  });

  it("should update existing template when code matches", async () => {
    const initial = {
      agencyCode: testAgencyCode,
      levelCode: "beginner",
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

    await upsertGlobalAgencyCourseTemplate(initial);

    // Update with new data
    const updated = {
      ...initial,
      description: "New description",
      contentHash: "new-hash",
    };

    const result = await upsertGlobalAgencyCourseTemplate(updated);

    expect(result.description).toBe("New description");
    expect(result.contentHash).toBe("new-hash");

    // Verify only one record exists
    const all = await getGlobalAgencyCourseTemplates(testAgencyCode);
    expect(all.length).toBe(1);
  });
});
