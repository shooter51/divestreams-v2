import { scriptDb, closeConnection } from "../lib/db/script-db";
import { agencyCourseTemplates } from "../lib/db/schema/training";
import { generateContentHash } from "../lib/utils/content-hash.server";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { eq, and } from "drizzle-orm";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CatalogCourse {
  name: string;
  code: string;
  levelCode: string;
  description: string;
  images: string[];
  durationDays: number;
  classroomHours: number;
  poolHours: number;
  openWaterDives: number;
  prerequisites: string | null;
  minAge: number;
  medicalRequirements: string;
  requiredItems: string[];
  materialsIncluded: boolean;
}

interface Catalog {
  agency: string;
  agencyName: string;
  version: string;
  lastUpdated: string;
  courses: CatalogCourse[];
}

// All supported agency catalogs
const AGENCY_CATALOGS = [
  { code: "padi", filename: "padi-courses.json" },
  { code: "ssi", filename: "ssi-courses.json" },
  { code: "naui", filename: "naui-courses.json" },
  { code: "sdi-tdi", filename: "sdi-tdi-courses.json" },
  { code: "gue", filename: "gue-courses.json" },
  { code: "raid", filename: "raid-courses.json" },
  { code: "bsac", filename: "bsac-courses.json" },
  { code: "cmas", filename: "cmas-courses.json" },
  { code: "iantd", filename: "iantd-courses.json" },
  { code: "andi", filename: "andi-courses.json" },
];

async function seedAgencyTemplates(agencyCode?: string) {
  console.log("\n🌊 Agency Course Template Seeder");
  console.log("================================\n");

  // Filter catalogs if specific agency requested
  const catalogsToProcess = agencyCode
    ? AGENCY_CATALOGS.filter(c => c.code === agencyCode)
    : AGENCY_CATALOGS;

  if (catalogsToProcess.length === 0) {
    throw new Error(`Unknown agency code: ${agencyCode}`);
  }

  let totalImported = 0;
  const results: { agency: string; count: number; status: string }[] = [];

  for (const catalogInfo of catalogsToProcess) {
    const catalogPath = join(__dirname, "../lib/data/catalogs", catalogInfo.filename);

    // Check if catalog file exists
    if (!existsSync(catalogPath)) {
      console.log(`⚠️  ${catalogInfo.code.toUpperCase()}: Catalog file not found (${catalogInfo.filename})`);
      results.push({ agency: catalogInfo.code, count: 0, status: "missing" });
      continue;
    }

    try {
      // Read catalog file
      const catalogData = readFileSync(catalogPath, "utf-8");
      const catalog: Catalog = JSON.parse(catalogData);

      console.log(`📚 ${catalog.agencyName || catalogInfo.code.toUpperCase()}`);
      console.log(`   File: ${catalogInfo.filename}`);
      console.log(`   Courses: ${catalog.courses.length}`);

      // Import each course as a global template
      let imported = 0;
      for (const course of catalog.courses) {
        // Generate content hash
        const contentHash = generateContentHash({
          name: course.name,
          code: course.code,
          description: course.description,
          images: course.images,
          durationDays: course.durationDays,
          classroomHours: course.classroomHours,
          poolHours: course.poolHours,
          openWaterDives: course.openWaterDives,
          prerequisites: course.prerequisites,
          minAge: course.minAge,
          medicalRequirements: course.medicalRequirements,
          requiredItems: course.requiredItems,
          materialsIncluded: course.materialsIncluded,
        });

        // Check if template exists
        const existing = await scriptDb
          .select({ id: agencyCourseTemplates.id })
          .from(agencyCourseTemplates)
          .where(
            and(
              eq(agencyCourseTemplates.agencyCode, catalogInfo.code),
              eq(agencyCourseTemplates.code, course.code)
            )
          )
          .limit(1);

        const templateData = {
          agencyCode: catalogInfo.code,
          levelCode: course.levelCode,
          name: course.name,
          code: course.code,
          description: course.description,
          images: course.images,
          durationDays: course.durationDays,
          classroomHours: course.classroomHours || 0,
          poolHours: course.poolHours || 0,
          openWaterDives: course.openWaterDives || 0,
          prerequisites: course.prerequisites,
          minAge: course.minAge,
          medicalRequirements: course.medicalRequirements,
          requiredItems: course.requiredItems,
          materialsIncluded: course.materialsIncluded ?? true,
          contentHash,
          sourceType: "static_json" as const,
          sourceUrl: null,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        };

        if (existing.length > 0) {
          // Update existing
          await scriptDb
            .update(agencyCourseTemplates)
            .set(templateData)
            .where(eq(agencyCourseTemplates.id, existing[0].id));
        } else {
          // Insert new
          await scriptDb.insert(agencyCourseTemplates).values(templateData);
        }

        imported++;
      }

      console.log(`   ✅ Imported ${imported} course templates\n`);
      results.push({ agency: catalogInfo.code, count: imported, status: "success" });
      totalImported += imported;
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}\n`);
      results.push({ agency: catalogInfo.code, count: 0, status: "error" });
    }
  }

  // Print summary
  console.log("\n================================");
  console.log("📊 Import Summary");
  console.log("================================\n");

  for (const result of results) {
    const icon = result.status === "success" ? "✅" : result.status === "missing" ? "⏭️" : "❌";
    console.log(`${icon} ${result.agency.toUpperCase().padEnd(10)} ${result.count} courses`);
  }

  console.log(`\n🎉 Total: ${totalImported} course templates imported`);

  return { totalImported, results };
}

// Legacy function for backwards compatibility
async function seedPadiTemplates() {
  return seedAgencyTemplates("padi");
}

// Run if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  // Check for --agency flag
  const args = process.argv.slice(2);
  const agencyArg = args.find(arg => arg.startsWith("--agency="));
  const agencyCode = agencyArg?.split("=")[1];

  seedAgencyTemplates(agencyCode)
    .then(async () => {
      await closeConnection();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Seed failed:", error);
      await closeConnection();
      process.exit(1);
    });
}

export { seedAgencyTemplates, seedPadiTemplates };
