import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { db } from "../../../lib/db";
import { organization, member, user, account } from "../../../lib/db/schema/auth";
import { subscription } from "../../../lib/db/schema/subscription";
import { customers, tours, bookings, subscriptionPlans } from "../../../lib/db/schema";
import { eq, and, count, asc } from "drizzle-orm";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { getBaseDomain, getTenantUrl } from "../../../lib/utils/url";
import { hashPassword, generateRandomPassword } from "../../../lib/auth/password.server";
import { auth } from "../../../lib/auth";
import { invalidateSubscriptionCache } from "../../../lib/cache/subscription.server";

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

  // Get subscription with plan details
  const [subWithPlan] = await db
    .select({
      subscription: subscription,
      plan: subscriptionPlans,
    })
    .from(subscription)
    .leftJoin(subscriptionPlans, eq(subscription.planId, subscriptionPlans.id))
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  // Get all active subscription plans for the dropdown
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.monthlyPrice));

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

  const sub = subWithPlan?.subscription;

  // Pre-compute URLs server-side where process.env.APP_URL is available
  const tenantUrl = getTenantUrl(org.slug, "/tenant");
  const baseDomain = getBaseDomain();

  return {
    organization: {
      ...org,
      createdAt: org.createdAt.toISOString().split("T")[0],
      metadata: org.metadata ? JSON.parse(org.metadata) : null,
    },
    tenantUrl,
    baseDomain,
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
          planDetails: subWithPlan?.plan ? {
            id: subWithPlan.plan.id,
            name: subWithPlan.plan.name,
            displayName: subWithPlan.plan.displayName,
            monthlyPrice: subWithPlan.plan.monthlyPrice,
          } : null,
        }
      : null,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      monthlyPrice: p.monthlyPrice,
    })),
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
    const planId = formData.get("planId") as string;
    const status = formData.get("status") as string;

    // [KAN-594 FIX] Get plan details for backwards compatibility AND validation
    let planName = "free";
    let selectedPlan = null;

    if (planId) {
      [selectedPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

      if (selectedPlan) {
        planName = selectedPlan.name;
      } else {
        return {
          errors: { planId: "Invalid plan ID" },
          success: false
        };
      }
    }

    // Check if subscription exists
    const [existingSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, org.id))
      .limit(1);

    if (existingSub) {
      // [KAN-594 FIX] Update BOTH planId (FK) and plan (legacy string)
      await db
        .update(subscription)
        .set({
          planId: planId || null,
          plan: planName, // Keep legacy field updated for backwards compatibility
          status: status as "active" | "trialing" | "past_due" | "canceled",
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, existingSub.id));
    } else {
      // [KAN-594 FIX] Create subscription with BOTH fields set
      await db.insert(subscription).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        planId: planId || null,
        plan: planName, // Keep legacy field for backwards compatibility
        status: status as "active" | "trialing" | "past_due" | "canceled",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // [KAN-594 FIX PHASE 3] Invalidate cache after subscription change
    // This ensures tenant immediately sees premium features without re-login
    await invalidateSubscriptionCache(org.id);

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

  if (intent === "resetPassword") {
    const userId = formData.get("userId") as string;
    const method = formData.get("method") as "set" | "generate" | "sendLink";

    if (!userId) {
      return { error: "User ID is required" };
    }

    // Get the user
    const [targetUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return { error: "User not found" };
    }

    if (method === "sendLink") {
      // Use Better Auth's password reset flow
      try {
        await auth.api.requestPasswordReset({
          body: { email: targetUser.email, redirectTo: "/auth/reset-password" },
        });
        return { success: true, message: `Password reset email sent to ${targetUser.email}` };
      } catch (error) {
        console.error("Failed to send reset email:", error);
        return { error: "Failed to send reset email. Check user's email address." };
      }
    }

    let newPassword: string;
    if (method === "generate") {
      newPassword = generateRandomPassword(16);
    } else {
      // method === "set"
      newPassword = formData.get("password") as string;
      if (!newPassword || newPassword.length < 8) {
        return { error: "Password must be at least 8 characters" };
      }
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));

    if (method === "generate") {
      return { success: true, message: "Password reset successfully", generatedPassword: newPassword };
    }
    return { success: true, message: "Password reset successfully" };
  }

  if (intent === "changeEmail") {
    const userId = formData.get("userId") as string;
    const newEmail = formData.get("newEmail") as string;

    if (!userId || !newEmail) {
      return { error: "User ID and new email are required" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return { error: "Please enter a valid email address" };
    }

    // Check if email already exists
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, newEmail))
      .limit(1);

    if (existingUser && existingUser.id !== userId) {
      return { error: "Email already in use by another account" };
    }

    // Update email
    await db
      .update(user)
      .set({ email: newEmail, updatedAt: new Date() })
      .where(eq(user.id, userId));

    return { success: true, message: `Email updated to ${newEmail}` };
  }

  return null;
}

