import { db } from "./index";
import { agencyCourseTemplates } from "./schema/training";
import { eq, and, sql, asc } from "drizzle-orm";
import type { AgencyFieldsForHash } from "../utils/content-hash.server";
import { generateContentHash } from "../utils/content-hash.server";
import type { TemplateTranslations } from "./schema/training";
import { uploadToS3, isStorageConfigured } from "../storage/s3";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Input for global templates
export interface UpsertGlobalTemplateInput extends AgencyFieldsForHash {
  agencyCode: string; // e.g., "padi", "ssi"
  levelCode: string | null; // e.g., "beginner", "advanced"
  contentHash: string;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

// Agency metadata (hardcoded for now — could move to DB later)
export const AGENCY_METADATA: Record<string, { name: string; description?: string }> = {
  "padi": { name: "Professional Association of Diving Instructors", description: "World's leading scuba diving training organization" },
  "ssi": { name: "Scuba Schools International", description: "International dive training and certification agency" },
  "naui": { name: "National Association of Underwater Instructors", description: "Non-profit diving certification organization" },
  "sdi-tdi": { name: "Scuba Diving International / Technical Diving International", description: "Recreational and technical diving certification" },
  "gue": { name: "Global Underwater Explorers", description: "Technical diving and education organization" },
  "raid": { name: "Rebreather Association of International Divers", description: "Diving safety and education organization" },
  "bsac": { name: "British Sub-Aqua Club", description: "UK's leading diving club and training organization" },
  "cmas": { name: "World Underwater Federation", description: "International federation for underwater activities" },
  "iantd": { name: "International Association of Nitrox and Technical Divers", description: "Technical diving training organization" },
  "andi": { name: "American Nitrox Divers International", description: "Nitrox and technical diving certification" },
};

/**
 * Upsert a global agency course template
 * Uses agencyCode + code for identification
 */
export async function upsertGlobalAgencyCourseTemplate(input: UpsertGlobalTemplateInput) {
  const existing = input.code
    ? await db
        .select()
        .from(agencyCourseTemplates)
        .where(
          and(
            eq(agencyCourseTemplates.agencyCode, input.agencyCode),
            eq(agencyCourseTemplates.code, input.code)
          )
        )
        .limit(1)
    : [];

  const templateData = {
    agencyCode: input.agencyCode,
    levelCode: input.levelCode,
    name: input.name,
    code: input.code,
    description: input.description,
    images: input.images,
    durationDays: input.durationDays,
    classroomHours: input.classroomHours,
    poolHours: input.poolHours,
    openWaterDives: input.openWaterDives,
    prerequisites: input.prerequisites,
    minAge: input.minAge,
    medicalRequirements: input.medicalRequirements,
    requiredItems: input.requiredItems,
    materialsIncluded: input.materialsIncluded,
    contentHash: input.contentHash,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    const [updated] = await db
      .update(agencyCourseTemplates)
      .set(templateData)
      .where(eq(agencyCourseTemplates.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(agencyCourseTemplates)
      .values(templateData)
      .returning();
    return inserted;
  }
}

/**
 * Get all global templates for a specific agency (by code)
 */
export async function getGlobalAgencyCourseTemplates(agencyCode: string) {
  return db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.agencyCode, agencyCode))
    .orderBy(agencyCourseTemplates.name);
}

/**
 * Get all global templates
 */
export async function getAllGlobalAgencyCourseTemplates() {
  return db
    .select()
    .from(agencyCourseTemplates)
    .orderBy(agencyCourseTemplates.agencyCode, agencyCourseTemplates.name);
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(templateId: string) {
  const [template] = await db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.id, templateId));
  return template;
}

/**
 * Update a template (admin use)
 */
export async function updateTemplate(
  templateId: string,
  data: Partial<{
    name: string;
    description: string | null;
    images: string[] | null;
    translations: TemplateTranslations;
    durationDays: number;
    classroomHours: number | null;
    poolHours: number | null;
    openWaterDives: number | null;
    prerequisites: string | null;
    minAge: number | null;
    medicalRequirements: string | null;
    requiredItems: string[] | null;
    materialsIncluded: boolean | null;
  }>
) {
  const [updated] = await db
    .update(agencyCourseTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agencyCourseTemplates.id, templateId))
    .returning();
  return updated;
}

/**
 * Get all available agencies from global templates
 * Returns unique agency codes with metadata
 */
