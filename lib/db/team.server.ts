/**
 * Team Server Functions
 *
 * Server-side functions for retrieving and managing team members.
 */

import { eq, and, asc } from "drizzle-orm";
import { db } from "./index";
import {
  teamMembers,
  type TeamMember,
  type NewTeamMember,
} from "./schema/team";

// ============================================================================
// Public Team Functions (for public site)
// ============================================================================

/**
 * Get all public team members for an organization
 * Returns only team members where isPublic = true and status = 'active'
 */
export async function getPublicTeamMembers(
  organizationId: string
): Promise<TeamMember[]> {
  return await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.isPublic, true),
        eq(teamMembers.status, "active")
      )
    )
    .orderBy(asc(teamMembers.displayOrder), asc(teamMembers.name));
}

/**
 * Get a single public team member by ID
 */
export async function getPublicTeamMember(
  organizationId: string,
  memberId: string
): Promise<TeamMember | null> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.id, memberId),
        eq(teamMembers.isPublic, true),
        eq(teamMembers.status, "active")
      )
    )
    .limit(1);

  return member || null;
}

// ============================================================================
// Admin Team Functions (for admin panel)
// ============================================================================

/**
 * Get all team members for admin (includes inactive)
 */
export async function getAllTeamMembers(
  organizationId: string
): Promise<TeamMember[]> {
  return await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.organizationId, organizationId))
    .orderBy(asc(teamMembers.displayOrder), asc(teamMembers.name));
}

/**
 * Get a single team member by ID for admin
 */
export async function getTeamMemberById(
  organizationId: string,
  memberId: string
): Promise<TeamMember | null> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.id, memberId)
      )
    )
    .limit(1);

  return member || null;
}

/**
 * Create a new team member
 */
export async function createTeamMember(
  organizationId: string,
  data: Omit<NewTeamMember, "organizationId">
): Promise<TeamMember> {
  const [member] = await db
    .insert(teamMembers)
    .values({
      ...data,
      organizationId,
    })
    .returning();

  return member;
}

/**
 * Update a team member
 */
export async function updateTeamMember(
  organizationId: string,
  memberId: string,
  data: Partial<Omit<NewTeamMember, "organizationId">>
): Promise<TeamMember | null> {
  const [member] = await db
    .update(teamMembers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.id, memberId)
      )
    )
    .returning();

  return member || null;
}

/**
 * Delete a team member
 */
export async function deleteTeamMember(
  organizationId: string,
  memberId: string
): Promise<boolean> {
  const result = await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.id, memberId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Reorder team members
 * Updates display order for multiple team members at once
 */
export async function reorderTeamMembers(
  organizationId: string,
  memberIds: string[]
): Promise<void> {
  // Update each member's display order based on array position
  await Promise.all(
    memberIds.map((memberId, index) =>
      db
        .update(teamMembers)
        .set({
          displayOrder: index,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(teamMembers.organizationId, organizationId),
            eq(teamMembers.id, memberId)
          )
        )
    )
  );
}
