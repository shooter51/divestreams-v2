import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { diveSites as diveSitesTable } from "../../../../lib/db/schema";
import { eq, ilike, and } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Dive Sites - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const difficulty = url.searchParams.get("difficulty") || "";

  // Build query conditions
  const conditions = [eq(diveSitesTable.organizationId, ctx.org.id)];

  if (search) {
    conditions.push(ilike(diveSitesTable.name, `%${search}%`));
  }

  if (difficulty) {
    conditions.push(eq(diveSitesTable.difficulty, difficulty));
  }

  const rawSites = await db
    .select()
    .from(diveSitesTable)
    .where(and(...conditions));

  // Transform to UI format
  const diveSites = rawSites.map((s) => ({
    id: s.id,
    name: s.name,
    location: "", // Could derive from lat/lng or store separately
    maxDepth: s.maxDepth || 0,
    difficulty: s.difficulty || "intermediate",
    description: s.description || "",
    coordinates: s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null,
    conditions: s.currentStrength || "",
    highlights: s.highlights || [],
    isActive: s.isActive ?? true,
  }));

  return {
    diveSites,
    total: diveSites.length,
    search,
    difficulty,
    isPremium: ctx.isPremium,
  };
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-success-muted text-success",
  intermediate: "bg-brand-muted text-brand",
  advanced: "bg-accent-muted text-accent",
  expert: "bg-danger-muted text-danger",
};

export default function DiveSitesPage() {
  const { diveSites, total, search, difficulty } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams);
    const q = formData.get("q") as string;
    if (q) params.set("q", q);
    else params.delete("q");
    setSearchParams(params);
  };

  const setDifficulty = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("difficulty", value);
    else params.delete("difficulty");
    setSearchParams(params);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dive Sites</h1>
          <p className="text-foreground-muted">{total} sites</p>
        </div>
        <Link
          to="/tenant/dive-sites/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          Add Site
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1">
          <input
            type="search"
            name="q"
            placeholder="Search dive sites..."
            defaultValue={search}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          />
        </form>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Sites List */}
      {diveSites.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">No dive sites found.</p>
          <Link
            to="/tenant/dive-sites/new"
            className="inline-block mt-4 text-brand hover:underline"
          >
            Add your first dive site
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {diveSites.map((site) => (
            <Link
              key={site.id}
              to={`/tenant/dive-sites/${site.id}`}
              className={`bg-surface-raised rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                !site.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{site.name}</h3>
                  <p className="text-foreground-muted text-sm">{site.location}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    difficultyColors[site.difficulty]
                  }`}
                >
                  {site.difficulty}
                </span>
              </div>

              <p className="text-sm text-foreground-muted mb-3 line-clamp-2">
                {site.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {(Array.isArray(site.highlights) ? site.highlights : []).slice(0, 3).map((h: string) => (
                  <span
                    key={h}
                    className="text-xs bg-surface-inset text-foreground-muted px-2 py-1 rounded"
                  >
                    {h}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm border-t pt-3">
                <span className="text-foreground-muted">
                  Max depth: <strong>{site.maxDepth}m</strong>
                </span>
              </div>

              {!site.isActive && (
                <div className="mt-2 text-xs text-accent">Inactive</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
