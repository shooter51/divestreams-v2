import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { db } from "../../../../lib/db";
import { boats as boatsTable, trips } from "../../../../lib/db/schema";
import { eq, ilike, sql, count, and } from "drizzle-orm";
import { useNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Boats - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_EQUIPMENT_BOATS);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  // Query boats with trip counts
  let rawBoats;
  if (search) {
    rawBoats = await db
      .select({
        id: boatsTable.id,
        name: boatsTable.name,
        type: boatsTable.type,
        capacity: boatsTable.capacity,
        registrationNumber: boatsTable.registrationNumber,
        description: boatsTable.description,
        amenities: boatsTable.amenities,
        isActive: boatsTable.isActive,
      })
      .from(boatsTable)
      .where(
        and(
          eq(boatsTable.organizationId, ctx.org.id),
          ilike(boatsTable.name, `%${search}%`)
        )
      );
  } else {
    rawBoats = await db
      .select({
        id: boatsTable.id,
        name: boatsTable.name,
        type: boatsTable.type,
        capacity: boatsTable.capacity,
        registrationNumber: boatsTable.registrationNumber,
        description: boatsTable.description,
        amenities: boatsTable.amenities,
        isActive: boatsTable.isActive,
      })
      .from(boatsTable)
      .where(eq(boatsTable.organizationId, ctx.org.id));
  }

  // Get trip counts per boat
  const tripCounts = await db
    .select({
      boatId: trips.boatId,
      count: count(),
    })
    .from(trips)
    .where(eq(trips.organizationId, ctx.org.id))
    .groupBy(trips.boatId);

  const tripCountMap = new Map(tripCounts.map(t => [t.boatId, t.count]));

  // Transform to UI format
  const boats = rawBoats.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type || "Dive Boat",
    capacity: b.capacity || 0,
    registrationNumber: b.registrationNumber || "",
    description: b.description || "",
    amenities: Array.isArray(b.amenities) ? b.amenities : [],
    isActive: b.isActive ?? true,
    tripCount: tripCountMap.get(b.id) || 0,
  }));

  const totalCapacity = boats.filter((b) => b.isActive).reduce((sum, b) => sum + b.capacity, 0);
  const activeCount = boats.filter((b) => b.isActive).length;

  return {
    boats,
    total: boats.length,
    activeCount,
    totalCapacity,
    search,
    isPremium: ctx.isPremium,
  };
}

export default function BoatsPage() {
  // Show notifications from URL params
  useNotification();

  const { boats, total, activeCount, totalCapacity, search } = useLoaderData<typeof loader>();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Boats & Vessels</h1>
          <p className="text-foreground-muted">
            {activeCount} active boats • {totalCapacity} total capacity
          </p>
        </div>
        <Link
          to="/tenant/boats/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          Add Boat
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="search"
          name="q"
          placeholder="Search boats..."
          defaultValue={search}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
      </form>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-foreground-muted text-sm">Total Boats</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-success">{activeCount}</p>
          <p className="text-foreground-muted text-sm">Active</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{totalCapacity}</p>
          <p className="text-foreground-muted text-sm">Total Capacity</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">
            {boats.reduce((sum, b) => sum + b.tripCount, 0)}
          </p>
          <p className="text-foreground-muted text-sm">Total Trips</p>
        </div>
      </div>

      {/* Boats List */}
      {boats.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">No boats found.</p>
          <Link
            to="/tenant/boats/new"
            className="inline-block mt-4 text-brand hover:underline"
          >
            Add your first boat
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {boats.map((boat) => (
            <Link
              key={boat.id}
              to={`/tenant/boats/${boat.id}`}
              className={`bg-surface-raised rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                !boat.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{boat.name}</h3>
                  <p className="text-foreground-muted text-sm">{boat.type}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    boat.isActive ? "bg-success-muted text-success" : "bg-surface-inset text-foreground-muted"
                  }`}
                >
                  {boat.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="text-sm text-foreground-muted mb-3 line-clamp-2">
                {boat.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {boat.amenities.slice(0, 3).map((a: string) => (
                  <span
                    key={a}
                    className="text-xs bg-surface-inset text-foreground-muted px-2 py-1 rounded"
                  >
                    {a}
                  </span>
                ))}
                {boat.amenities.length > 3 && (
                  <span className="text-xs text-foreground-subtle">
                    +{boat.amenities.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-sm border-t pt-3">
                <span>
                  <strong>{boat.capacity}</strong> passengers
                </span>
                <span className="text-foreground-muted">{boat.tripCount} trips</span>
              </div>

              {boat.registrationNumber && (
                <p className="text-xs text-foreground-subtle mt-2">
                  Reg: {boat.registrationNumber}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
