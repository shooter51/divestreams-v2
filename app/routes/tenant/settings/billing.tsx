import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useFetcher, Link, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import {
  getSubscriptionPlanById,
  getAllSubscriptionPlans,
  getBillingHistory,
  getMonthlyBookingCount,
  getTeamMemberCount,
} from "../../../../lib/db/queries.server";
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  getPaymentMethod,
} from "../../../../lib/stripe/index";

export const meta: MetaFunction = () => [{ title: "Billing - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);

  // Get all subscription plans from database
  const dbPlans = await getAllSubscriptionPlans();

  // Transform database plans to the format expected by the component
  const plans = dbPlans.map((plan) => {
    const limits = plan.limits as { users?: number; toursPerMonth?: number } | null;
    return {
      id: plan.name,
      name: plan.displayName,
      price: plan.monthlyPrice / 100, // Convert from cents
      yearlyPrice: plan.yearlyPrice / 100, // Convert from cents
      features: Array.isArray(plan.features) ? plan.features : [],
      limits: {
        bookings: limits?.toursPerMonth ?? 100,
        team: limits?.users ?? 2,
      },
      popular: plan.name === "professional",
    };
  });

  // If no plans in database, use defaults
  const finalPlans = plans.length > 0 ? plans : [
    {
      id: "starter",
      name: "Starter",
      price: 49,
      yearlyPrice: 470,
      features: ["Up to 100 bookings/month", "2 team members", "Basic reporting", "Email support"],
      limits: { bookings: 100, team: 2 },
    },
    {
      id: "professional",
      name: "Professional",
      price: 99,
      yearlyPrice: 950,
      features: ["Up to 500 bookings/month", "10 team members", "Advanced reporting", "Priority support", "Custom booking widget", "API access"],
      limits: { bookings: 500, team: 10 },
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 199,
      yearlyPrice: 1910,
      features: ["Unlimited bookings", "Unlimited team members", "Custom integrations", "Dedicated support", "White-label options", "Multi-location support"],
      limits: { bookings: -1, team: -1 },
    },
  ];

  // Get current plan details
  let currentPlanName = "starter";
  let currentPlanLimits = { bookings: 100, team: 2 };
  let monthlyPrice = 49;

  if (tenant.planId) {
    const currentPlan = await getSubscriptionPlanById(tenant.planId);
    if (currentPlan) {
      currentPlanName = currentPlan.name;
      monthlyPrice = currentPlan.monthlyPrice / 100;
      const limits = currentPlan.limits as { users?: number; toursPerMonth?: number } | null;
      currentPlanLimits = {
        bookings: limits?.toursPerMonth ?? 100,
        team: limits?.users ?? 2,
      };
    }
  }

  // Get real usage data
  const bookingsThisMonth = await getMonthlyBookingCount(tenant.schemaName);
  const teamMemberCount = await getTeamMemberCount(tenant.schemaName);

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Get billing history from transactions and format dates
  const rawBillingHistory = await getBillingHistory(tenant.schemaName, 10);
  const billingHistory = rawBillingHistory.map((invoice) => ({
    ...invoice,
    date: formatDate(invoice.date),
  }));

  // Calculate next billing date (assumes monthly billing from current period end)
  const nextBillingDate = tenant.currentPeriodEnd
    ? new Date(tenant.currentPeriodEnd).toISOString().split("T")[0]
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Get real payment method from Stripe
  const paymentMethod = await getPaymentMethod(tenant.id);

  const billing = {
    currentPlan: currentPlanName,
    billingCycle: "monthly" as const,
    nextBillingDate,
    amount: monthlyPrice,
    subscriptionStatus: tenant.subscriptionStatus || "active",
    trialEndsAt: tenant.trialEndsAt?.toISOString(),
    paymentMethod,
    billingHistory,
    usage: {
      bookingsThisMonth,
      bookingsLimit: currentPlanLimits.bookings,
      teamMembers: teamMemberCount,
      teamLimit: currentPlanLimits.team,
    },
    hasStripeCustomer: !!tenant.stripeCustomerId,
  };

  return { billing, plans: finalPlans };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  if (intent === "upgrade") {
    const planId = formData.get("planId") as string;
    const billingPeriod = (formData.get("billingPeriod") as "monthly" | "yearly") || "monthly";

    // Map planId to plan name (in case they differ)
    const planName = planId as "starter" | "pro" | "enterprise";

    try {
      const checkoutUrl = await createCheckoutSession(
        tenant.id,
        planName,
        billingPeriod,
        `${baseUrl}/app/settings/billing?success=true`,
        `${baseUrl}/app/settings/billing?canceled=true`
      );

      if (checkoutUrl) {
        return redirect(checkoutUrl);
      }

      return { error: "Could not create checkout session. Stripe may not be configured." };
    } catch (error) {
      console.error("Checkout error:", error);
      return { error: "Failed to create checkout session" };
    }
  }

  if (intent === "cancel") {
    try {
      await cancelSubscription(tenant.id);
      return { cancelled: true, message: "Subscription cancelled. You will retain access until the end of your billing period." };
    } catch (error) {
      console.error("Cancel error:", error);
      return { error: "Failed to cancel subscription" };
    }
  }

  if (intent === "update-payment") {
    try {
      const portalUrl = await createBillingPortalSession(
        tenant.id,
        `${baseUrl}/app/settings/billing`
      );

      if (portalUrl) {
        return redirect(portalUrl);
      }

      return { error: "Could not open billing portal. Please add a payment method first." };
    } catch (error) {
      console.error("Portal error:", error);
      return { error: "Failed to open billing portal" };
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
              <input type="hidden" name="intent" value="update-payment" />
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
