import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { resolveLocale } from "../../../i18n/resolve-locale";
import { bulkGetContentTranslations } from "../../../../lib/db/translations.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { db } from "../../../../lib/db";
import { boats as boatsTable, trips } from "../../../../lib/db/schema";
import { eq, ilike, count, and } from "drizzle-orm";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { useNotification } from "../../../../lib/use-notification";
import { formatLabel } from "../../../lib/format";
import { useT } from "../../../i18n/use-t";

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

  // Get tenant database for images query
  const { db: tenantDb, schema: tenantSchema } = getTenantDb(ctx.org.id);

  // Query primary images for all boats
  const boatIds = rawBoats.map(b => b.id);
  const boatImages = boatIds.length > 0 ? await tenantDb
    .select({
      entityId: tenantSchema.images.entityId,
      thumbnailUrl: tenantSchema.images.thumbnailUrl,
      url: tenantSchema.images.url,
    })
    .from(tenantSchema.images)
    .where(
      and(
        eq(tenantSchema.images.organizationId, ctx.org.id),
        eq(tenantSchema.images.entityType, "boat"),
        eq(tenantSchema.images.isPrimary, true)
      )
    ) : [];

  const imageMap = new Map(boatImages.map(img => [img.entityId, img.thumbnailUrl || img.url]));

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
    imageUrl: imageMap.get(b.id),
  }));

  // Apply content translations for non-English locales
  const locale = resolveLocale(request);
  if (locale !== "en" && boats.length > 0) {
    const translations = await bulkGetContentTranslations(ctx.org.id, "boat", boats.map(b => b.id), locale);
    for (const boat of boats) {
      const tr = translations.get(boat.id);
      if (tr) {
        if (tr.name) boat.name = tr.name;
        if (tr.description) boat.description = tr.description;
      }
    }
  }

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
  const t = useT();

  const vesselTypeLabels: Record<string, string> = {
    catamaran: t("tenant.boats.type.catamaran"),
    speedboat: t("tenant.boats.type.speedboat"),
    sailboat: t("tenant.boats.type.sailboat"),
    inflatable: t("tenant.boats.type.inflatable"),
    rigid_inflatable: t("tenant.boats.type.rigidInflatable"),
    dive_boat: t("tenant.boats.type.diveBoat"),
    other: t("tenant.boats.type.other"),
  };
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
          <h1 className="text-2xl font-bold">{t("tenant.boats.title")}</h1>
          <p className="text-foreground-muted">
            {activeCount} {t("common.active").toLowerCase()} {t("tenant.boats.title").toLowerCase()} • {totalCapacity} {t("common.capacity").toLowerCase()}
          </p>
        </div>
        <Link
          to="/tenant/boats/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          {t("tenant.boats.addBoat")}
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="search"
          name="q"
          placeholder={t("tenant.boats.searchBoats")}
          defaultValue={search}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
      </form>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-foreground-muted text-sm">{t("tenant.boats.totalBoats")}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-success">{activeCount}</p>
          <p className="text-foreground-muted text-sm">{t("common.active")}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{totalCapacity}</p>
          <p className="text-foreground-muted text-sm">{t("tenant.boats.totalCapacity")}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">
            {boats.reduce((sum, b) => sum + b.tripCount, 0)}
          </p>
          <p className="text-foreground-muted text-sm">{t("tenant.boats.totalTrips")}</p>
        </div>
      </div>

      {/* Boats List */}
      {boats.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">{t("tenant.boats.noBoatsFound")}</p>
          <Link
            to="/tenant/boats/new"
            className="inline-block mt-4 text-brand hover:underline"
          >
            {t("tenant.boats.addFirstBoat")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {boats.map((boat) => (
            <Link
              key={boat.id}
              to={`/tenant/boats/${boat.id}`}
              className={`bg-surface-raised rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                !boat.isActive ? "opacity-60" : ""
              }`}
            >
              {/* Boat Image */}
              {boat.imageUrl ? (
                <div className="w-full h-48 overflow-hidden">
                  <img
                    src={boat.imageUrl}
                    alt={boat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-48 bg-surface-inset flex items-center justify-center">
                  <svg className="w-16 h-16 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{boat.name}</h3>
                    <p className="text-foreground-muted text-sm">{vesselTypeLabels[boat.type] || formatLabel(boat.type)}</p>
                  </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    boat.isActive ? "bg-success-muted text-success" : "bg-surface-inset text-foreground-muted"
                  }`}
                >
                  {boat.isActive ? t("common.active") : t("common.inactive")}
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
                    +{t("tenant.boats.more", { count: boat.amenities.length - 3 })}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-sm border-t pt-3">
                <span>
                  <strong>{boat.capacity}</strong> {t("tenant.boats.passengers")}
                </span>
                <span className="text-foreground-muted">{boat.tripCount} {t("tenant.boats.trips")}</span>
              </div>

              {boat.registrationNumber && (
                <p className="text-xs text-foreground-subtle mt-2">
                  {t("tenant.boats.reg", { number: boat.registrationNumber })}
                </p>
              )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
