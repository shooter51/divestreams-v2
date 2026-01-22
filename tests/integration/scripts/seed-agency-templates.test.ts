import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../../../lib/db";
import { agencyCourseTemplates, certificationAgencies } from "../../../lib/db/schema/training";
import { organization } from "../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

describe("seed-agency-templates script", () => {
  let testOrgId: string;
  let testAgencyId: string;

  beforeEach(async () => {
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

    // Create PADI agency
    const [agency] = await db
      .insert(certificationAgencies)
      .values({
        organizationId: testOrgId,
        name: "PADI",
        code: "padi",
      })
      .returning();
    testAgencyId = agency.id;
  });

  afterEach(async () => {
    // Cleanup
    if (testAgencyId) {
      await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.agencyId, testAgencyId));
      await db.delete(certificationAgencies).where(eq(certificationAgencies.id, testAgencyId));
    }
  });

  it("should load PADI courses from catalog", async () => {
    // Run the seed script
    await execAsync("npx tsx scripts/seed-agency-templates.ts");

    // Verify templates were created
    const templates = await db
      .select()
      .from(agencyCourseTemplates)
      .where(eq(agencyCourseTemplates.agencyId, testAgencyId));

    expect(templates.length).toBeGreaterThan(0);

    // Verify first course (OWD)
    const owd = templates.find(t => t.code === "OWD");
    expect(owd).toBeDefined();
    expect(owd!.name).toBe("Open Water Diver");
    expect(owd!.sourceType).toBe("static_json");
  });
});
