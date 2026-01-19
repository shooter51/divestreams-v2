import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { member, user, invitation } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { PremiumGate } from "../../../../app/components/ui/UpgradePrompt";
import { sendEmail } from "../../../../lib/email";
import { getAppUrl } from "../../../../lib/utils/url";

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
  const ctx = await requireOrgContext(request);

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

  // Plan limit from context
  const planLimit = ctx.limits.teamMembers;

  return {
    team,
    pendingInvites,
    roles,
    planLimit,
    isPremium: ctx.isPremium,
    canInviteTeamMembers: ctx.isPremium, // Only premium users can invite team members
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    // Only premium users can invite team members
    if (!ctx.isPremium) {
      return { error: "Team invitations require a premium subscription" };
    }

    const email = formData.get("email") as string;
    const role = formData.get("role") as string;

    // Create invitation with generated ID
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

    return { success: true, message: `Invitation sent to ${email}` };
  }

  if (intent === "update-role") {
    const memberId = formData.get("userId") as string;
    const role = formData.get("role") as string;

    await db
      .update(member)
      .set({ role })
      .where(
        and(
          eq(member.id, memberId),
          eq(member.organizationId, ctx.org.id)
        )
      );

    return { success: true, message: "Role updated successfully" };
  }

  if (intent === "remove") {
    const memberId = formData.get("userId") as string;

    await db.delete(member).where(
      and(
        eq(member.id, memberId),
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

  return null;
}

export default function TeamPage() {
  const { team, pendingInvites, roles, planLimit, isPremium, canInviteTeamMembers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const activeMembers = team.filter((m) => m.status === "active").length;
  const atLimit = activeMembers >= planLimit;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/app/settings" className="text-blue-600 hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Team Members</h1>
        <p className="text-gray-500">
          {activeMembers} of {planLimit} team members used
        </p>
      </div>

      {/* Premium required warning for team invites */}
      {!canInviteTeamMembers && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Upgrade to invite team members</p>
          <p className="text-sm">
            Team member invitations are a premium feature.{" "}
            <Link to="/app/settings/billing" className="underline">
              Upgrade your plan
            </Link>{" "}
            to invite additional team members.
          </p>
        </div>
      )}

      {/* Plan limit warning */}
      {canInviteTeamMembers && atLimit && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Team limit reached</p>
          <p className="text-sm">
            Your current plan allows {planLimit} team members.{" "}
            <Link to="/app/settings/billing" className="underline">
              Upgrade your plan
            </Link>{" "}
            to add more team members.
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
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Invite Team Member
        </button>
      </div>

      {/* Team List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="divide-y">
          {team.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                  {member.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      member.role === "owner"
                        ? "bg-purple-100 text-purple-700"
                        : member.role === "manager"
                        ? "bg-blue-100 text-blue-700"
                        : member.role === "divemaster"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {roles.find((r) => r.id === member.role)?.name || member.role}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{member.lastActive}</p>
                </div>

                {member.role !== "owner" && (
                  <div className="relative group">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">⋮</button>
                    <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg hidden group-hover:block z-10">
                      <div className="py-1">
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="update-role" />
                          <input type="hidden" name="userId" value={member.id} />
                          <div className="px-3 py-2 text-xs text-gray-500 font-medium">
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
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                  member.role === role.id ? "bg-blue-50 text-blue-600" : ""
                                }`}
                              >
                                {role.name}
                              </button>
                            ))}
                        </fetcher.Form>
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
                          <input type="hidden" name="intent" value="remove" />
                          <input type="hidden" name="userId" value={member.id} />
                          <button
                            type="submit"
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Remove from team
                          </button>
                        </fetcher.Form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-medium">Pending Invitations</h3>
          </div>
          <div className="divide-y">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-gray-500">
                    {roles.find((r) => r.id === invite.role)?.name} • Invited{" "}
                    {invite.invitedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="resend-invite" />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Resend
                    </button>
                  </fetcher.Form>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="cancel-invite" />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className="text-sm text-red-600 hover:underline"
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
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-4">Role Permissions</h3>
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    role.id === "owner"
                      ? "bg-purple-100 text-purple-700"
                      : role.id === "manager"
                      ? "bg-blue-100 text-blue-700"
                      : role.id === "divemaster"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {role.name}
                </span>
              </div>
              <p className="text-sm text-gray-600">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
            <fetcher.Form
              method="post"
              onSubmit={() => setShowInviteModal(false)}
            >
              <input type="hidden" name="intent" value="invite" />

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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {roles
                      .filter((r) => r.id !== "owner")
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {roles.find((r) => r.id === "staff")?.description}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Send Invitation
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 border py-2 rounded-lg hover:bg-gray-50"
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
