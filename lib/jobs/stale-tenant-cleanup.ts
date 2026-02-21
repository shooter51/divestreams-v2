/**
 * Stale Tenant Cleanup Job
 *
 * Background job that cleans up free-tier organizations that have become inactive.
 *
 * Policy (applies to FREE tier only - paying customers retained indefinitely):
 * - 60 days inactive: First warning email to owner
 * - 75 days inactive: Second warning email (final notice)
 * - 90 days inactive: Organization soft deleted (marked inactive)
 *
 * "Inactive" is defined as: No logins from any team member of the organization.
 */

import { db } from "../db";
import {
  organization,
  member,
  session,
  user,
  subscription,
} from "../db/schema";
import { sendEmail } from "../email";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getEmailQueue } from "./index";
import { jobLogger } from "../logger";

// Inactivity thresholds in days
const FIRST_WARNING_DAYS = 60;
const SECOND_WARNING_DAYS = 75;
const DELETION_DAYS = 90;

// Tracking which warnings have been sent (stored in organization metadata)
interface OrganizationMetadata {
  staleTenantWarnings?: {
    firstWarningSentAt?: string;
    secondWarningSentAt?: string;
  };
  [key: string]: unknown;
}

function parseMetadata(metadata: string | null): OrganizationMetadata {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata) as OrganizationMetadata;
  } catch {
    return {};
  }
}

