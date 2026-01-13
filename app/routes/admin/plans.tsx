import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { db } from "../../../lib/db";
import { subscriptionPlans } from "../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

  return null;
}

export default function AdminPlansPage() {
  const { plans } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleToggleActive = (id: string, isActive: boolean) => {
    fetcher.submit(
      { intent: "toggleActive", planId: id, isActive: String(isActive) },
      { method: "post" }
    );
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
          <p className="text-gray-600">{plans.length} plans</p>
        </div>
        <Link
          to="/plans/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Plan
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Display Name</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Monthly</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Yearly</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
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
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/plans/${plan.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleToggleActive(plan.id, plan.isActive)}
                        className="text-sm text-gray-600 hover:underline"
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
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
