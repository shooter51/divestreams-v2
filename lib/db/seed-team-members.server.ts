/**
 * Seed Team Members
 *
 * Script to seed initial team member data for an organization's About page.
 */

import { db } from "./index";
import { teamMembers } from "./schema/team";
import { organization } from "./schema/auth";
import { eq } from "drizzle-orm";

/**
 * Sample team member data
 */
const sampleTeamMembers = [
  {
    name: "John Smith",
    role: "Owner & Lead Instructor",
    bio: "PADI Course Director with over 20 years of diving experience across the globe. Passionate about sharing the underwater world with new divers.",
    certifications: ["PADI Course Director", "TDI Advanced Trimix", "EFR Instructor Trainer"],
    specialties: ["Technical Diving", "Instructor Training", "Underwater Photography"],
    yearsExperience: 22,
    imageUrl: null,
    email: null,
    phone: null,
    isPublic: true,
    status: "active" as const,
    displayOrder: 0,
  },
  {
    name: "Maria Garcia",
    role: "Operations Manager",
    bio: "Certified Divemaster and expedition coordinator with expertise in trip planning and customer service. Making sure every dive adventure runs smoothly.",
    certifications: ["PADI Divemaster", "EFR Instructor"],
    specialties: ["Trip Planning", "Customer Relations", "Dive Site Selection"],
    yearsExperience: 8,
    imageUrl: null,
    email: null,
    phone: null,
    isPublic: true,
    status: "active" as const,
    displayOrder: 1,
  },
  {
    name: "David Chen",
    role: "Technical Diving Instructor",
    bio: "Specializes in technical diving, cave diving, and advanced underwater photography. Leading exploratory dives and teaching advanced diving techniques.",
    certifications: ["TDI Full Cave", "PADI MSDT", "NAUI Technical Instructor"],
    specialties: ["Cave Diving", "Technical Diving", "Underwater Photography", "Wreck Diving"],
    yearsExperience: 15,
    imageUrl: null,
    email: null,
    phone: null,
    isPublic: true,
    status: "active" as const,
    displayOrder: 2,
  },
];

/**
 * Seed team members for a specific organization
 */
export async function seedTeamMembers(organizationId: string) {
  console.log(`Seeding team members for organization ${organizationId}...`);

  // Check if team members already exist for this organization
  const existing = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.organizationId, organizationId))
    .limit(1);

  if (existing.length > 0) {
    console.log("Team members already exist for this organization, skipping...");
    return;
  }

  // Insert sample team members
  const inserted = await db
    .insert(teamMembers)
    .values(
      sampleTeamMembers.map((member) => ({
        ...member,
        organizationId,
      }))
    )
    .returning();

  console.log(`Inserted ${inserted.length} team members`);
  return inserted;
}

/**
 * Seed team members for all organizations
 */
export async function seedTeamMembersForAllOrgs() {
  console.log("Seeding team members for all organizations...");

  const orgs = await db.select({ id: organization.id }).from(organization);

  for (const org of orgs) {
    await seedTeamMembers(org.id);
  }

  console.log("Finished seeding team members for all organizations");
}

/**
 * Clear all team members for a specific organization
 */
export async function clearTeamMembers(organizationId: string) {
  console.log(`Clearing team members for organization ${organizationId}...`);

  const deleted = await db
    .delete(teamMembers)
    .where(eq(teamMembers.organizationId, organizationId))
    .returning();

  console.log(`Deleted ${deleted.length} team members`);
  return deleted;
}
