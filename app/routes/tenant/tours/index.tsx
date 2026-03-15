import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { useT } from "../../../i18n/use-t";
import { resolveLocale } from "../../../i18n/resolve-locale";
import { bulkGetContentTranslations } from "../../../../lib/db/translations.server";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { tours, trips } from "../../../../lib/db/schema";
import { eq, or, ilike, sql, count, and } from "drizzle-orm";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { UpgradePrompt } from "../../../components/ui/UpgradePrompt";
import { useNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Tours - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const typeFilter = url.searchParams.get("type") || "";

  // Build query with organization filter
  const baseCondition = eq(tours.organizationId, ctx.org.id);

  // Add search filter if provided
  const searchCondition = search
    ? or(
        ilike(tours.name, `%${search}%`),
        ilike(tours.description, `%${search}%`)
      )
    : undefined;

  // Add type filter if provided
  const typeCondition = typeFilter
    ? eq(tours.type, typeFilter)
    : undefined;

  // Combine conditions
  let whereCondition = baseCondition;
  if (searchCondition && typeCondition) {
    whereCondition = sql`${baseCondition} AND ${searchCondition} AND ${typeCondition}`;
  } else if (searchCondition) {
    whereCondition = sql`${baseCondition} AND ${searchCondition}`;
  } else if (typeCondition) {
    whereCondition = sql`${baseCondition} AND ${typeCondition}`;
  }

  // Get tours with trip count
  const tourList = await db
    .select({
      id: tours.id,
      name: tours.name,
      description: tours.description,
      type: tours.type,
      duration: tours.duration,
      maxParticipants: tours.maxParticipants,
      price: tours.price,
      currency: tours.currency,
      minCertLevel: tours.minCertLevel,
      isActive: tours.isActive,
      createdAt: tours.createdAt,
    })
    .from(tours)
    .where(whereCondition)
    .orderBy(tours.name);

  // Get trip counts for each tour
  const tripCounts = await db
    .select({
      tourId: trips.tourId,
      count: count(),
    })
    .from(trips)
    .where(eq(trips.organizationId, ctx.org.id))
    .groupBy(trips.tourId);

  const tripCountMap = new Map(tripCounts.map(tc => [tc.tourId, tc.count]));

  // Get tenant database for images query
  const { db: tenantDb, schema: tenantSchema } = getTenantDb(ctx.org.id);

  // Query primary images for all tours
  const tourIds = tourList.map(t => t.id);
  const tourImages = tourIds.length > 0 ? await tenantDb
    .select({
      entityId: tenantSchema.images.entityId,
      thumbnailUrl: tenantSchema.images.thumbnailUrl,
      url: tenantSchema.images.url,
    })
    .from(tenantSchema.images)
    .where(
      and(
        eq(tenantSchema.images.organizationId, ctx.org.id),
        eq(tenantSchema.images.entityType, "tour"),
        eq(tenantSchema.images.isPrimary, true)
      )
    ) : [];

  const imageMap = new Map(tourImages.map(img => [img.entityId, img.thumbnailUrl || img.url]));

  // Transform to UI format
  const tourData = tourList.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type || "other",
    duration: t.duration || 0,
    maxParticipants: t.maxParticipants || 0,
    price: t.price ? Number(t.price).toFixed(2) : "0.00",
    currency: t.currency || "USD",
    minCertLevel: t.minCertLevel,
    isActive: t.isActive ?? true,
    tripCount: tripCountMap.get(t.id) || 0,
    imageUrl: imageMap.get(t.id),
  }));

  // Apply content translations for non-English locales
  const locale = resolveLocale(request);
  if (tourData.length > 0) {
    const translations = await bulkGetContentTranslations(ctx.org.id, "tour", tourData.map(t => t.id), locale);
    for (const tour of tourData) {
      const tr = translations.get(tour.id);
      if (tr) {
        if (tr.name) tour.name = tr.name;
      }
    }
  }

  // Get total count for usage tracking (without filters)
  const [{ value: totalTours }] = await db
    .select({ value: count() })
    .from(tours)
    .where(eq(tours.organizationId, ctx.org.id));

  return {
    tours: tourData,
    total: tourData.length,
    search,
    typeFilter,
    // Freemium data
    canAddTour: ctx.canAddTour,
    usage: totalTours,
    limit: ctx.limits.tours,
    isPremium: ctx.isPremium,
  };
}

