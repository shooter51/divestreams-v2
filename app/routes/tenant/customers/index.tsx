import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { customers } from "../../../../lib/db/schema";
import { eq, or, ilike, sql, count } from "drizzle-orm";
import { UpgradePrompt } from "../../../components/ui/UpgradePrompt";

export const meta: MetaFunction = () => [{ title: "Customers - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build query with organization filter
  const baseCondition = eq(customers.organizationId, ctx.org.id);

  // Add search filter if provided
  const searchCondition = search
    ? or(
        ilike(customers.firstName, `%${search}%`),
        ilike(customers.lastName, `%${search}%`),
        ilike(customers.email, `%${search}%`)
      )
    : undefined;

  // Get customers with pagination
  const customerList = await db
    .select()
    .from(customers)
    .where(searchCondition ? sql`${baseCondition} AND ${searchCondition}` : baseCondition)
    .orderBy(customers.lastName, customers.firstName)
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(customers)
    .where(searchCondition ? sql`${baseCondition} AND ${searchCondition}` : baseCondition);

  return {
    customers: customerList,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    search,
    // Freemium data
    canAddCustomer: ctx.canAddCustomer,
    usage: ctx.usage.customers,
    limit: ctx.limits.customers,
    isPremium: ctx.isPremium,
  };
}

export default function CustomersPage() {
  const {
    customers,
    total,
    page,
    totalPages,
    search,
    canAddCustomer,
    usage,
    limit,
    isPremium
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    setSearchParams(search ? { search } : {});
  };

  // Check if at limit (for free tier)
  const isAtLimit = !isPremium && usage >= limit;

  return (
    <div>
      {/* Show upgrade banner when at limit */}
      {isAtLimit && (
        <div className="mb-6">
          <UpgradePrompt
            feature="customers"
            currentCount={usage}
            limit={limit}
            variant="banner"
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500">
            {total} total customers
            {!isPremium && (
              <span className="ml-2 text-sm text-gray-400">
                ({usage}/{limit} used)
              </span>
            )}
          </p>
        </div>
        <Link
          to="/app/customers/new"
          className={`px-4 py-2 rounded-lg ${
            canAddCustomer
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canAddCustomer) {
              e.preventDefault();
            }
          }}
          aria-disabled={!canAddCustomer}
        >
          Add Customer
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by name or email..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Search
          </button>
        </div>
      </form>

      {/* Customer List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Contact</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Certification</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Dives</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Total Spent</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Last Dive</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {search ? "No customers found matching your search." : "No customers yet. Add your first customer to get started."}
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/app/customers/${customer.id}`} className="font-medium text-blue-600 hover:underline">
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{customer.email}</div>
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    {customer.certifications?.[0] ? (
                      <span className="text-sm">
                        {customer.certifications[0].agency} {customer.certifications[0].level}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{customer.totalDives}</td>
                  <td className="px-6 py-4 text-sm">${Number(customer.totalSpent || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {customer.lastDiveAt
                      ? new Date(customer.lastDiveAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/customers/${customer.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}
                disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}
                disabled={page >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
