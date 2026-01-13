import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { member, bookings } from "../../../../lib/db/schema";
import { eq, sql, count, gte, and } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Billing - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Define subscription plans (static for now, could move to database)
  const finalPlans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      yearlyPrice: 0,
      features: ["Up to 25 tours/month", "50 customers", "1 team member", "Basic features"],
      limits: { bookings: 25, team: 1 },
    },
    {
      id: "professional",
      name: "Professional",
      price: 49,
      yearlyPrice: 470,
      features: ["Unlimited tours", "Unlimited customers", "10 team members", "Advanced reporting", "POS system", "API access"],
      limits: { bookings: -1, team: 10 },
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 99,
      yearlyPrice: 950,
      features: ["Everything in Pro", "Unlimited team members", "Custom integrations", "Dedicated support", "White-label options"],
      limits: { bookings: -1, team: -1 },
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
  const currentPlan = ctx.subscription?.plan || "free";
  const currentPlanData = finalPlans.find(p => p.id === currentPlan) || finalPlans[0];

  // Parse metadata if it exists
  const metadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

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

  const billing = {
    currentPlan,
    billingCycle: "monthly" as const,
    nextBillingDate,
    amount: currentPlanData.price,
    subscriptionStatus: ctx.subscription?.status || "active",
    trialEndsAt: undefined as string | undefined,
    paymentMethod: null as PaymentMethod | null, // Would need Stripe integration
    billingHistory: [] as BillingHistoryItem[], // Would need billing history table
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

    // Map planId to plan name (in case they differ)
    const planName = planId as "starter" | "pro" | "enterprise";

    // For now, return a message that Stripe integration is being updated
    // TODO: Update Stripe helper functions to work with organization table
    return { error: "Stripe integration is being updated. Please contact support to upgrade your plan." };
  }

  if (intent === "cancel") {
    // For now, return a message that Stripe integration is being updated
    // TODO: Update Stripe helper functions to work with organization table
    return { error: "Stripe integration is being updated. Please contact support to cancel your subscription." };
  }

  if (intent === "update-payment") {
    // For now, return a message that Stripe integration is being updated
    // TODO: Update Stripe helper functions to work with organization table
    return { error: "Stripe integration is being updated. Please contact support to update your payment method." };
  }

  if (intent === "add-payment") {
    // For now, return a message that Stripe integration is being updated
    // TODO: Update Stripe helper functions to work with organization table
    return { error: "Stripe integration is being updated. Please contact support to add a payment method." };
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

  const currentPlanData = plans.find((p) => p.id === billing.currentPlan);
  const isTrialing = billing.subscriptionStatus === "trialing";
  const trialDaysLeft = billing.trialEndsAt
    ? Math.ceil(
        (new Date(billing.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const usagePercent = billing.usage.bookingsLimit > 0
    ? Math.round((billing.usage.bookingsThisMonth / billing.usage.bookingsLimit) * 100)
    : 0;

  const isSubmitting = fetcher.state !== "idle";

  // Handle URL params from Stripe redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setNotification({
        type: "success",
        message: "Payment successful! Your subscription has been updated.",
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
        <Link to="/app/settings" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Billing & Subscription</h1>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`px-4 py-3 rounded-lg mb-6 flex justify-between items-center ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : notification.type === "error"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-blue-50 border border-blue-200 text-blue-700"
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
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Free Trial Active</p>
          <p className="text-sm">
            You have {trialDaysLeft} days left in your trial. Add a payment method to
            continue after the trial ends.
          </p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-semibold mb-1">Current Plan</h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{currentPlanData?.name}</span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  billing.subscriptionStatus === "active"
                    ? "bg-green-100 text-green-700"
                    : billing.subscriptionStatus === "trialing"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {billing.subscriptionStatus}
              </span>
            </div>
            <p className="text-gray-500 mt-1">
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
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-gray-500">Bookings</span>
                <span>
                  {billing.usage.bookingsThisMonth} / {billing.usage.bookingsLimit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usagePercent > 90
                      ? "bg-red-500"
                      : usagePercent > 70
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              {usagePercent > 80 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Approaching limit - consider upgrading
                </p>
              )}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Team Members</span>
                <span>
                  {billing.usage.teamMembers} / {billing.usage.teamLimit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
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
        <h2 className="font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === billing.currentPlan;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-6 shadow-sm relative ${
                  plan.popular ? "ring-2 ring-blue-500" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  or ${plan.yearlyPrice}/year (save{" "}
                  {Math.round(((plan.price * 12 - plan.yearlyPrice) / (plan.price * 12)) * 100)}
                  %)
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="upgrade" />
                      <input type="hidden" name="planId" value={plan.id} />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                          plan.popular
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "border border-gray-300 hover:bg-gray-50"
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
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Payment Method</h2>
        {billing.paymentMethod ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center text-sm font-medium">
                {billing.paymentMethod.brand}
              </div>
              <div>
                <p className="font-medium">
                  •••• •••• •••• {billing.paymentMethod.last4}
                </p>
                <p className="text-sm text-gray-500">
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
                className="text-blue-600 hover:underline text-sm disabled:opacity-50"
              >
                {isSubmitting ? "Loading..." : "Update"}
              </button>
            </fetcher.Form>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-3">No payment method on file</p>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="add-payment" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Loading..." : "Add Payment Method"}
              </button>
            </fetcher.Form>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Billing History</h2>
        {billing.billingHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No billing history yet</p>
        ) : (
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">
                  Description
                </th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500"></th>
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
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-right">${invoice.amount}</td>
                  <td className="py-3 text-right">
                    <a
                      href={invoice.invoiceUrl}
                      className="text-blue-600 hover:underline text-sm"
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
        <div className="bg-white rounded-xl p-6 shadow-sm border border-red-100">
          <h2 className="font-semibold mb-2">Cancel Subscription</h2>
          <p className="text-gray-500 text-sm mb-4">
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
              className="text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing..." : "Cancel Subscription"}
            </button>
          </fetcher.Form>
        </div>
      )}

      {/* Canceled Notice */}
      {billing.subscriptionStatus === "canceled" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h2 className="font-semibold mb-2 text-yellow-800">Subscription Canceled</h2>
          <p className="text-yellow-700 text-sm mb-4">
            Your subscription has been canceled. You will retain access until{" "}
            {billing.nextBillingDate}. After that, your account will be deactivated.
          </p>
          <p className="text-yellow-700 text-sm">
            To reactivate your subscription, please select a plan above.
          </p>
        </div>
      )}
    </div>
  );
}
