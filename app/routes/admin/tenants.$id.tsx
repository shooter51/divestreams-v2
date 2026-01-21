import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { db } from "../../../lib/db";
import { organization, member, user } from "../../../lib/db/schema/auth";
import { subscription } from "../../../lib/db/schema/subscription";
import { customers, tours, bookings } from "../../../lib/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { getBaseDomain, getTenantUrl } from "../../../lib/utils/url";

export const meta: MetaFunction = () => [{ title: "Organization Details - DiveStreams Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  const slug = params.id; // Using slug instead of id
  if (!slug) throw new Response("Not found", { status: 404 });

  // Find organization by slug
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (!org) throw new Response("Not found", { status: 404 });

  // Get members with user info
  const members = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      userEmail: user.email,
      userName: user.name,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, org.id));

  // Get subscription
  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  // Get usage stats
  const [customerCount] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.organizationId, org.id));

  const [tourCount] = await db
    .select({ count: count() })
    .from(tours)
    .where(eq(tours.organizationId, org.id));

  const [bookingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.organizationId, org.id));

  return {
    organization: {
      ...org,
      createdAt: org.createdAt.toISOString().split("T")[0],
      metadata: org.metadata ? JSON.parse(org.metadata) : null,
    },
    members: members.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString().split("T")[0],
    })),
    subscription: sub
      ? {
          ...sub,
          currentPeriodStart: sub.currentPeriodStart?.toISOString().split("T")[0] || null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString().split("T")[0] || null,
          createdAt: sub.createdAt.toISOString().split("T")[0],
        }
      : null,
    usage: {
      customers: customerCount?.count || 0,
      tours: tourCount?.count || 0,
      bookings: bookingCount?.count || 0,
      members: members.length,
    },
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  const slug = params.id;
  if (!slug) throw new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Find organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (!org) throw new Response("Not found", { status: 404 });

  if (intent === "delete") {
    // Delete the organization (cascades via FK)
    await db.delete(organization).where(eq(organization.id, org.id));
    return redirect("/dashboard");
  }

  if (intent === "updateName") {
    const name = formData.get("name") as string;
    if (!name) {
      return { errors: { name: "Name is required" } };
    }
    await db
      .update(organization)
      .set({ name, updatedAt: new Date() })
      .where(eq(organization.id, org.id));
    return { success: true };
  }

  if (intent === "updateSubscription") {
    const plan = formData.get("plan") as string;
    const status = formData.get("status") as string;

    // Check if subscription exists
    const [existingSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, org.id))
      .limit(1);

    if (existingSub) {
      await db
        .update(subscription)
        .set({
          plan: plan as "free" | "premium",
          status: status as "active" | "trialing" | "past_due" | "canceled",
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, existingSub.id));
    } else {
      await db.insert(subscription).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        plan: plan as "free" | "premium",
        status: status as "active" | "trialing" | "past_due" | "canceled",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return { success: true };
  }

  if (intent === "removeMember") {
    const memberId = formData.get("memberId") as string;
    if (memberId) {
      await db.delete(member).where(eq(member.id, memberId));
      return { success: true };
    }
  }

  if (intent === "updateRole") {
    const memberId = formData.get("memberId") as string;
    const role = formData.get("role") as string;
    if (memberId && role) {
      await db
        .update(member)
        .set({ role, updatedAt: new Date() })
        .where(eq(member.id, memberId));
      return { success: true };
    }
  }

  return null;
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  staff: "bg-green-100 text-green-700",
  customer: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-yellow-100 text-yellow-700",
  canceled: "bg-red-100 text-red-700",
};

export default function OrganizationDetailsPage() {
  const { organization: org, members, subscription: sub, usage } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const baseDomain = getBaseDomain();

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete "${org.name}"? This will remove all their data and cannot be undone.`
      )
    ) {
      const form = document.createElement("form");
      form.method = "post";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "intent";
      input.value = "delete";
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold mt-2">{org.name}</h1>
        <p className="text-gray-600">{org.slug}.{baseDomain}</p>
      </div>

      {actionData?.success && (
        <div className="mb-6 bg-green-50 text-green-600 p-3 rounded-lg text-sm">
          Changes saved successfully
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Organization Details</h2>
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="updateName" />
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">
                  Slug (cannot be changed)
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={org.slug}
                    disabled
                    className="flex-1 px-3 py-2 border rounded-l-lg bg-gray-50 text-gray-600"
                  />
                  <span className="bg-gray-100 px-3 py-2 border border-l-0 rounded-r-lg text-gray-600">
                    .{baseDomain}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  defaultValue={org.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 text-sm"
              >
                {isSubmitting ? "Saving..." : "Update Name"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600">
                Created: {org.createdAt}
              </p>
              {org.logo && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 mb-1">Logo:</p>
                  <img src={org.logo} alt="Logo" className="w-16 h-16 rounded object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Subscription Management */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Subscription</h2>
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="updateSubscription" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan" className="block text-sm font-medium mb-1">
                    Plan
                  </label>
                  <select
                    id="plan"
                    name="plan"
                    defaultValue={sub?.plan || "free"}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={sub?.status || "active"}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 text-sm"
              >
                Update Subscription
              </button>
            </form>

            {sub?.stripeCustomerId && (
              <div className="mt-4 pt-4 border-t text-sm space-y-1">
                <p>
                  <span className="text-gray-600">Stripe Customer:</span>{" "}
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                    {sub.stripeCustomerId}
                  </code>
                </p>
                {sub.stripeSubscriptionId && (
                  <p>
                    <span className="text-gray-600">Stripe Subscription:</span>{" "}
                    <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {sub.stripeSubscriptionId}
                    </code>
                  </p>
                )}
                {sub.currentPeriodEnd && (
                  <p>
                    <span className="text-gray-600">Period Ends:</span> {sub.currentPeriodEnd}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Members ({members.length})</h2>
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-gray-500 text-sm">No members</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{m.userName || m.userEmail}</p>
                      <p className="text-xs text-gray-500">{m.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          roleColors[m.role] || "bg-gray-100"
                        }`}
                      >
                        {m.role}
                      </span>
                      {m.role !== "owner" && (
                        <form method="post" className="inline">
                          <input type="hidden" name="intent" value="removeMember" />
                          <input type="hidden" name="memberId" value={m.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                            onClick={(e) => {
                              if (!confirm("Remove this member?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Usage Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Members</span>
                <span className="font-medium">{usage.members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customers</span>
                <span className="font-medium">{usage.customers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tours</span>
                <span className="font-medium">{usage.tours}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bookings</span>
                <span className="font-medium">{usage.bookings}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <a
                href={getTenantUrl(org.slug, "/app")}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 px-4 border rounded-lg hover:bg-gray-50 text-sm"
              >
                Open Dashboard
              </a>
              <button
                onClick={handleDelete}
                className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
              >
                Delete Organization
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Current Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Plan:</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    sub?.plan === "premium"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {sub?.plan || "free"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    statusColors[sub?.status || "active"] || "bg-gray-100"
                  }`}
                >
                  {sub?.status || "active"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
