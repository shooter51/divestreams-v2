import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { useEffect } from "react";
import { db } from "../../../lib/db";
import { subscriptionPlans, subscription, tenants } from "../../../lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { useToast } from "../../../lib/toast-context";

export const meta: MetaFunction = () => [{ title: "Plans - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(desc(subscriptionPlans.monthlyPrice));

  return { plans };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const planId = formData.get("planId") as string;

  if (intent === "toggleActive" && planId) {
    const isActive = formData.get("isActive") === "true";
    await db
      .update(subscriptionPlans)
      .set({ isActive: !isActive, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, planId));
    return { success: true };
  }

  if (intent === "delete" && planId) {
    try {
      // Check if any subscriptions are using this plan
      const [subscriptionCount] = await db
        .select({ count: count() })
        .from(subscription)
        .where(eq(subscription.planId, planId));

      // Also check if any tenants are using this plan (legacy table)
      const [tenantCount] = await db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.planId, planId));

      const totalUsage = (subscriptionCount?.count || 0) + (tenantCount?.count || 0);

      if (totalUsage > 0) {
        return {
          success: false,
          error: `Cannot delete this plan. ${totalUsage} organization(s) are currently using it. Deactivate the plan instead to prevent new subscriptions.`
        };
      }

      // Safe to delete - no subscriptions or tenants using this plan
      await db
        .delete(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId));
      return { success: true, deleted: true };
    } catch (error) {
      console.error("Failed to delete plan:", error);
      // Check if it's a foreign key constraint violation
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("foreign key constraint") || errorMessage.includes("is still referenced")) {
        return {
          success: false,
          error: "Cannot delete this plan. It is still being used by one or more organizations. Deactivate the plan instead."
        };
      }
      return {
        success: false,
        error: "Failed to delete plan. Please try again."
      };
    }
  }

  return null;
}

export default function AdminPlansPage() {
  const { plans } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success: boolean; error?: string; deleted?: boolean }>();
  const { showToast } = useToast();

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.error) {
        showToast(fetcher.data.error, "error");
      } else if (fetcher.data.deleted) {
        showToast("Plan deleted successfully", "success");
      }
    }
  }, [fetcher.data, showToast]);

  const handleToggleActive = (id: string, isActive: boolean) => {
    fetcher.submit(
      { intent: "toggleActive", planId: id, isActive: String(isActive) },
      { method: "post" }
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the "${name}" plan? This cannot be undone.`)) {
      fetcher.submit(
        { intent: "delete", planId: id },
        { method: "post" }
      );
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-foreground-muted">{plans.length} plans</p>
        </div>
        <Link
          to="/plans/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          Add Plan
        </Link>
      </div>

      {/* Table */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Display Name</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">Monthly</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">Yearly</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-foreground-muted">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  No plans found
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className={!plan.isActive ? "opacity-50" : ""}>
                  <td className="px-4 py-3 font-mono text-sm">{plan.name}</td>
                  <td className="px-4 py-3 font-medium">{plan.displayName}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(plan.monthlyPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(plan.yearlyPrice)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        plan.isActive
                          ? "bg-success-muted text-success"
                          : "bg-surface-inset text-foreground-muted"
                      }`}
                    >
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        to={`/plans/${plan.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleToggleActive(plan.id, plan.isActive)}
                        className="text-sm text-foreground-muted hover:underline"
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id, plan.displayName)}
                        className="text-sm text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
