import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { member, bookings, subscriptionPlans } from "../../../../lib/db/schema";
import { eq, sql, count, gte, and, asc } from "drizzle-orm";
import {
  createCheckoutSession,
  cancelSubscription,
  createBillingPortalSession,
  getPaymentMethod,
} from "../../../../lib/stripe";
import {
  getInvoiceHistory,
  fetchInvoicesFromStripe,
} from "../../../../lib/stripe/stripe-billing.server";
import { FEATURE_LABELS, type PlanFeaturesObject } from "../../../../lib/plan-features";

export const meta: MetaFunction = () => [{ title: "Billing - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Fetch subscription plans from database
  const dbPlans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.monthlyPrice));

  // Helper function to extract display features from plan features object
  const getDisplayFeatures = (features: unknown): string[] => {
    if (!features) return [];

    // If it's already an array (legacy format), return it
    if (Array.isArray(features)) {
      return features as string[];
    }

    // If it's a features object, extract descriptions or generate from enabled flags
    const featuresObj = features as PlanFeaturesObject;

    // If descriptions array exists, use it
    if (featuresObj.descriptions && Array.isArray(featuresObj.descriptions)) {
      return featuresObj.descriptions;
    }

    // Otherwise, generate descriptions from enabled feature flags
    const enabledFeatures: string[] = [];
    for (const [key, value] of Object.entries(featuresObj)) {
      if (value === true && key in FEATURE_LABELS) {
        enabledFeatures.push(FEATURE_LABELS[key as keyof typeof FEATURE_LABELS]);
      }
    }
    return enabledFeatures;
  };

  // Map database plans to billing page format
  const finalPlans = dbPlans.length > 0 ? dbPlans.map((plan, index) => ({
    id: plan.name, // Plan name (e.g., "free", "professional", "enterprise")
    name: plan.displayName, // Display name for UI
    price: plan.monthlyPrice / 100, // cents to dollars
    yearlyPrice: plan.yearlyPrice / 100,
    features: getDisplayFeatures(plan.features),
    limits: {
      bookings: (plan.limits as { toursPerMonth?: number })?.toursPerMonth ?? -1,
      team: (plan.limits as { users?: number })?.users ?? -1
    },
    popular: index === 1, // Second plan (usually pro) is popular
    isFree: plan.monthlyPrice === 0,
  })) : [
    // Fallback if no plans in database
    {
      id: "free",
      name: "Free",
      price: 0,
      yearlyPrice: 0,
      features: ["Up to 25 tours/month", "50 customers", "1 team member", "Basic features"],
      limits: { bookings: 25, team: 1 },
      isFree: true,
    },
    {
      id: "professional",
      name: "Professional",
      price: 49,
      yearlyPrice: 470,
      features: ["Unlimited tours", "Unlimited customers", "10 team members", "Advanced reporting", "POS system", "API access"],
      limits: { bookings: -1, team: 10 },
      popular: true,
      isFree: false,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 199,
      yearlyPrice: 1910,
      features: ["Everything in Pro", "Unlimited team members", "Custom integrations", "Dedicated support", "White-label options"],
      limits: { bookings: -1, team: -1 },
      isFree: false,
    },
  ];

  // Get usage data from org context
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [bookingsCountResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.organizationId, ctx.org.id),
        gte(bookings.createdAt, startOfMonth)
      )
    );

  const [teamCountResult] = await db
    .select({ count: count() })
    .from(member)
    .where(eq(member.organizationId, ctx.org.id));

  const bookingsThisMonth = bookingsCountResult?.count || 0;
  const teamMemberCount = teamCountResult?.count || 1;

  // Calculate next billing date
  const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Get plan price based on subscription
  // subscription.plan stores the plan name (e.g., "free", "professional", "enterprise")
  const subscriptionPlanName = ctx.subscription?.plan || "free";

  // Find the matching plan from database
  // Try exact match first, then fall back to free plan logic
  let currentPlanData = finalPlans.find(p => p.id === subscriptionPlanName);

  // If no exact match and subscription is "free" or "premium" (legacy values),
  // map to appropriate plan
  if (!currentPlanData) {
    if (subscriptionPlanName === "free" || subscriptionPlanName === "premium") {
      // "free" -> first free plan, "premium" -> first paid plan
      currentPlanData = subscriptionPlanName === "free"
        ? finalPlans.find(p => p.isFree) || finalPlans[0]
        : finalPlans.find(p => !p.isFree) || finalPlans[1] || finalPlans[0];
    } else {
      // Fallback to first plan
      currentPlanData = finalPlans[0];
    }
  }

  const currentPlan = currentPlanData?.id || "free";

  // Parse metadata if it exists
  let metadata: { stripeCustomerId?: string } = {};
  if (ctx.org.metadata) {
    try {
      metadata = JSON.parse(ctx.org.metadata) as { stripeCustomerId?: string };
    } catch (error) {
      console.error("Failed to parse organization metadata:", error);
      // Fallback to empty object on parse error
      metadata = {};
    }
  }

  // Type definitions for billing UI data
  type PaymentMethod = {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };

  type BillingHistoryItem = {
    id: string;
    date: string;
    description: string;
    status: string;
    amount: number;
    invoiceUrl: string;
  };

  // Fetch payment method from Stripe
  let paymentMethod: PaymentMethod | null = null;
  try {
    const stripePaymentMethod = await getPaymentMethod(ctx.org.id);
    if (stripePaymentMethod) {
      paymentMethod = {
        brand: stripePaymentMethod.brand,
        last4: stripePaymentMethod.last4,
        expiryMonth: stripePaymentMethod.expiryMonth,
        expiryYear: stripePaymentMethod.expiryYear,
      };
    }
  } catch (error) {
    console.error("Error fetching payment method:", error);
  }

  // Fetch invoice history
  let billingHistory: BillingHistoryItem[] = [];
  try {
    // First, sync latest invoices from Stripe
    await fetchInvoicesFromStripe(ctx.org.id, 10);

    // Then fetch from database
    const invoices = await getInvoiceHistory(ctx.org.id, 10);
    billingHistory = invoices.map((invoice) => ({
      id: invoice.stripeInvoiceId,
      date: invoice.createdAt.toLocaleDateString(),
      description: invoice.description || `Invoice ${invoice.invoiceNumber || invoice.stripeInvoiceId.slice(-8)}`,
      status: invoice.paid ? "paid" : invoice.status === "open" ? "pending" : invoice.status,
      amount: invoice.total / 100, // Convert cents to dollars
      invoiceUrl: invoice.invoicePdf || invoice.hostedInvoiceUrl || "#",
    }));
  } catch (error) {
    console.error("Error fetching invoice history:", error);
  }

  // Calculate trial days left on the server to avoid hydration mismatch
  const trialEndsAt = ctx.subscription?.trialEndsAt;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const billing = {
    currentPlan,
    currentPlanName: currentPlanData?.name || "Free",
    billingCycle: "monthly" as const,
    nextBillingDate,
    amount: currentPlanData?.price || 0,
    subscriptionStatus: ctx.subscription?.status || "active",
    trialEndsAt: trialEndsAt?.toISOString(),
    trialDaysLeft,
    paymentMethod,
    billingHistory,
    usage: {
      bookingsThisMonth,
      bookingsLimit: ctx.limits.bookingsPerMonth,
      teamMembers: teamMemberCount,
      teamLimit: ctx.limits.teamMembers,
    },
    hasStripeCustomer: !!metadata.stripeCustomerId,
  };

  return { billing, plans: finalPlans, isPremium: ctx.isPremium };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Note: Stripe helper functions still use organization ID (they will be updated separately)
  const orgId = ctx.org.id;

  if (intent === "upgrade") {
    const planId = formData.get("planId") as string;
    const billingPeriod = (formData.get("billingPeriod") as "monthly" | "yearly") || "monthly";

    // Map planId to plan name for Stripe
    const planName = planId as "starter" | "pro" | "enterprise";

    try {
      const sessionUrl = await createCheckoutSession(
        orgId,
        planName,
        billingPeriod,
        `${baseUrl}/tenant/settings/billing?success=true`,
        `${baseUrl}/tenant/settings/billing?canceled=true`
      );

      if (sessionUrl) {
        return redirect(sessionUrl);
      }
      return { error: "Failed to create checkout session" };
    } catch (error) {
      console.error("Checkout session error:", error);
      return { error: error instanceof Error ? error.message : "Failed to create checkout session" };
    }
  }

  if (intent === "cancel") {
    try {
      const success = await cancelSubscription(orgId);
      if (success) {
        return { cancelled: true, message: "Subscription cancelled successfully" };
      }
      return { error: "Failed to cancel subscription" };
    } catch (error) {
      console.error("Cancel subscription error:", error);
      return { error: error instanceof Error ? error.message : "Failed to cancel subscription" };
    }
  }

  if (intent === "update-payment") {
    try {
      const sessionUrl = await createBillingPortalSession(
        orgId,
        `${baseUrl}/tenant/settings/billing`
      );

      if (sessionUrl) {
        return redirect(sessionUrl);
      }
      return { error: "Failed to open billing portal. Please ensure you have an active subscription." };
    } catch (error) {
      console.error("Billing portal error:", error);
      return { error: error instanceof Error ? error.message : "Failed to open billing portal" };
    }
  }

  return null;
}

