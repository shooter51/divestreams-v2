import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, useSearchParams } from "react-router";
import { db } from "../../../lib/db";
import { organization, member } from "../../../lib/db/schema/auth";
import { subscription } from "../../../lib/db/schema/subscription";
import { eq, ilike, or, desc, sql, count, ne } from "drizzle-orm";
import { requirePlatformContext, PLATFORM_ORG_SLUG } from "../../../lib/auth/platform-context.server";
import { getTenantUrl, getBaseDomain } from "../../../lib/utils/url";

export const meta: MetaFunction = () => [{ title: "Organizations - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  try {
    // Get all organizations except the platform org
    const baseQuery = db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .where(ne(organization.slug, PLATFORM_ORG_SLUG))
      .orderBy(desc(organization.createdAt));

    // Apply search filter if provided
    let orgs;
    if (search) {
      orgs = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          createdAt: organization.createdAt,
        })
        .from(organization)
        .where(
          sql`${ne(organization.slug, PLATFORM_ORG_SLUG)} AND (
            ${ilike(organization.slug, `%${search}%`)} OR
            ${ilike(organization.name, `%${search}%`)}
          )`
        )
        .orderBy(desc(organization.createdAt));
    } else {
      orgs = await baseQuery;
    }

    // Get member counts and subscription info for each organization
    const orgsWithDetails = await Promise.all(
      orgs.map(async (org) => {
        // Get member count
        const [memberCount] = await db
          .select({ count: count() })
          .from(member)
          .where(eq(member.organizationId, org.id));

        // Get owner email
        const [owner] = await db
          .select({
            email: sql<string>`(SELECT email FROM "user" WHERE id = ${member.userId})`,
          })
          .from(member)
          .where(
            sql`${eq(member.organizationId, org.id)} AND ${eq(member.role, "owner")}`
          )
          .limit(1);

        // Get subscription status
        const [sub] = await db
          .select()
          .from(subscription)
          .where(eq(subscription.organizationId, org.id))
          .limit(1);

        return {
          ...org,
          createdAt: org.createdAt.toISOString().split("T")[0],
          memberCount: memberCount?.count || 0,
          ownerEmail: owner?.email || "—",
          subscriptionStatus: sub?.status || "free",
          subscriptionPlan: sub?.plan || "free",
          // Pre-compute tenant URL server-side where process.env.APP_URL is available
          tenantUrl: getTenantUrl(org.slug, "/tenant"),
        };
      })
    );

    return {
      organizations: orgsWithDetails,
      search,
      error: null,
    };
  } catch (error) {
    console.error("Failed to fetch organizations from database:", error);
    return {
      organizations: [],
      search,
      error: "Failed to load organizations. Please check the database connection.",
    };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const orgId = formData.get("orgId") as string;

  if (intent === "delete" && orgId) {
    // Delete the organization (cascades to members, subscriptions via FK)
    await db.delete(organization).where(eq(organization.id, orgId));
    return { success: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past_due: "bg-yellow-100 text-yellow-700",
  canceled: "bg-red-100 text-red-700",
};

const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  premium: "bg-purple-100 text-purple-700",
};

export default function AdminOrganizationsPage() {
  const { organizations, search, error } = useLoaderData<typeof loader>();
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
      fetcher.submit({ intent: "delete", orgId: id }, { method: "post" });
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-gray-600">{organizations.length} total</p>
        </div>
        <Link
          to="/tenants/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Organization
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="search"
          name="q"
          placeholder="Search by slug or name..."
          defaultValue={search}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Slug</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Owner</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Members</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Plan</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Created</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No organizations found
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3">
                    <a
                      href={org.tenantUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {org.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {org.logo && (
                        <img
                          src={org.logo}
                          alt=""
                          className="w-6 h-6 rounded object-cover"
                        />
                      )}
                      {org.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{org.ownerEmail}</td>
                  <td className="px-4 py-3 text-gray-700">{org.memberCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        planColors[org.subscriptionPlan] || "bg-gray-100"
                      }`}
                    >
                      {org.subscriptionPlan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[org.subscriptionStatus] || "bg-gray-100"
                      }`}
                    >
                      {org.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{org.createdAt}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/tenants/${org.slug}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(org.id, org.name)}
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