const roleColors: Record<string, string> = {
  owner: "bg-info-muted text-info",
  admin: "bg-brand-muted text-brand",
  staff: "bg-success-muted text-success",
  customer: "bg-surface-inset text-foreground",
};

const statusColors: Record<string, string> = {
  active: "bg-success-muted text-success",
  trialing: "bg-brand-muted text-brand",
  past_due: "bg-warning-muted text-warning",
  canceled: "bg-danger-muted text-danger",
};

type ModalState = {
  type: "password" | "email" | null;
  user: { id: string; email: string; name: string | null } | null;
};

export default function OrganizationDetailsPage() {
  const { organization: org, members, subscription: sub, usage, plans, tenantUrl, baseDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = navigation.state === "submitting";

  const [modal, setModal] = useState<ModalState>({ type: null, user: null });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const closeModal = () => {
    setModal({ type: null, user: null });
    setGeneratedPassword(null);
    setCopied(false);
  };

  // Handle fetcher response for generated password
  useEffect(() => {
    if (fetcher.data?.generatedPassword && !generatedPassword) {
      setGeneratedPassword(fetcher.data.generatedPassword);
    }
  }, [fetcher.data, generatedPassword]);

  // Close modal on successful email change or password reset (send link)
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message && modal.type) {
      // Don't close if it's a generated password - user needs to see it
      if (!fetcher.data.generatedPassword) {
        closeModal();
      }
    }
  }, [fetcher.data, modal.type]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <Link to="/dashboard" className="text-brand hover:underline text-sm">
          &larr; Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold mt-2">{org.name}</h1>
        <p className="text-foreground-muted">{org.slug}.{baseDomain}</p>
      </div>

      {actionData?.success && (
        <div className="mb-6 bg-success-muted text-success p-3 rounded-lg text-sm">
          Changes saved successfully
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Details */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Organization Details</h2>
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="updateName" />
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground-muted">
                  Slug (cannot be changed)
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={org.slug}
                    disabled
                    className="flex-1 px-3 py-2 border rounded-l-lg bg-surface-inset text-foreground-muted"
                  />
                  <span className="bg-surface-inset px-3 py-2 border border-l-0 rounded-r-lg text-foreground-muted">
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled text-sm"
              >
                {isSubmitting ? "Saving..." : "Update Name"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-foreground-muted">
                Created: {org.createdAt}
              </p>
              {org.logo && (
                <div className="mt-2">
                  <p className="text-sm text-foreground-muted mb-1">Logo:</p>
                  <img src={org.logo} alt="Logo" className="w-16 h-16 rounded object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Subscription Management */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Subscription</h2>
            <form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="updateSubscription" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="planId" className="block text-sm font-medium mb-1">
                    Plan
                  </label>
                  <select
                    id="planId"
                    name="planId"
                    defaultValue={sub?.planId || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Select a plan...</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.displayName} (${(plan.monthlyPrice / 100).toFixed(2)}/mo)
                      </option>
                    ))}
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled text-sm"
              >
                Update Subscription
              </button>
            </form>

            {sub?.stripeCustomerId && (
              <div className="mt-4 pt-4 border-t text-sm space-y-1">
                <p>
                  <span className="text-foreground-muted">Stripe Customer:</span>{" "}
                  <code className="bg-surface-inset px-2 py-0.5 rounded text-xs">
                    {sub.stripeCustomerId}
                  </code>
                </p>
                {sub.stripeSubscriptionId && (
                  <p>
                    <span className="text-foreground-muted">Stripe Subscription:</span>{" "}
                    <code className="bg-surface-inset px-2 py-0.5 rounded text-xs">
                      {sub.stripeSubscriptionId}
                    </code>
                  </p>
                )}
                {sub.currentPeriodEnd && (
                  <p>
                    <span className="text-foreground-muted">Period Ends:</span> {sub.currentPeriodEnd}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Members ({members.length})</h2>
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-foreground-muted text-sm">No members</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{m.userName || m.userEmail}</p>
                      <p className="text-xs text-foreground-muted">{m.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          roleColors[m.role] || "bg-surface-inset"
                        }`}
                      >
                        {m.role}
                      </span>
                      <div className="relative group">
                        <button className="text-xs text-brand hover:underline">
                          Manage
                        </button>
                        <div className="absolute right-0 mt-1 w-40 bg-surface-raised border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            type="button"
                            onClick={() => setModal({ type: "password", user: { id: m.userId, email: m.userEmail, name: m.userName } })}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal({ type: "email", user: { id: m.userId, email: m.userEmail, name: m.userName } })}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset"
                          >
                            Change Email
                          </button>
                        </div>
                      </div>
                      {m.role !== "owner" && (
                        <form method="post" className="inline">
                          <input type="hidden" name="intent" value="removeMember" />
                          <input type="hidden" name="memberId" value={m.id} />
                          <button
                            type="submit"
                            className="text-xs text-danger hover:underline"
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
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Usage Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-foreground-muted">Members</span>
                <span className="font-medium">{usage.members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Customers</span>
                <span className="font-medium">{usage.customers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Tours</span>
                <span className="font-medium">{usage.tours}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Bookings</span>
                <span className="font-medium">{usage.bookings}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <a
                href={tenantUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 px-4 border rounded-lg hover:bg-surface-inset text-sm"
              >
                Open Dashboard
              </a>
              <button
                onClick={handleDelete}
                className="w-full py-2 px-4 border border-danger text-danger rounded-lg hover:bg-danger-muted text-sm"
              >
                Delete Organization
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Current Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Plan:</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    sub?.planDetails?.monthlyPrice && sub.planDetails.monthlyPrice > 0
                      ? "bg-info-muted text-info"
                      : "bg-surface-inset text-foreground"
                  }`}
                >
                  {sub?.planDetails?.displayName || sub?.plan || "Free"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">Status:</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    statusColors[sub?.status || "active"] || "bg-surface-inset"
                  }`}
                >
                  {sub?.status || "active"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {modal.type === "password" && modal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-4">
              Reset Password for {modal.user.name || modal.user.email}
            </h3>

            {fetcher.data?.error && (
              <div className="mb-4 bg-danger-muted text-danger p-3 rounded-lg text-sm">
                {fetcher.data.error}
              </div>
            )}

            {fetcher.data?.success && !generatedPassword && (
              <div className="mb-4 bg-success-muted text-success p-3 rounded-lg text-sm">
                {fetcher.data.message}
              </div>
            )}

            <div className="space-y-4">
              {/* Option 1: Set specific password */}
              <fetcher.Form method="post" className="space-y-2">
                <input type="hidden" name="intent" value="resetPassword" />
                <input type="hidden" name="userId" value={modal.user.id} />
                <input type="hidden" name="method" value="set" />
                <label className="block text-sm font-medium">Set specific password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="password"
                    placeholder="Min 8 characters"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    minLength={8}
                    required
                  />
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting"}
                    className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-hover disabled:bg-brand-disabled"
                  >
                    Set
                  </button>
                </div>
              </fetcher.Form>

              <div className="border-t pt-4">
                {/* Option 2: Generate random password */}
                <fetcher.Form method="post" className="space-y-2">
                  <input type="hidden" name="intent" value="resetPassword" />
                  <input type="hidden" name="userId" value={modal.user.id} />
                  <input type="hidden" name="method" value="generate" />
                  <label className="block text-sm font-medium">Generate random password</label>
                  {generatedPassword ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedPassword}
                        readOnly
                        className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono bg-surface-inset"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedPassword)}
                        className="px-4 py-2 border rounded-lg text-sm hover:bg-surface-inset"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={fetcher.state === "submitting"}
                      className="px-4 py-2 border rounded-lg text-sm hover:bg-surface-inset disabled:opacity-50"
                    >
                      Generate & Show
                    </button>
                  )}
                </fetcher.Form>
              </div>

              <div className="border-t pt-4">
                {/* Option 3: Send reset link */}
                <fetcher.Form method="post" className="space-y-2">
                  <input type="hidden" name="intent" value="resetPassword" />
                  <input type="hidden" name="userId" value={modal.user.id} />
                  <input type="hidden" name="method" value="sendLink" />
                  <label className="block text-sm font-medium">Send reset link via email</label>
                  <p className="text-xs text-foreground-muted">
                    Sends password reset email to {modal.user.email}
                  </p>
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting"}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-surface-inset disabled:opacity-50"
                  >
                    Send Reset Email
                  </button>
                </fetcher.Form>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-foreground-muted hover:text-foreground text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {modal.type === "email" && modal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-4">
              Change Email for {modal.user.name || modal.user.email}
            </h3>

            {fetcher.data?.error && (
              <div className="mb-4 bg-danger-muted text-danger p-3 rounded-lg text-sm">
                {fetcher.data.error}
              </div>
            )}

            {fetcher.data?.success && (
              <div className="mb-4 bg-success-muted text-success p-3 rounded-lg text-sm">
                {fetcher.data.message}
              </div>
            )}

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="changeEmail" />
              <input type="hidden" name="userId" value={modal.user.id} />

              <div>
                <label className="block text-sm font-medium mb-1">Current email</label>
                <input
                  type="text"
                  value={modal.user.email}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-surface-inset text-foreground-muted text-sm"
                />
              </div>

              <div>
                <label htmlFor="newEmail" className="block text-sm font-medium mb-1">
                  New email
                </label>
                <input
                  type="email"
                  id="newEmail"
                  name="newEmail"
                  placeholder="new@example.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-foreground-muted hover:text-foreground text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {fetcher.state === "submitting" ? "Updating..." : "Update Email"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