export default function BillingPage() {
  const { billing, plans } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string; cancelled?: boolean; message?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");

  // Find current plan data for features display
  const currentPlanData = plans.find((p) => p.id === billing.currentPlan);
  const isTrialing = billing.subscriptionStatus === "trialing";
  // Use pre-calculated trialDaysLeft from loader to avoid hydration mismatch
  const trialDaysLeft = billing.trialDaysLeft;

  const usagePercent = billing.usage.bookingsLimit > 0
    ? Math.round((billing.usage.bookingsThisMonth / billing.usage.bookingsLimit) * 100)
    : 0;

  const isSubmitting = fetcher.state !== "idle";

  // Handle URL params from Stripe redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setNotification({
        type: "info",
        message: "Payment successful! Your subscription is being updated. This may take a few moments. Please refresh the page in 30 seconds.",
      });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("payment_added") === "true") {
      setNotification({
        type: "success",
        message: "Payment method added successfully!",
      });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("canceled") === "true") {
      setNotification({
        type: "info",
        message: "Checkout was canceled. No changes were made.",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.error) {
        setNotification({ type: "error", message: fetcher.data.error });
      } else if (fetcher.data.cancelled && fetcher.data.message) {
        setNotification({ type: "success", message: fetcher.data.message });
      }
    }
  }, [fetcher.data]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Billing & Subscription</h1>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            notification.type === "success"
              ? "bg-success-muted border border-success-muted text-success"
              : notification.type === "error"
              ? "bg-danger-muted border border-danger-muted text-danger"
              : "bg-brand-muted border border-brand-muted text-brand"
          }`}
        >
          <p>{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Trial Banner */}
      {isTrialing && trialDaysLeft > 0 && (
        <div className="bg-brand-muted border border-brand-muted text-brand px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Free Trial Active</p>
          <p className="text-sm">
            You have {trialDaysLeft} days left in your trial. Add a payment method to
            continue after the trial ends.
          </p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-semibold mb-1">Current Plan</h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{billing.currentPlanName}</span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  billing.subscriptionStatus === "active"
                    ? "bg-success-muted text-success"
                    : billing.subscriptionStatus === "trialing"
                    ? "bg-brand-muted text-brand"
                    : "bg-warning-muted text-warning"
                }`}
              >
                {billing.subscriptionStatus}
              </span>
            </div>
            <p className="text-foreground-muted mt-1">
              ${billing.amount}/{billing.billingCycle === "monthly" ? "month" : "year"}
              {!isTrialing && ` • Next billing: ${billing.nextBillingDate}`}
            </p>
          </div>
          <div className="flex gap-2">
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-payment" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Loading..." : "Manage Payment"}
              </button>
            </fetcher.Form>
          </div>
        </div>

        {/* Usage */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-medium mb-3">Usage This Month</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground-muted">Bookings</span>
                <span>
                  {billing.usage.bookingsThisMonth} / {billing.usage.bookingsLimit}
                </span>
              </div>
              <div className="w-full bg-surface-overlay rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usagePercent > 90
                      ? "bg-danger"
                      : usagePercent > 70
                      ? "bg-warning"
                      : "bg-success"
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              {usagePercent > 80 && (
                <p className="text-xs text-warning mt-1">
                  Approaching limit - consider upgrading
                </p>
              )}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground-muted">Team Members</span>
                <span>
                  {billing.usage.teamMembers} / {billing.usage.teamLimit}
                </span>
              </div>
              <div className="w-full bg-surface-overlay rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-brand"
                  style={{
                    width: `${
                      (billing.usage.teamMembers / billing.usage.teamLimit) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Available Plans</h2>

          {/* Billing Period Toggle */}
          <div className="flex items-center gap-2 bg-surface-inset rounded-lg p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === "monthly"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === "yearly"
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-1.5 text-xs text-success font-semibold">
                Save {plans[1] ? Math.round(((plans[1].price * 12 - plans[1].yearlyPrice) / (plans[1].price * 12)) * 100) : 20}%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === billing.currentPlan;
            return (
              <div
                key={plan.id}
                className={`bg-surface-raised rounded-xl p-6 shadow-sm relative ${
                  plan.popular ? "ring-2 ring-brand" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  {billingPeriod === "monthly" ? (
                    <>
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-foreground-muted">/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${plan.yearlyPrice}</span>
                      <span className="text-foreground-muted">/year</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-foreground-muted mt-1">
                  {billingPeriod === "monthly" ? (
                    <>
                      ${plan.yearlyPrice}/year saves{" "}
                      {Math.round(((plan.price * 12 - plan.yearlyPrice) / (plan.price * 12)) * 100)}%
                    </>
                  ) : (
                    <>
                      ${(plan.yearlyPrice / 12).toFixed(2)}/month billed annually
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 border border-border rounded-lg text-foreground-muted cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="upgrade" />
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="billingPeriod" value={billingPeriod} />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                          plan.popular
                            ? "bg-brand text-white hover:bg-brand-hover"
                            : "border border-border hover:bg-surface-inset"
                        }`}
                      >
                        {isSubmitting
                          ? "Processing..."
                          : plans.findIndex((p) => p.id === plan.id) >
                            plans.findIndex((p) => p.id === billing.currentPlan)
                          ? "Upgrade"
                          : "Switch"}
                      </button>
                    </fetcher.Form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Payment Method</h2>
        {billing.paymentMethod ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 bg-surface-overlay rounded flex items-center justify-center text-sm font-medium">
                {billing.paymentMethod.brand}
              </div>
              <div>
                <p className="font-medium">
                  •••• •••• •••• {billing.paymentMethod.last4}
                </p>
                <p className="text-sm text-foreground-muted">
                  Expires {billing.paymentMethod.expiryMonth}/
                  {billing.paymentMethod.expiryYear}
                </p>
              </div>
            </div>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-payment" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-brand hover:underline text-sm disabled:opacity-50"
              >
                {isSubmitting ? "Loading..." : "Update"}
              </button>
            </fetcher.Form>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-foreground-muted mb-3">No payment method on file</p>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-payment" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Loading..." : "Add Payment Method"}
              </button>
            </fetcher.Form>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Billing History</h2>
        {billing.billingHistory.length === 0 ? (
          <p className="text-foreground-muted text-center py-4">No billing history yet</p>
        ) : (
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-sm font-medium text-foreground-muted">Date</th>
                <th className="text-left py-2 text-sm font-medium text-foreground-muted">
                  Description
                </th>
                <th className="text-left py-2 text-sm font-medium text-foreground-muted">Status</th>
                <th className="text-right py-2 text-sm font-medium text-foreground-muted">Amount</th>
                <th className="text-right py-2 text-sm font-medium text-foreground-muted"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {billing.billingHistory.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="py-3 text-sm">{invoice.date}</td>
                  <td className="py-3 text-sm">{invoice.description}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === "paid"
                          ? "bg-success-muted text-success"
                          : "bg-warning-muted text-warning"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-right">${invoice.amount}</td>
                  <td className="py-3 text-right">
                    <a
                      href={invoice.invoiceUrl}
                      className="text-brand hover:underline text-sm"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancel Subscription */}
      {billing.subscriptionStatus !== "canceled" && (
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm border border-danger-muted">
          <h2 className="font-semibold mb-2">Cancel Subscription</h2>
          <p className="text-foreground-muted text-sm mb-4">
            If you cancel, you will retain access until the end of your billing period.
            Your data will be retained for 30 days after that.
          </p>
          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Are you sure you want to cancel your subscription?")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="cancel" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-danger border border-danger-muted px-4 py-2 rounded-lg hover:bg-danger-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing..." : "Cancel Subscription"}
            </button>
          </fetcher.Form>
        </div>
      )}

      {/* Canceled Notice */}
      {billing.subscriptionStatus === "canceled" && (
        <div className="bg-warning-muted border border-warning-muted rounded-xl p-6">
          <h2 className="font-semibold mb-2 text-warning">Subscription Canceled</h2>
          <p className="text-warning text-sm mb-4">
            Your subscription has been canceled. You will retain access until{" "}
            {billing.nextBillingDate}. After that, your account will be deactivated.
          </p>
          <p className="text-warning text-sm">
            To reactivate your subscription, please select a plan above.
          </p>
        </div>
      )}
    </div>
  );
}
