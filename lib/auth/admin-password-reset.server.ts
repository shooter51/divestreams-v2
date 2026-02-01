/**
 * Admin Password Reset Module
 *
 * Server-side business logic for admin-initiated password resets.
 * Supports three methods:
 * - auto_generated: Generate random password, force change on next login
 * - manual_entry: Admin sets specific password, optional force change
 * - email_reset: Send password reset link via email
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { user, account, organization, member } from "../db/schema/auth";
import { passwordChangeAudit } from "../db/schema/password-audit";
import { hashPassword, generateRandomPassword } from "./password.server";
import { sendEmail } from "../email/email.server";
import { getPasswordChangedByAdminEmail } from "../email/templates/password-changed-by-admin";

export interface ResetPasswordParams {
  targetUserId: string;
  adminUserId: string;
  organizationId: string;
  method: "auto_generated" | "manual_entry" | "email_reset";
  newPassword?: string;
  forcePasswordChange?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  temporaryPassword?: string;
  auditId: string;
  error?: string;
}

/**
 * Reset a user's password (admin action)
 *
 * @param params - Password reset parameters
 * @returns Result with temporary password (if auto-generated) and audit ID
 * @throws Error if validation fails or users/org not found
 */
export async function resetUserPassword(
  params: ResetPasswordParams
): Promise<ResetPasswordResult> {
  const {
    targetUserId,
    adminUserId,
    organizationId,
    method,
    newPassword,
    forcePasswordChange,
    ipAddress,
    userAgent,
  } = params;

  // ============================================================================
  // VALIDATION
  // ============================================================================

  if (method === "manual_entry" && !newPassword) {
    throw new Error("newPassword is required for manual_entry method");
  }

  // ============================================================================
  // FETCH REQUIRED DATA
  // ============================================================================

  // Fetch target user
  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Fetch admin user
  const [adminUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, adminUserId))
    .limit(1);

  if (!adminUser) {
    throw new Error("Admin user not found");
  }

  // Fetch organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  // ============================================================================
  // AUTHORIZATION: VERIFY ORGANIZATIONAL ISOLATION
  // ============================================================================

  // Verify admin user belongs to the specified organization
  const [adminMembership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, adminUserId),
        eq(member.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!adminMembership) {
    throw new Error("Admin user does not belong to the specified organization");
  }

  // Verify target user belongs to the specified organization
  const [targetMembership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, targetUserId),
        eq(member.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!targetMembership) {
    throw new Error("Target user does not belong to the specified organization");
  }

  // Fetch user's account (needed for password update)
  const [userAccount] = await db
    .select()
    .from(account)
    .where(eq(account.userId, targetUserId))
    .limit(1);

  if (!userAccount) {
    throw new Error("User account not found");
  }

  // ============================================================================
  // PROCESS PASSWORD RESET BY METHOD
  // ============================================================================

  let temporaryPassword: string | undefined;
  let passwordHash: string | undefined;
  let shouldForcePasswordChange = false;

  if (method === "auto_generated") {
    // Generate random password
    temporaryPassword = generateRandomPassword(16);
    passwordHash = await hashPassword(temporaryPassword);
    shouldForcePasswordChange = true;
  } else if (method === "manual_entry") {
    // Use admin-provided password
    passwordHash = await hashPassword(newPassword!);
    shouldForcePasswordChange = forcePasswordChange ?? false;
  }
  // email_reset: No password update, just send email

  // ============================================================================
  // UPDATE PASSWORD AND CREATE AUDIT LOG (TRANSACTIONAL)
  // ============================================================================

  // Use transaction to ensure atomicity of password update and audit log
  const [auditRecord] = await db.transaction(async (tx) => {
    // Update password if not email_reset method
    if (method !== "email_reset" && passwordHash) {
      await tx
        .update(account)
        .set({
          password: passwordHash,
          forcePasswordChange: shouldForcePasswordChange,
        })
        .where(eq(account.userId, targetUserId));
    }

    // Insert audit record
    return tx
      .insert(passwordChangeAudit)
      .values({
        changedByUserId: adminUserId,
        targetUserId: targetUserId,
        organizationId: organizationId,
        method: method,
        ipAddress: ipAddress,
        userAgent: userAgent,
      })
      .returning();
  });

  // ============================================================================
  // SEND EMAIL NOTIFICATION
  // ============================================================================

  const emailData = {
    userName: targetUser.name || targetUser.email,
    userEmail: targetUser.email,
    adminName: adminUser.name || adminUser.email,
    method: method,
    organizationName: org.name,
    changedAt: new Date().toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }),
    loginUrl: `${process.env.APP_URL || "https://divestreams.com"}/login`,
  };

  const emailTemplate = getPasswordChangedByAdminEmail(emailData);

  await sendEmail({
    to: targetUser.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  });

  // ============================================================================
  // RETURN RESULT
  // ============================================================================

  return {
    success: true,
    temporaryPassword: method === "auto_generated" ? temporaryPassword : undefined,
    auditId: auditRecord.id,
  };
}