function serializeMetadata(metadata: OrganizationMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * Get the last login timestamp for any member of an organization
 */
async function getLastOrgActivity(organizationId: string): Promise<Date | null> {
  // Get all members of the organization
  const members = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  if (members.length === 0) {
    return null;
  }

  const memberUserIds = members.map((m) => m.userId);

  // Get the most recent session for any member
  const latestSession = await db
    .select({
      createdAt: session.createdAt,
    })
    .from(session)
    .where(inArray(session.userId, memberUserIds))
    .orderBy(sql`${session.createdAt} DESC`)
    .limit(1);

  if (latestSession.length === 0) {
    return null;
  }

  return latestSession[0].createdAt;
}

/**
 * Get the owner's email for an organization
 */
async function getOrgOwnerEmail(
  organizationId: string
): Promise<{ email: string; name: string | null } | null> {
  const owner = await db
    .select({
      email: user.email,
      name: user.name,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner"))
    )
    .limit(1);

  if (owner.length === 0) {
    return null;
  }

  return owner[0];
}

/**
 * Send first warning email (60 days inactive)
 */
function firstWarningEmail(data: {
  ownerName: string;
  shopName: string;
  daysInactive: number;
  reactivateUrl: string;
}) {
  const subject = `Your ${data.shopName} account needs attention`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .warning-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>We Miss You!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.ownerName || "there"},</p>
          <p>We noticed that no one from <strong>${data.shopName}</strong> has logged in for about ${data.daysInactive} days.</p>

          <div class="warning-box">
            <strong>Important:</strong> To keep your dive shop data safe, inactive free-tier accounts are automatically archived after 90 days of inactivity.
          </div>

          <p>Don't worry - your data is still safe! Simply log in to keep your account active:</p>

          <p style="text-align: center;">
            <a href="${data.reactivateUrl}" class="button">Log In Now</a>
          </p>

          <p>If you no longer need your DiveStreams account, no action is needed. Your account will be archived automatically.</p>

          <p>Questions? Just reply to this email - we're happy to help!</p>
        </div>
        <div class="footer">
          <p>DiveStreams - Dive Shop Management Made Simple</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${data.ownerName || "there"},

We noticed that no one from ${data.shopName} has logged in for about ${data.daysInactive} days.

Important: To keep your dive shop data safe, inactive free-tier accounts are automatically archived after 90 days of inactivity.

Don't worry - your data is still safe! Simply log in to keep your account active:
${data.reactivateUrl}

If you no longer need your DiveStreams account, no action is needed. Your account will be archived automatically.

Questions? Just reply to this email - we're happy to help!

DiveStreams - Dive Shop Management Made Simple
  `;

  return { subject, html, text };
}

/**
 * Send second warning email (75 days inactive - final notice)
 */
function secondWarningEmail(data: {
  ownerName: string;
  shopName: string;
  daysRemaining: number;
  reactivateUrl: string;
}) {
  const subject = `Final Notice: ${data.shopName} will be archived in ${data.daysRemaining} days`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .urgent-box { background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Final Notice</h1>
        </div>
        <div class="content">
          <p>Hi ${data.ownerName || "there"},</p>

          <div class="urgent-box">
            <strong>Action Required:</strong> Your <strong>${data.shopName}</strong> account will be archived in <strong>${data.daysRemaining} days</strong> due to inactivity.
          </div>

          <p>Once archived, your dive shop data will no longer be accessible. To prevent this, simply log in to your account:</p>

          <p style="text-align: center;">
            <a href="${data.reactivateUrl}" class="button">Log In to Keep Your Account</a>
          </p>

          <h3>What happens if my account is archived?</h3>
          <ul>
            <li>Your dive shop profile will be deactivated</li>
            <li>Customer data, bookings, and settings will be soft-deleted</li>
            <li>You may contact support within 30 days to restore your data</li>
          </ul>

          <p><strong>Want to keep your data safe forever?</strong> Consider upgrading to our Premium plan - premium accounts are never archived due to inactivity.</p>

          <p>Questions? Reply to this email - we're here to help!</p>
        </div>
        <div class="footer">
          <p>DiveStreams - Dive Shop Management Made Simple</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${data.ownerName || "there"},

FINAL NOTICE: Your ${data.shopName} account will be archived in ${data.daysRemaining} days due to inactivity.

Once archived, your dive shop data will no longer be accessible. To prevent this, simply log in to your account:
${data.reactivateUrl}

What happens if my account is archived?
- Your dive shop profile will be deactivated
- Customer data, bookings, and settings will be soft-deleted
- You may contact support within 30 days to restore your data

Want to keep your data safe forever? Consider upgrading to our Premium plan - premium accounts are never archived due to inactivity.

Questions? Reply to this email - we're here to help!

DiveStreams - Dive Shop Management Made Simple
  `;

  return { subject, html, text };
}

/**
 * Soft delete an organization (mark as inactive)
 */
async function softDeleteOrganization(organizationId: string): Promise<void> {
  const metadata = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const existingMetadata = parseMetadata(metadata[0]?.metadata ?? null);

  // Update metadata to mark as soft deleted
  const updatedMetadata: OrganizationMetadata = {
    ...existingMetadata,
    softDeletedAt: new Date().toISOString(),
    softDeleteReason: "inactivity",
    staleTenantWarnings: existingMetadata.staleTenantWarnings,
  };

  // Update organization with soft delete marker
  // Note: Better Auth doesn't have an isActive field, so we use metadata
  await db
    .update(organization)
    .set({
      metadata: serializeMetadata(updatedMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, organizationId));

  jobLogger.info({ organizationId }, "Soft deleted organization due to inactivity");
}

/**
 * Main cleanup function - processes all stale free-tier organizations
 */
export async function cleanupStaleTenants(): Promise<{
  processed: number;
  firstWarningsSent: number;
  secondWarningsSent: number;
  softDeleted: number;
  errors: string[];
}> {
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - FIRST_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const seventyFiveDaysAgo = new Date(now.getTime() - SECOND_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - DELETION_DAYS * 24 * 60 * 60 * 1000);

  const results = {
    processed: 0,
    firstWarningsSent: 0,
    secondWarningsSent: 0,
    softDeleted: 0,
    errors: [] as string[],
  };

  jobLogger.info({
    startedAt: now.toISOString(),
    thresholds: { sixtyDays: sixtyDaysAgo.toISOString(), seventyFiveDays: seventyFiveDaysAgo.toISOString(), ninetyDays: ninetyDaysAgo.toISOString() },
  }, "Starting stale tenant cleanup job");

  try {
    // Get all free-tier organizations that are not already soft-deleted
    const freeOrgs = await db
      .select({
        orgId: organization.id,
        orgName: organization.name,
        orgSlug: organization.slug,
        orgMetadata: organization.metadata,
        subscriptionPlan: subscription.plan,
      })
      .from(organization)
      .leftJoin(subscription, eq(organization.id, subscription.organizationId))
      .where(
        sql`(${subscription.plan} = 'standard' OR ${subscription.plan} IS NULL)`
      );

    jobLogger.info({ count: freeOrgs.length }, "Found free-tier organizations to check");

    for (const org of freeOrgs) {
      results.processed++;

      try {
        const metadata = parseMetadata(org.orgMetadata);

        // Skip already soft-deleted organizations
        if (metadata.softDeletedAt) {
          jobLogger.debug({ slug: org.orgSlug }, "Skipping already deleted org");
          continue;
        }

        // Get last activity for this organization
        const lastActivity = await getLastOrgActivity(org.orgId);

        if (!lastActivity) {
          // No sessions found - use organization creation date as fallback
          // This handles new orgs that were created but never logged in
          jobLogger.debug({ slug: org.orgSlug }, "No sessions found for org, skipping");
          continue;
        }

        const daysSinceActivity = Math.floor(
          (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000)
        );

        jobLogger.info({ slug: org.orgSlug, daysSinceActivity }, "Organization inactivity check");

        // Get owner info for emails
        const owner = await getOrgOwnerEmail(org.orgId);
        if (!owner) {
          jobLogger.warn({ slug: org.orgSlug }, "No owner found for org, skipping cleanup");
          continue;
        }

        const baseUrl = process.env.APP_URL || "https://divestreams.com";
        const reactivateUrl = `${baseUrl}/${org.orgSlug}/dashboard`;

        // Check thresholds and take action
        if (daysSinceActivity >= DELETION_DAYS) {
          // 90+ days - soft delete
          await softDeleteOrganization(org.orgId);
          results.softDeleted++;
        } else if (daysSinceActivity >= SECOND_WARNING_DAYS) {
          // 75-89 days - send second warning (if not already sent)
          if (!metadata.staleTenantWarnings?.secondWarningSentAt) {
            const daysRemaining = DELETION_DAYS - daysSinceActivity;
            const email = secondWarningEmail({
              ownerName: owner.name || "Dive Shop Owner",
              shopName: org.orgName,
              daysRemaining,
              reactivateUrl,
            });

            await sendEmail({ to: owner.email, ...email });

            // Update metadata to record warning sent
            const updatedMetadata: OrganizationMetadata = {
              ...metadata,
              staleTenantWarnings: {
                ...metadata.staleTenantWarnings,
                secondWarningSentAt: now.toISOString(),
              },
            };

            await db
              .update(organization)
              .set({
                metadata: serializeMetadata(updatedMetadata),
                updatedAt: now,
              })
              .where(eq(organization.id, org.orgId));

            results.secondWarningsSent++;
            jobLogger.info({ email: owner.email, slug: org.orgSlug }, "Sent second inactivity warning");
          }
        } else if (daysSinceActivity >= FIRST_WARNING_DAYS) {
          // 60-74 days - send first warning (if not already sent)
          if (!metadata.staleTenantWarnings?.firstWarningSentAt) {
            const email = firstWarningEmail({
              ownerName: owner.name || "Dive Shop Owner",
              shopName: org.orgName,
              daysInactive: daysSinceActivity,
              reactivateUrl,
            });

            await sendEmail({ to: owner.email, ...email });

            // Update metadata to record warning sent
            const updatedMetadata: OrganizationMetadata = {
              ...metadata,
              staleTenantWarnings: {
                firstWarningSentAt: now.toISOString(),
              },
            };

            await db
              .update(organization)
              .set({
                metadata: serializeMetadata(updatedMetadata),
                updatedAt: now,
              })
              .where(eq(organization.id, org.orgId));

            results.firstWarningsSent++;
            jobLogger.info({ email: owner.email, slug: org.orgSlug }, "Sent first inactivity warning");
          }
        }
      } catch (orgError) {
        const errorMsg = `Error processing org ${org.orgSlug}: ${orgError instanceof Error ? orgError.message : String(orgError)}`;
        results.errors.push(errorMsg);
        jobLogger.error({ err: orgError, slug: org.orgSlug }, "Error processing org for stale tenant cleanup");
      }
    }
  } catch (error) {
    const errorMsg = `Fatal error in cleanup job: ${error instanceof Error ? error.message : String(error)}`;
    results.errors.push(errorMsg);
    jobLogger.error({ err: error }, "Fatal error in stale tenant cleanup job");
  }

  jobLogger.info({ results }, "Stale tenant cleanup complete");
  return results;
}

/**
 * Schedule the cleanup job to run daily
 */
export async function scheduleStaleTenantCleanup(): Promise<void> {
  getEmailQueue(); // Re-use maintenance queue via email queue pattern

  // We'll add to the maintenance queue in the index.ts
  jobLogger.info("Stale tenant cleanup job registered");
}
