import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { db } from "../../../lib/db";
import { member, user, invitation, organization } from "../../../lib/db/schema/auth";
import { eq, and, desc } from "drizzle-orm";
import { sendEmail } from "../../../lib/email";
import { getAppUrl, getAdminUrl } from "../../../lib/utils/url";
import { resetUserPassword, type ResetPasswordParams } from "../../../lib/auth/admin-password-reset.server";
import { ResetPasswordModal } from "../../components/settings/ResetPasswordModal";

export const meta: MetaFunction = () => [{ title: "Team - DiveStreams Admin" }];

const roles = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to platform administration",
    permissions: ["all"],
  },
  {
    id: "admin",
    name: "Admin",
    description: "Manage tenants, users, and platform settings",
    permissions: ["tenants", "users", "settings"],
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requirePlatformContext(request);

  // Get platform organization
  const [platformOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "platform"))
    .limit(1);

  if (!platformOrg) {
    throw new Response("Platform organization not found", { status: 500 });
  }

  // Get team members
  const members = await db
    .select({
      member: member,
      user: user,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, platformOrg.id))
    .orderBy(desc(member.createdAt));

  // Get pending invitations
  const pendingInvites = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, platformOrg.id),
        eq(invitation.status, "pending")
      )
    )
    .orderBy(desc(invitation.createdAt));

  return {
    members: members.map((m) => ({
      id: m.member.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.member.role,
      createdAt: m.member.createdAt?.toISOString() || new Date().toISOString(),
    })),
    pendingInvites: pendingInvites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt?.toISOString() || "",
      createdAt: inv.createdAt?.toISOString() || "",
    })),
    currentUserId: ctx.user.id,
    isOwner: ctx.isOwner,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requirePlatformContext(request);

  if (!ctx.isOwner && !ctx.isAdmin) {
    throw new Response("Only admins can manage team", { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Get platform organization
  const [platformOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "platform"))
    .limit(1);

  if (!platformOrg) {
    return { error: "Platform organization not found" };
  }

  switch (intent) {
    case "invite": {
      const email = formData.get("email") as string;
      const role = formData.get("role") as string;

      // Validate email
      if (!email || !email.includes("@")) {
        return { error: "Valid email required" };
      }

      // Only owners can invite other owners
      if (role === "owner" && !ctx.isOwner) {
        return { error: "Only owners can invite other owners" };
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(user.email, email),
            eq(member.organizationId, platformOrg.id)
          )
        )
        .limit(1);

      if (existing) {
        return { error: "User is already a team member" };
      }

      // Check for existing pending invitation
      const [existingInvite] = await db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.email, email),
            eq(invitation.organizationId, platformOrg.id),
            eq(invitation.status, "pending")
          )
        )
        .limit(1);

      if (existingInvite) {
        return { error: "An invitation is already pending for this email" };
      }

      // Create invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inviteId = crypto.randomUUID();
      await db.insert(invitation).values({
        id: inviteId,
        email,
        organizationId: platformOrg.id,
        role: role || "admin",
        status: "pending",
        inviterId: ctx.user.id,
        expiresAt,
      });

      // Send invitation email
      const inviteUrl = getAdminUrl(`/auth/accept-invite?token=${inviteId}`);
      try {
        await sendEmail({
          to: email,
          subject: "You're invited to join DiveStreams Admin",
          html: `
            <p>Hi,</p>
            <p>${ctx.user.name || "A team member"} has invited you to join <strong>DiveStreams Admin</strong> as ${role === "owner" ? "an owner" : "an admin"}.</p>
            <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
            <p>This invitation expires in 7 days.</p>
            <p>If you didn't expect this invitation, you can ignore this email.</p>
          `,
        });
      } catch (error) {
        console.error("Failed to send invitation email:", error);
        // Continue even if email fails - invitation was created
      }

      return { success: true, message: `Invitation sent to ${email}` };
    }

    case "update-role": {
      const memberId = formData.get("memberId") as string;
      const newRole = formData.get("role") as string;

      // Only owners can change roles
      if (!ctx.isOwner) {
        return { error: "Only owners can change roles" };
      }

      // Cannot change own role
      const [targetMember] = await db
        .select()
        .from(member)
        .where(eq(member.id, memberId))
        .limit(1);

      if (targetMember?.userId === ctx.user.id) {
        return { error: "Cannot change your own role" };
      }

      await db
        .update(member)
        .set({ role: newRole })
        .where(eq(member.id, memberId));

      return { success: true };
    }

    case "remove": {
      const memberId = formData.get("memberId") as string;

      // Get member to check if trying to remove self
      const [targetMember] = await db
        .select()
        .from(member)
        .where(eq(member.id, memberId))
        .limit(1);

      if (targetMember?.userId === ctx.user.id) {
        return { error: "Cannot remove yourself" };
      }

      // Only owners can remove other owners
      if (targetMember?.role === "owner" && !ctx.isOwner) {
        return { error: "Only owners can remove other owners" };
      }

      await db.delete(member).where(eq(member.id, memberId));

      return { success: true };
    }

    case "cancel-invite": {
      const inviteId = formData.get("inviteId") as string;

      await db
        .update(invitation)
        .set({ status: "canceled" })
        .where(eq(invitation.id, inviteId));

      return { success: true };
    }

    case "resend-invite": {
      const inviteId = formData.get("inviteId") as string;

      // Fetch the invitation details
      const [existingInvite] = await db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.id, inviteId),
            eq(invitation.organizationId, platformOrg.id)
          )
        );

      if (!existingInvite) {
        return { error: "Invitation not found" };
      }

      // Send invitation email
      const inviteUrl = getAdminUrl(`/auth/accept-invite?token=${inviteId}`);
      try {
        await sendEmail({
          to: existingInvite.email,
          subject: "Reminder: You're invited to join DiveStreams Admin",
          html: `
            <p>Hi,</p>
            <p>This is a reminder that ${ctx.user.name || "A team member"} has invited you to join <strong>DiveStreams Admin</strong> as ${existingInvite.role === "owner" ? "an owner" : "an admin"}.</p>
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

    case "reset-password": {
      const userId = formData.get("userId") as string;
      const method = formData.get("method") as ResetPasswordParams["method"];
      const newPassword = formData.get("newPassword") as string | undefined;

      // Get target member to check role
      const [targetMember] = await db
        .select()
        .from(member)
        .where(eq(member.userId, userId))
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
          organizationId: platformOrg.id,
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
  }

  return { error: "Unknown action" };
}

export default function AdminTeamPage() {
  const { members, pendingInvites, currentUserId, isOwner } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; email: string } | null>(null);

  // Close modal on successful invite
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message && showInviteModal) {
      setShowInviteModal(false);
    }
  }, [fetcher.data, showInviteModal]);

  // Password reset result is passed to modal via fetcher.data
  // Modal will display PasswordDisplayModal for auto-generated passwords

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-foreground-muted text-sm">{members.length} team members</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover"
          >
            Invite Member
          </button>
        )}
      </div>

      {/* Members table */}
      <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Member
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Joined
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-muted text-brand rounded-full flex items-center justify-center text-sm font-medium">
                      {m.name
                        ? m.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                        : m.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{m.name || "Unnamed"}</div>
                      <div className="text-sm text-foreground-muted">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      m.role === "owner"
                        ? "bg-info-muted text-info"
                        : "bg-brand-muted text-brand"
                    }`}
                  >
                    {roles.find((r) => r.id === m.role)?.name || m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground-muted">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.userId !== currentUserId && isOwner && (
                    <div className="relative group inline-block">
                      <button className="p-2 hover:bg-surface-overlay rounded-lg text-foreground-muted">
                        ...
                      </button>
                      <div className="absolute right-0 mt-1 w-48 bg-surface-raised border rounded-lg shadow-lg hidden group-hover:block z-10">
                        <div className="py-1">
                          {m.role !== "owner" && (
                            <>
                              <div className="px-3 py-2 text-xs text-foreground-muted font-medium">
                                Change Role
                              </div>
                              <fetcher.Form method="post">
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="update-role"
                                />
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={m.id}
                                />
                                {roles
                                  .filter((r) => r.id !== m.role)
                                  .map((role) => (
                                    <button
                                      key={role.id}
                                      type="submit"
                                      name="role"
                                      value={role.id}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset"
                                    >
                                      {role.name}
                                    </button>
                                  ))}
                              </fetcher.Form>
                              <hr className="my-1" />
                            </>
                          )}
                          {m.role !== "owner" && (
                            <button
                              onClick={() => setResetPasswordUser({ id: m.userId, name: m.name || "User", email: m.email })}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset"
                            >
                              Reset Password
                            </button>
                          )}
                          {m.role !== "owner" && <hr className="my-1" />}
                          <fetcher.Form
                            method="post"
                            onSubmit={(e) => {
                              if (
                                !confirm(
                                  `Are you sure you want to remove ${m.name || m.email} from the team?`
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="intent" value="remove" />
                            <input
                              type="hidden"
                              name="memberId"
                              value={m.id}
                            />
                            <button
                              type="submit"
                              className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger-muted"
                            >
                              Remove from team
                            </button>
                          </fetcher.Form>
                        </div>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-surface-inset">
            <h3 className="font-medium">Pending Invitations</h3>
          </div>
          <div className="divide-y">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-sm text-foreground-muted">
                    {roles.find((r) => r.id === inv.role)?.name || inv.role} -
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="resend-invite" />
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button
                      type="submit"
                      className="text-sm text-brand hover:underline"
                    >
                      Resend
                    </button>
                  </fetcher.Form>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="cancel-invite" />
                    <input type="hidden" name="inviteId" value={inv.id} />
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

      {/* Role descriptions */}
      <div className="bg-surface-raised rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Role Permissions</h3>
        <div className="space-y-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    role.id === "owner"
                      ? "bg-info-muted text-info"
                      : "bg-brand-muted text-brand"
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

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>

            {fetcher.data?.error && (
              <div className="mb-4 bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg text-sm">
                {fetcher.data.error}
              </div>
            )}

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="invite" />

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="admin@example.com"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    required
                    defaultValue="admin"
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {roles.find((r) => r.id === "admin")?.description}
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
              },
              { method: "post" }
            );
          }}
          result={fetcher.data}
        />
      )}
    </div>
  );
}
