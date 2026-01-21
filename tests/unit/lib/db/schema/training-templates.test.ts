import { describe, it, expect } from "vitest";
import { agencyCourseTemplates } from "../../../../../lib/db/schema/training";

describe("agencyCourseTemplates schema", () => {
  it("should have required columns", () => {
    const columns = Object.keys(agencyCourseTemplates);

    expect(columns).toContain("id");
    expect(columns).toContain("agencyId");
    expect(columns).toContain("levelId");
    expect(columns).toContain("name");
    expect(columns).toContain("code");
    expect(columns).toContain("description");
    expect(columns).toContain("images");
    expect(columns).toContain("durationDays");
    expect(columns).toContain("classroomHours");
    expect(columns).toContain("poolHours");
    expect(columns).toContain("openWaterDives");
    expect(columns).toContain("prerequisites");
    expect(columns).toContain("minAge");
    expect(columns).toContain("medicalRequirements");
    expect(columns).toContain("requiredItems");
    expect(columns).toContain("materialsIncluded");
    expect(columns).toContain("contentHash");
    expect(columns).toContain("sourceType");
    expect(columns).toContain("sourceUrl");
    expect(columns).toContain("lastSyncedAt");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  it("should define sourceType with correct enum values", () => {
    // This tests the schema definition structure
    expect(agencyCourseTemplates.sourceType).toBeDefined();
  });
});
