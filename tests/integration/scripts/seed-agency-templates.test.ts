import { describe, it, expect, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../../../lib/db";
import { agencyCourseTemplates } from "../../../lib/db/schema/training";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

describe("seed-agency-templates script", () => {
  afterEach(async () => {
    await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.agencyCode, "padi"));
  });

  it("should load PADI courses from catalog", async () => {
    // Run the seed script
    await execAsync("npx tsx scripts/seed-agency-templates.ts");

    // Verify templates were created (seed script uses agencyCode, not agencyId FK)
    const templates = await db
      .select()
      .from(agencyCourseTemplates)
      .where(eq(agencyCourseTemplates.agencyCode, "padi"));

    expect(templates.length).toBeGreaterThan(0);

    // Verify first course (OWD)
    const owd = templates.find(t => t.code === "OWD");
    expect(owd).toBeDefined();
    expect(owd!.name).toBe("Open Water Diver");
    expect(owd!.sourceType).toBe("static_json");
  });
});
