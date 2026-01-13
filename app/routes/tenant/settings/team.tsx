import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getTeamMembers, getSubscriptionPlanById } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Team - DiveStreams" }];

const roles = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to everything",
    permissions: ["all"],
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage bookings, customers, and staff",
    permissions: ["bookings", "customers", "trips", "tours", "equipment", "boats", "reports"],
  },
  {
    id: "staff",
    name: "Staff",
    description: "View and manage daily operations",
    permissions: ["bookings", "customers", "trips"],
  },
  {
    id: "divemaster",
    name: "Divemaster",
    description: "Manage trips and equipment",
    permissions: ["trips", "equipment", "boats"],
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);

  // Get real team members from database
  const team = await getTeamMembers(tenant.schemaName);

  // Get plan limits from subscription plan
  let planLimit = 2; // Default for starter plan
  if (tenant.planId) {
    const plan = await getSubscriptionPlanById(tenant.planId);
    if (plan?.limits && typeof plan.limits === "object" && "users" in plan.limits) {
      planLimit = (plan.limits as { users: number }).users;
    }
  }

  // No invitations table exists yet - return empty array
  // TODO: Create invitations table and query when needed
  const pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    invitedAt: string;
    expiresAt: string;
  }> = [];

  return { team, pendingInvites, roles, planLimit };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    const email = formData.get("email");
    const role = formData.get("role");
    // TODO: Send invitation email and create pending invite
    return { success: true, message: `Invitation sent to ${email}` };
  }

  if (intent === "update-role") {
    const userId = formData.get("userId");
    const role = formData.get("role");
    // TODO: Update user role
    return { success: true, message: "Role updated successfully" };
  }

  if (intent === "remove") {
    const userId = formData.get("userId");
    // TODO: Remove user from team
    return { success: true, message: "Team member removed" };
  }

  if (intent === "cancel-invite") {
    const inviteId = formData.get("inviteId");
    // TODO: Cancel pending invite
    return { success: true, message: "Invitation cancelled" };
  }

  if (intent === "resend-invite") {
    const inviteId = formData.get("inviteId");
    // TODO: Resend invitation email
    return { success: true, message: "Invitation resent" };
  }

  return null;
}

export default function TeamPage() {
  const { team, pendingInvites, roles, planLimit } = useLoaderData<typeof loader>();
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

      {/* Plan limit warning */}
      {atLimit && (
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
          disabled={atLimit}
          className={`px-4 py-2 rounded-lg ${
            atLimit
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