const tourTypeColors: Record<string, string> = {
  single_dive: "bg-brand-muted text-brand",
  multi_dive: "bg-info-muted text-info",
  course: "bg-info-muted text-info",
  snorkel: "bg-info-muted text-info",
  night_dive: "bg-surface-overlay text-foreground-muted",
  other: "bg-surface-inset text-foreground",
};

export default function ToursPage() {
  // Show notifications from URL params
  useNotification();
  const t = useT();

  const tourTypes: Record<string, { label: string; color: string }> = {
    single_dive: { label: t("tenant.tours.type.singleDive"), color: tourTypeColors.single_dive },
    multi_dive: { label: t("tenant.tours.type.multiDive"), color: tourTypeColors.multi_dive },
    course: { label: t("tenant.tours.type.course"), color: tourTypeColors.course },
    snorkel: { label: t("tenant.tours.type.snorkel"), color: tourTypeColors.snorkel },
    night_dive: { label: t("tenant.tours.type.nightDive"), color: tourTypeColors.night_dive },
    other: { label: t("tenant.tours.type.other"), color: tourTypeColors.other },
  };

  const {
    tours,
    total,
    search,
    typeFilter,
    canAddTour,
    usage,
    limit,
    isPremium
  } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    const type = formData.get("type") as string;
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (type) params.type = type;
    setSearchParams(params);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  // Check if at limit (for free tier)
  const isAtLimit = !isPremium && usage >= limit;

  return (
    <div>
      {/* Show upgrade banner when at limit */}
      {isAtLimit && (
        <div className="mb-6">
          <UpgradePrompt
            feature="tours"
            currentCount={usage}
            limit={limit}
            variant="banner"
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.tours")}</h1>
          <p className="text-foreground-muted">
            {t("tenant.tours.tourTemplates", { count: total })}
            {!isPremium && (
              <span className="ml-2 text-sm text-foreground-subtle">
                {t("tenant.tours.usageOf", { usage, limit })}
              </span>
            )}
          </p>
        </div>
        <Link
          to="/tenant/tours/new"
          className={`px-4 py-2 rounded-lg ${
            canAddTour
              ? "bg-brand text-white hover:bg-brand-hover"
              : "bg-surface-overlay text-foreground-muted cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canAddTour) {
              e.preventDefault();
            }
          }}
          aria-disabled={!canAddTour}
        >
          {t("tenant.tours.createTour")}
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder={t("tenant.tours.searchPlaceholder")}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        >
          <option value="">{t("tenant.tours.allTypes")}</option>
          <option value="single_dive">{t("tenant.tours.type.singleDive")}</option>
          <option value="multi_dive">{t("tenant.tours.type.multiDive")}</option>
          <option value="course">{t("tenant.tours.type.course")}</option>
          <option value="snorkel">{t("tenant.tours.type.snorkel")}</option>
          <option value="night_dive">{t("tenant.tours.type.nightDive")}</option>
          <option value="other">{t("tenant.tours.type.other")}</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
        >
          {t("common.filter")}
        </button>
      </form>

      {/* Tour Grid */}
      {tours.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">
            {search || typeFilter
              ? t("tenant.tours.noToursFiltered")
              : t("tenant.tours.noTours")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tours.map((tour) => (
            <Link
              key={tour.id}
              to={`/tenant/tours/${tour.id}`}
              className="bg-surface-raised rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Tour Image */}
              {tour.imageUrl ? (
                <div className="w-full h-48 overflow-hidden">
                  <img
                    src={tour.imageUrl}
                    alt={tour.name}
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

              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg">{tour.name}</h3>
                {!tour.isActive && (
                  <span className="text-xs bg-surface-inset text-foreground-muted px-2 py-1 rounded">
                    {t("tenant.tours.inactive")}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tourTypes[tour.type]?.color || "bg-surface-inset text-foreground"
                    }`}
                  >
                    {tourTypes[tour.type]?.label || tour.type}
                  </span>
                  {tour.minCertLevel && (
                    <span className="text-xs text-foreground-muted">
                      {tour.minCertLevel}+
                    </span>
                  )}
                </div>

                <div className="flex justify-between text-foreground-muted">
                  <span>{formatDuration(tour.duration)}</span>
                  <span>{t("tenant.tours.maxPax", { count: tour.maxParticipants })}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold text-lg">
                    ${tour.price}
                  </span>
                  <span className="text-foreground-muted">
                    {Number(tour.tripCount) === 1
                      ? t("tenant.tours.tripRun", { count: tour.tripCount })
                      : t("tenant.tours.tripsRun", { count: tour.tripCount })}
                  </span>
                </div>
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