export async function getAvailableAgencies() {
  const agencies = await db
    .selectDistinct({ agencyCode: agencyCourseTemplates.agencyCode })
    .from(agencyCourseTemplates)
    .orderBy(agencyCourseTemplates.agencyCode);

  return agencies.map(({ agencyCode }) => ({
    code: agencyCode,
    name: agencyCode ? (AGENCY_METADATA[agencyCode]?.name || agencyCode.toUpperCase()) : "UNKNOWN",
    description: agencyCode ? AGENCY_METADATA[agencyCode]?.description : undefined,
  }));
}

/**
 * Get template count per agency
 */
export async function getAgencyTemplateCounts() {
  const result = await db
    .select({
      agencyCode: agencyCourseTemplates.agencyCode,
      count: sql<number>`count(*)::int`,
    })
    .from(agencyCourseTemplates)
    .groupBy(agencyCourseTemplates.agencyCode)
    .orderBy(asc(agencyCourseTemplates.agencyCode));

  return result;
}

// ── Catalog Refresh ─────────────────────────────────────────────────────────

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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

async function migrateImageToS3(
  imageUrl: string,
  agencyCode: string,
  courseCode: string
): Promise<string> {
  const cdnUrl = process.env.CDN_URL;
  // Already on our CDN — skip
  if (cdnUrl && imageUrl.startsWith(cdnUrl)) {
    return imageUrl;
  }
  // Already an S3 URL for our bucket — skip
  if (imageUrl.includes("s3.") && imageUrl.includes("amazonaws.com")) {
    return imageUrl;
  }

  const response = await fetch(imageUrl, {
    headers: { "User-Agent": "DiveStreams/1.0 CatalogSync" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${imageUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const urlPath = new URL(imageUrl).pathname;
  const filename = sanitizeFilename(urlPath.split("/").pop() || "image.jpg");
  const safeAgency = agencyCode.replace(/[^a-zA-Z0-9-]/g, "");
  const safeCode = courseCode.replace(/[^a-zA-Z0-9-]/g, "");
  const key = `catalog/${safeAgency}/${safeCode}/${Date.now()}-${filename}`;

  const result = await uploadToS3(key, buffer, contentType);
  if (!result) {
    throw new Error("S3 upload returned null");
  }
  return result.cdnUrl;
}

export interface RefreshCatalogResult {
  totalTemplates: number;
  imagesUploaded: number;
  imagesFailed: number;
  agencyResults: Array<{ agency: string; count: number; status: string }>;
  errors: string[];
}

export async function refreshCatalogFromJson(): Promise<RefreshCatalogResult> {
  const catalogsDir = join(__dirname, "../data/catalogs");
  const storageReady = isStorageConfigured();
  let totalTemplates = 0;
  let imagesUploaded = 0;
  let imagesFailed = 0;
  const errors: string[] = [];
  const agencyResults: RefreshCatalogResult["agencyResults"] = [];

  for (const catalogInfo of AGENCY_CATALOGS) {
    const catalogPath = join(catalogsDir, catalogInfo.filename);

    if (!existsSync(catalogPath)) {
      agencyResults.push({ agency: catalogInfo.code, count: 0, status: "missing" });
      continue;
    }

    try {
      const catalog: Catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
      let imported = 0;

      for (const course of catalog.courses) {
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
        const template = await upsertGlobalAgencyCourseTemplate({
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
          sourceType: "static_json",
          sourceUrl: null,
        });

        // Migrate images to S3
        if (storageReady && template && course.images?.length > 0) {
          const migratedImages: string[] = [];
          let changed = false;

          for (const imgUrl of course.images) {
            try {
              const newUrl = await migrateImageToS3(imgUrl, catalogInfo.code, course.code);
              migratedImages.push(newUrl);
              if (newUrl !== imgUrl) {
                imagesUploaded++;
                changed = true;
              }
            } catch (err) {
              migratedImages.push(imgUrl); // keep original on failure
              imagesFailed++;
              errors.push(`${catalogInfo.code}/${course.code}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          if (changed) {
            await updateTemplate(template.id, { images: migratedImages });
          }
        }

        imported++;
      }

      totalTemplates += imported;
      agencyResults.push({ agency: catalogInfo.code, count: imported, status: "success" });
    } catch (err) {
      errors.push(`${catalogInfo.code}: ${err instanceof Error ? err.message : String(err)}`);
      agencyResults.push({ agency: catalogInfo.code, count: 0, status: "error" });
    }
  }

  return { totalTemplates, imagesUploaded, imagesFailed, agencyResults, errors };
}
