import { db } from "../lib/db";
import { certificationAgencies, certificationLevels, agencyCourseTemplates } from "../lib/db/schema/training";
import { eq } from "drizzle-orm";
import { generateContentHash } from "../lib/utils/content-hash.server";
import { upsertAgencyCourseTemplate } from "../lib/db/training-templates.server";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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
  version: string;
  lastUpdated: string;
  courses: CatalogCourse[];
}

async function seedPadiTemplates() {
  console.log("Loading PADI catalog...");

  // Read catalog file
  const catalogPath = join(__dirname, "../lib/data/catalogs/padi-courses.json");
  const catalogData = readFileSync(catalogPath, "utf-8");
  const catalog: Catalog = JSON.parse(catalogData);

  console.log(`Found ${catalog.courses.length} courses in catalog`);

  // Get PADI agency (must exist)
  const [padiAgency] = await db
    .select()
    .from(certificationAgencies)
    .where(eq(certificationAgencies.code, "padi"))
    .limit(1);

  if (!padiAgency) {
    throw new Error("PADI agency not found. Please create it first.");
  }

  console.log(`PADI agency found: ${padiAgency.name} (${padiAgency.id})`);

  // Get all certification levels for mapping
  const levels = await db.select().from(certificationLevels);
  const levelMap = new Map(levels.map(l => [l.code, l.id]));

  console.log(`Loaded ${levels.length} certification levels`);

  // Import each course
  let imported = 0;
  for (const course of catalog.courses) {
    console.log(`Importing: ${course.name} (${course.code})`);

    // Map levelCode to levelId
    const levelId = levelMap.get(course.levelCode) || null;

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

    // Upsert template
    await upsertAgencyCourseTemplate({
      agencyId: padiAgency.id,
      levelId,
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
      contentHash,
      sourceType: "static_json",
      sourceUrl: null,
    });

    imported++;
  }

  console.log(`✅ Successfully imported ${imported} PADI course templates`);
}

// Run if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedPadiTemplates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedPadiTemplates };
