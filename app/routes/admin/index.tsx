import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, useSearchParams } from "react-router";
import { db } from "../../../lib/db";
import { tenants, subscriptionPlans } from "../../../lib/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";
import { deleteTenant } from "../../../lib/db/tenant.server";

export const meta: MetaFunction = () => [{ title: "Tenants - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  let query = db
    .select({
      id: tenants.id,
      subdomain: tenants.subdomain,
      name: tenants.name,
      email: tenants.email,
      subscriptionStatus: tenants.subscriptionStatus,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      trialEndsAt: tenants.trialEndsAt,
      planId: tenants.planId,
      planName: subscriptionPlans.displayName,
    })
    .from(tenants)
    .leftJoin(subscriptionPlans, eq(tenants.planId, subscriptionPlans.id))
    .orderBy(desc(tenants.createdAt));

  if (search) {
    query = query.where(
      or(
        ilike(tenants.subdomain, `%${search}%`),
        ilike(tenants.name, `%${search}%`),
        ilike(tenants.email, `%${search}%`)
      )
    ) as typeof query;
  }

  const allTenants = await query;

  return {
    tenants: allTenants.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString().split("T")[0],
      trialEndsAt: t.trialEndsAt?.toISOString().split("T")[0] || null,
    })),
    search,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const tenantId = formData.get("tenantId") as string;

  if (intent === "delete" && tenantId) {
    await deleteTenant(tenantId);
    return { success: true };
  }

  if (intent === "toggleActive" && tenantId) {
    const isActive = formData.get("isActive") === "true";
    await db
      .update(tenants)
      .set({ isActive: !isActive, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    return { success: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past_due: "bg-yellow-100 text-yellow-700",
  canceled: "bg-red-100 text-red-700",
};

export default function AdminTenantsPage() {
  const { tenants: tenantList, search } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    const params = new URLSearchParams(searchParams);
    if (q) params.set("q", q);
    else params.delete("q");
    setSearchParams(params);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This will remove all their data and cannot be undone.`)) {
      fetcher.submit({ intent: "delete", tenantId: id }, { method: "post" });
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    fetcher.submit(
      { intent: "toggleActive", tenantId: id, isActive: String(isActive) },
      { method: "post" }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-gray-600">{tenantList.length} total</p>
        </div>
        <Link
          to="/tenants/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Tenant
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="search"
          name="q"
          placeholder="Search by subdomain, name, or email..."
          defaultValue={search}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Subdomain</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Plan</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Created</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenantList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No tenants found
                </td>
              </tr>
            ) : (
              tenantList.map((tenant) => (
                <tr key={tenant.id} className={!tenant.isActive ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <a
                      href={`https://${tenant.subdomain}.divestreams.com/app`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {tenant.subdomain}
                    </a>
                  </td>
                  <td className="px-4 py-3">{tenant.name}</td>
                  <td className="px-4 py-3 text-gray-700">{tenant.email}</td>
                  <td className="px-4 py-3">{tenant.planName || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[tenant.subscriptionStatus] || "bg-gray-100"
                      }`}
                    >
                      {tenant.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{tenant.createdAt}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/tenants/${tenant.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleToggleActive(tenant.id, tenant.isActive)}
                        className="text-sm text-gray-600 hover:underline"
                      >
                        {tenant.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(tenant.id, tenant.name)}
                        className="text-sm text-red-600 hover:underline"
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
