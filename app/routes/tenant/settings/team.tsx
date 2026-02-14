import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import type { ResetPasswordParams } from "../../../../lib/auth/admin-password-reset.server";
import { useLoaderData, useFetcher, Link, useRouteLoaderData } from "react-router";
import { useState, useEffect } from "react";
import { PremiumGate } from "../../../components/ui/UpgradePrompt";
import { ResetPasswordModal } from "../../../components/settings/ResetPasswordModal";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Team - DiveStreams" }];

const roles = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to everything",
    permissions: ["all"],
  },
  {
    id: "admin",
    name: "Admin",
    description: "Manage bookings, customers, and staff",
    permissions: ["bookings", "customers", "trips", "tours", "equipment", "boats", "reports"],
  },
  {
    id: "member",
    name: "Staff",
    description: "View and manage daily operations",
    permissions: ["bookings", "customers", "trips"],
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Import server-only modules inline to prevent client bundle leakage
  const { requireOrgContext } = await import("../../../../lib/auth/org-context.server");
  const { db } = await import("../../../../lib/db");
  const { member, user, invitation } = await import("../../../../lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { requireLimit } = await import("../../../../lib/require-feature.server");
  const { DEFAULT_PLAN_LIMITS } = await import("../../../../lib/plan-features");

  const ctx = await requireOrgContext(request);

  // Check users limit - this will redirect if limit exceeded
  const limits = ctx.subscription?.planDetails?.limits ?? DEFAULT_PLAN_LIMITS.free;
  const limitCheck = await requireLimit(ctx.org.id, "users", limits);

  // Get team members from Better Auth member table
  const membersRaw = await db
    .select({
      id: member.id,
      role: member.role,
      userId: member.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.org.id));

  const team = membersRaw.map(m => ({
    id: m.id,
    userId: m.userId,  // Include user ID for password reset
    name: m.userName || "Unknown",
    email: m.userEmail,
    role: m.role,
    status: "active",
    lastActive: "Recently",
  }));

  // Get pending invitations
  const invitationsRaw = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, ctx.org.id),
        eq(invitation.status, "pending")
      )
    );

  const pendingInvites = invitationsRaw.map(inv => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    invitedAt: inv.createdAt?.toISOString().split("T")[0] || "",
    expiresAt: inv.expiresAt?.toISOString().split("T")[0] || "",
  }));

  // Plan limit from requireLimit check
  const planLimit = limitCheck.limit;

  return {
    team,
    pendingInvites,
    roles,
    planLimit,
    limitRemaining: limitCheck.remaining,
    isPremium: ctx.isPremium,
    canInviteTeamMembers: ctx.isPremium, // Only premium users can invite team members
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Import server-only modules inline to prevent client bundle leakage
  const { requireOrgContext } = await import("../../../../lib/auth/org-context.server");
  const { db } = await import("../../../../lib/db");
  const { member, user, invitation } = await import("../../../../lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { sendEmail } = await import("../../../../lib/email");
  const { getAppUrl } = await import("../../../../lib/utils/url");
  const { resetUserPassword } = await import("../../../../lib/auth/admin-password-reset.server");

  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    // Only owners and admins can invite team members
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return { error: "Only owners and admins can manage team members" };
    }

    // Only premium users can invite team members
    if (!ctx.isPremium) {
      return { error: "Team invitations require a premium subscription" };
    }

    const email = formData.get("email") as string;
    const role = formData.get("role") as string;

    // Validate role against allowed values
    const allowedRoles = ["admin", "member", "staff"];
    if (!allowedRoles.includes(role)) {
      return { error: "Invalid role" };
    }

    // Check if email is already a team member of THIS organization
    const [existingMember] = await db
      .select({
        email: user.email,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.organizationId, ctx.org.id),
          eq(user.email, email)
        )
      )
      .limit(1);

    if (existingMember) {
      return { error: "This email is already a team member" };
    }

    // Check if user exists globally (in any organization)
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser) {
      // User exists - add them directly as a member (no invitation needed)
      const memberId = crypto.randomUUID();
      await db.insert(member).values({
        id: memberId,
        userId: existingUser.id,
        organizationId: ctx.org.id,
        role,
      });

      // Send notification email that they've been added
      try {
        await sendEmail({
          to: email,
          subject: `You've been added to ${ctx.org.name} on DiveStreams`,
          html: `
            <p>Hi${existingUser.name ? ` ${existingUser.name}` : ''},</p>
            <p>${ctx.user.name || 'A team member'} has added you to <strong>${ctx.org.name}</strong> on DiveStreams as a ${role}.</p>
            <p><a href="${getAppUrl()}">Click here to access your account</a></p>
            <p>You can now switch between organizations from your dashboard.</p>
          `,
        });
      } catch (error) {
        console.error("Failed to send notification email:", error);
        // Continue even if email fails - member was added
      }

      return { success: true, message: `${email} has been added to the team (existing user)` };
    }

    // Check if email already has a pending invitation
    const [existingInvite] = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, ctx.org.id),
          eq(invitation.email, email),
          eq(invitation.status, "pending")
        )
      )
      .limit(1);

    if (existingInvite) {
      return { error: "This email already has a pending invitation" };
    }

    // User doesn't exist - create invitation for new user
    const inviteId = crypto.randomUUID();
    await db.insert(invitation).values({
      id: inviteId,
      organizationId: ctx.org.id,
      email,
      role,
      status: "pending",
      inviterId: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send invitation email
    const inviteUrl = `${getAppUrl()}/auth/accept-invite?token=${inviteId}`;
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to join ${ctx.org.name} on DiveStreams`,
        html: `
          <p>Hi,</p>
          <p>${ctx.user.name || 'A team member'} has invited you to join <strong>${ctx.org.name}</strong> on DiveStreams as a ${role}.</p>
          <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
          <p>This invitation expires in 7 days.</p>
          <p>If you didn't expect this invitation, you can ignore this email.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      // Continue even if email fails - invitation was created
    }

    return { success: true, message: `Invitation sent to ${email} (new user)` };
  }

  if (intent === "update-role") {
    // Only owners and admins can update roles
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return { error: "Only owners and admins can manage team members" };
    }

    const userId = formData.get("userId") as string;
    const role = formData.get("role") as string;

    // Prevent users from modifying their own role
    if (userId === ctx.user.id) {
      return { error: "You cannot modify your own role" };
    }

    // Validate role against allowed values
    const allowedRoles = ["admin", "member", "staff"];
    if (!allowedRoles.includes(role)) {
      return { error: "Invalid role" };
    }

    await db
      .update(member)
      .set({ role })
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, ctx.org.id)
        )
      );

    return { success: true, message: "Role updated successfully" };
  }

  if (intent === "remove") {
    // Only owners and admins can remove team members
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return { error: "Only owners and admins can manage team members" };
    }

    const userId = formData.get("userId") as string;

    // Prevent users from removing themselves
    if (userId === ctx.user.id) {
      return { error: "You cannot modify your own role" };
    }

    await db.delete(member).where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, ctx.org.id)
      )
    );

    return { success: true, message: "Team member removed" };
  }

  if (intent === "cancel-invite") {
    const inviteId = formData.get("inviteId") as string;

    await db.delete(invitation).where(
      and(
        eq(invitation.id, inviteId),
        eq(invitation.organizationId, ctx.org.id)
      )
    );

    return { success: true, message: "Invitation cancelled" };
  }

  if (intent === "resend-invite") {
    const inviteId = formData.get("inviteId") as string;

    // Fetch the invitation details
    const [existingInvite] = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.id, inviteId),
          eq(invitation.organizationId, ctx.org.id)
        )
      );

    if (!existingInvite) {
      return { error: "Invitation not found" };
    }

    // Send invitation email
    const inviteUrl = `${getAppUrl()}/auth/accept-invite?token=${inviteId}`;
    try {
      await sendEmail({
        to: existingInvite.email,
        subject: `Reminder: You're invited to join ${ctx.org.name} on DiveStreams`,
        html: `
          <p>Hi,</p>
          <p>This is a reminder that ${ctx.user.name || 'A team member'} has invited you to join <strong>${ctx.org.name}</strong> on DiveStreams as a ${existingInvite.role}.</p>
          <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
          <p>This invitation expires in 7 days from when it was originally sent.</p>
          <p>If you didn't expect this invitation, you can ignore this email.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to resend invitation email:", error);
      return { error: "Failed to send email" };
    }

    return { success: true, message: "Invitation resent" };
  }

  if (intent === "reset-password") {
    const userId = formData.get("userId") as string;
    const method = formData.get("method") as ResetPasswordParams["method"];
    const newPassword = formData.get("newPassword") as string | undefined;

    // Check permissions
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return { error: "Only owners and admins can reset passwords" };
    }

    // Get target member to check role
    const [targetMember] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, ctx.org.id)
        )
      )
      .limit(1);

    if (!targetMember) {
      return { error: "User not found" };
    }

    // Cannot reset owner passwords
    if (targetMember.role === "owner") {
      return { error: "Cannot reset password for owner accounts" };
    }

    // Prevent self-reset
    if (userId === ctx.user.id) {
      return { error: "Use profile settings to change your own password" };
    }

    // Execute reset
    try {
      const result = await resetUserPassword({
        targetUserId: userId,
        adminUserId: ctx.user.id,
        organizationId: ctx.org.id,
        method,
        newPassword,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      return {
        success: true,
        temporaryPassword: result.temporaryPassword,
        message: method === "auto_generated"
          ? `Password reset successful. Temporary password: ${result.temporaryPassword}`
          : "Password reset successful",
      };
    } catch (error) {
      console.error("Password reset error:", error);
      return { error: error instanceof Error ? error.message : "Failed to reset password" };
    }
  }

  return null;
}

export default function TeamPage() {
  const { team, pendingInvites, roles, planLimit, limitRemaining, isPremium, canInviteTeamMembers } = useLoaderData<typeof loader>();
  const layoutData = useRouteLoaderData("routes/tenant/layout") as { csrfToken?: string } | undefined;
  const csrfToken = layoutData?.csrfToken;
  const fetcher = useFetcher();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Close modal only on successful invitation
  useEffect(() => {
    if (fetcher.data?.success) {
      setShowInviteModal(false);
    }
  }, [fetcher.data]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openDropdownId && !target.closest('.relative')) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  // Close password reset modal on success (password display is handled by ResetPasswordModal)
  useEffect(() => {
    if (fetcher.data?.success && resetPasswordUser) {
      if (!fetcher.data?.temporaryPassword) {
        // Only auto-close if there's no temporary password to display
        setResetPasswordUser(null);
      }
    }
  }, [fetcher.data, resetPasswordUser]);

  const activeMembers = team.filter((m) => m.status === "active").length;
  const atLimit = planLimit !== -1 && activeMembers >= planLimit;
  const isNearLimit = planLimit !== -1 && limitRemaining <= Math.ceil(planLimit * 0.2);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Team Members</h1>
        <p className="text-foreground-muted">
          {planLimit === -1
            ? `${activeMembers} team members (Unlimited)`
            : `${activeMembers} of ${planLimit} team members used`}
        </p>
      </div>

      {/* Premium required warning for team invites */}
      {!canInviteTeamMembers && (
        <div className="bg-brand-muted border border-brand-muted text-brand px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Upgrade to invite team members</p>
          <p className="text-sm">
            Team member invitations are a premium feature.{" "}
            <Link to="/tenant/settings/billing" className="underline">
              Upgrade your plan
            </Link>{" "}
            to invite additional team members.
          </p>
        </div>
      )}

      {/* Plan limit warning */}
      {canInviteTeamMembers && atLimit && (
        <div className="bg-warning-muted border border-warning-muted text-warning px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          <p className="font-medium">Team limit reached</p>
          <p className="text-sm">
            Your current plan allows {planLimit} team members.{" "}
            <Link to="/tenant/settings/billing" className="underline">
              Upgrade your plan
            </Link>{" "}
            to add more team members.
          </p>
        </div>
      )}

      {/* Near limit warning */}
      {canInviteTeamMembers && isNearLimit && !atLimit && (
        <div className="mb-4 p-3 bg-warning-muted border border-warning-muted rounded-lg">
          <p className="text-warning text-sm">
            {limitRemaining} of {planLimit} team member slots remaining.{" "}
            <Link to="/tenant/settings/billing" className="underline font-medium">
              Upgrade for more
            </Link>
          </p>
        </div>
      )}

      {/* Invite Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowInviteModal(true)}
          disabled={atLimit || !canInviteTeamMembers}
          className={`px-4 py-2 rounded-lg ${
            atLimit || !canInviteTeamMembers
              ? "bg-surface-overlay text-foreground-muted cursor-not-allowed"
              : "bg-brand text-white hover:bg-brand-hover"
          }`}
        >
          Invite Team Member
        </button>
      </div>

      {/* Team List */}
      <div className="bg-surface-raised rounded-xl shadow-sm mb-6 overflow-visible">
        <div className="divide-y overflow-visible">
          {team.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between overflow-visible">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-muted text-brand rounded-full flex items-center justify-center font-medium">
                  {(member.name || "U")
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-foreground-muted">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      member.role === "owner"
                        ? "bg-info-muted text-info"
                        : member.role === "manager"
                        ? "bg-brand-muted text-brand"
                        : member.role === "divemaster"
                        ? "bg-success-muted text-success"
                        : "bg-surface-inset text-foreground"
                    }`}
                  >
                    {roles.find((r) => r.id === member.role)?.name || member.role}
                  </span>
                  <p className="text-xs text-foreground-subtle mt-1">{member.lastActive}</p>
                </div>

                {member.role !== "owner" && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === member.id ? null : member.id)}
                      className="p-2 hover:bg-surface-overlay rounded-lg"
                    >
                      ⋮
                    </button>
                    {openDropdownId === member.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-surface-raised border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                      <div className="py-1">
                        <fetcher.Form method="post">
                          <CsrfInput />
                          <input type="hidden" name="intent" value="update-role" />
                          <input type="hidden" name="userId" value={member.userId} />
                          <div className="px-3 py-2 text-xs text-foreground-muted font-medium">
                            Change Role
                          </div>
                          {roles
                            .filter((r) => r.id !== "owner")
                            .map((role) => (
                              <button
                                key={role.id}
                                type="submit"
                                name="role"
                                value={role.id}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-inset ${
                                  member.role === role.id ? "bg-brand-muted text-brand" : ""
                                }`}
                              >
                                {role.name}
                              </button>
                            ))}
                        </fetcher.Form>
                        <hr className="my-1" />
                        <button
                          type="button"
                          onClick={() => setResetPasswordUser({
                            id: member.userId,  // Use userId, not member.id
                            name: member.name,
                            email: member.email
                          })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset"
                        >
                          Reset Password
                        </button>
                        <hr className="my-1" />
                        <fetcher.Form
                          method="post"
                          onSubmit={(e) => {
                            if (
                              !confirm(
                                `Are you sure you want to remove ${member.name} from the team?`
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <CsrfInput />
                          <input type="hidden" name="intent" value="remove" />
                          <input type="hidden" name="userId" value={member.userId} />
                          <button
                            type="submit"
                            className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger-muted"
                          >
                            Remove from team
                          </button>
                        </fetcher.Form>
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b bg-surface-inset">
            <h3 className="font-medium">Pending Invitations</h3>
          </div>
          <div className="divide-y">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-foreground-muted">
                    {roles.find((r) => r.id === invite.role)?.name} • Invited{" "}
                    {invite.invitedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <fetcher.Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="resend-invite" />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className="text-sm text-brand hover:underline"
                    >
                      Resend
                    </button>
                  </fetcher.Form>
                  <fetcher.Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="cancel-invite" />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className="text-sm text-danger hover:underline"
                    >
                      Cancel
                    </button>
                  </fetcher.Form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Descriptions */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-4">Role Permissions</h3>
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    role.id === "owner"
                      ? "bg-info-muted text-info"
                      : role.id === "manager"
                      ? "bg-brand-muted text-brand"
                      : role.id === "divemaster"
                      ? "bg-success-muted text-success"
                      : "bg-surface-inset text-foreground"
                  }`}
                >
                  {role.name}
                </span>
              </div>
              <p className="text-sm text-foreground-muted">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => {
            setResetPasswordUser(null);
            // Clear fetcher data when closing modal
            if (fetcher.state === "idle" && fetcher.data) {
              fetcher.load(window.location.href);
            }
          }}
          onSubmit={(data) => {
            fetcher.submit(
              {
                intent: "reset-password",
                userId: data.userId,
                method: data.method,
                ...(data.newPassword && { newPassword: data.newPassword }),
                ...(csrfToken && { _csrf: csrfToken }),
              },
              { method: "post" }
            );
          }}
          result={fetcher.data}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
            <fetcher.Form
              method="post"
            >
              <CsrfInput />
              <input type="hidden" name="intent" value="invite" />

              {fetcher.data?.error && (
                <div className="bg-danger-bg text-danger border border-danger-border p-3 rounded-lg mb-4">
                  {fetcher.data.error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="colleague@example.com"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    required
                    defaultValue="staff"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  >
                    {roles
                      .filter((r) => r.id !== "owner")
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {roles.find((r) => r.id === "staff")?.description}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover"
                >
                  Send Invitation
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 border py-2 rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
