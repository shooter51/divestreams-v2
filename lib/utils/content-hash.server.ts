import crypto from "crypto";

export interface AgencyFieldsForHash {
  name: string;
  code: string | null;
  description: string | null;
  images: string[] | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  prerequisites: string | null;
  minAge: number | null;
  medicalRequirements: string | null;
  requiredItems: string[] | null;
  materialsIncluded: boolean | null;
}

export function generateContentHash(template: AgencyFieldsForHash): string {
  const agencyFields = {
    name: template.name,
    code: template.code,
    description: template.description,
    images: template.images,
    durationDays: template.durationDays,
    classroomHours: template.classroomHours,
    poolHours: template.poolHours,
    openWaterDives: template.openWaterDives,
    prerequisites: template.prerequisites,
    minAge: template.minAge,
    medicalRequirements: template.medicalRequirements,
    requiredItems: template.requiredItems,
    materialsIncluded: template.materialsIncluded,
  };

  // Sort keys for consistent hashing
  const sorted = Object.keys(agencyFields)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: agencyFields[key as keyof typeof agencyFields] }), {});

  const jsonString = JSON.stringify(sorted);
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}
