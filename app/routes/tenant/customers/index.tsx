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
    .where(searchCondition ? sql`${baseCondition} AND (${searchCondition})` : baseCondition)
    .orderBy(customers.lastName, customers.firstName)
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(customers)
    .where(searchCondition ? sql`${baseCondition} AND (${searchCondition})` : baseCondition);

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
          <p className="text-foreground-muted">
            {total} total customers
            {!isPremium && (
              <span className="ml-2 text-sm text-foreground-subtle">
                ({usage}/{limit} used)
              </span>
            )}
          </p>
        </div>
        <Link
          to="/tenant/customers/new"
          className={`px-4 py-2 rounded-lg ${
            canAddCustomer
              ? "bg-brand text-white hover:bg-brand-hover"
              : "bg-border-strong text-foreground-muted cursor-not-allowed"
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
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
          >
            Search
          </button>
        </div>
      </form>

      {/* Customer List */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Contact</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Certification</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Dives</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Total Spent</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Last Dive</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-foreground-muted">
                  {search ? "No customers found matching your search." : "No customers yet. Add your first customer to get started."}
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <Link to={`/tenant/customers/${customer.id}`} className="font-medium text-brand hover:underline">
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{customer.email}</div>
                    <div className="text-sm text-foreground-muted">{customer.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    {customer.certifications?.[0] ? (
                      <span className="text-sm">
                        {customer.certifications[0].agency} {customer.certifications[0].level}
                      </span>
                    ) : (
                      <span className="text-sm text-foreground-subtle">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{customer.totalDives}</td>
                  <td className="px-6 py-4 text-sm">${Number(customer.totalSpent || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-foreground-muted">
                    {customer.lastDiveAt
                      ? new Date(customer.lastDiveAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/tenant/customers/${customer.id}`}
                      className="text-brand hover:underline text-sm"
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
            <span className="text-sm text-foreground-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}
                disabled={page <= 1}
                className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-overlay disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-overlay disabled:opacity-50"
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
