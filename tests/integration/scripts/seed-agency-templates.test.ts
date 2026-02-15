import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../../../lib/db";
import { agencyCourseTemplates, certificationAgencies } from "../../../lib/db/schema/training";
import { organization } from "../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

const hasDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('divestreams:divestreams');

describe.skipIf(!hasDb)("seed-agency-templates script", () => {
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

    // Create PADI agency (or get existing one)
    const existingAgency = await db
      .select()
      .from(certificationAgencies)
      .where(eq(certificationAgencies.organizationId, testOrgId))
      .limit(1);

    if (existingAgency.length > 0 && existingAgency[0].code === "padi") {
      testAgencyId = existingAgency[0].id;
    } else {
      const [agency] = await db
        .insert(certificationAgencies)
        .values({
          organizationId: testOrgId,
          name: "PADI",
          code: "padi",
        })
        .onConflictDoNothing()
        .returning();

      if (agency) {
        testAgencyId = agency.id;
      } else {
        // Agency already exists, fetch it
        const [existing] = await db
          .select()
          .from(certificationAgencies)
          .where(eq(certificationAgencies.code, "padi"))
          .limit(1);
        testAgencyId = existing.id;
      }
    }
  });

  afterEach(async () => {
    // Cleanup seeded templates (seed script uses agencyCode, not agencyId FK)
    await db.delete(agencyCourseTemplates).where(eq(agencyCourseTemplates.agencyCode, "padi"));
    if (testAgencyId) {
      await db.delete(certificationAgencies).where(eq(certificationAgencies.id, testAgencyId));
    }
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
