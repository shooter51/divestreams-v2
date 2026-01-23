/**
 * Agency Course Templates
 *
 * Static data for certification agency course templates.
 * These templates can be imported into tenant course catalogs.
 */

import padiTemplates from './padi.json';
import ssiTemplates from './ssi.json';
import nauiTemplates from './naui.json';

export interface AgencyCourseTemplate {
  code: string;
  name: string;
  description: string;
  durationDays: number;
  classroomHours: number;
  poolHours: number;
  openWaterDives: number;
  minAge: number;
  prerequisites: string;
  medicalRequirements: string;
  materialsIncluded: boolean;
  requiredItems: string[];
}

export interface AgencyTemplateData {
  agencyCode: string;
  agencyName: string;
  courses: AgencyCourseTemplate[];
}

const templates: Record<string, AgencyTemplateData> = {
  padi: padiTemplates as AgencyTemplateData,
  ssi: ssiTemplates as AgencyTemplateData,
  naui: nauiTemplates as AgencyTemplateData,
};

/**
 * Get templates for a specific agency by code
 */
export function getAgencyTemplates(agencyCode: string): AgencyTemplateData | null {
  const normalizedCode = agencyCode.toLowerCase();
  return templates[normalizedCode] || null;
}

/**
 * Get all available agency codes
 */
export function getAvailableAgencyCodes(): string[] {
  return Object.keys(templates);
}

/**
 * Get all templates
 */
export function getAllAgencyTemplates(): AgencyTemplateData[] {
  return Object.values(templates);
}
