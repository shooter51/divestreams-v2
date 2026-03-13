/**
 * Public Site Trips List Page
 *
 * Displays a grid of public trips with filtering and pagination.
 * Each trip card shows tour info, dates, pricing, and links to detail page.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { useT } from "../../../i18n/use-t";
import { useFormat } from "../../../i18n/use-format";
import { eq, and, gte, lte, sql, asc, inArray } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { trips, tours, bookings, images, organization } from "../../../../lib/db/schema";
import { bulkGetContentTranslations } from "../../../../lib/db/translations.server";
import { resolveLocale } from "../../../i18n/resolve-locale";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Trips" }];
  return [
    { title: `Dive Trips - ${data.organizationName}` },
    { name: "description", content: `Explore upcoming dive trips and adventures with ${data.organizationName}` },
  ];
};

/** Strip HTML tags from a string (e.g. tour names stored with HTML markup) */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

// ============================================================================
// TYPES
// ============================================================================

interface TripCard {
  id: string;
  tourId: string;
  tourName: string;
  tourDescription: string | null;
  tourType: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  duration: number | null;
  minCertLevel: string | null;
  primaryImage: string | null;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
}

// ============================================================================
// LOADER
// ============================================================================

const ITEMS_PER_PAGE = 12;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;

  // Extract subdomain for organization lookup
  let subdomain: string | null = null;
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      subdomain = parts[0].toLowerCase();
    }
  } else {
    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin") {
        subdomain = sub;
      }
    }
  }

  // Get organization from parent layout or lookup
  const [org] = await db
    .select()
    .from(organization)
    .where(subdomain
      ? eq(organization.slug, subdomain)
      : eq(organization.customDomain, host.split(":")[0])
    )
    .limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Parse query parameters
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const fromDate = url.searchParams.get("from") || new Date().toISOString().split("T")[0];
  const toDate = url.searchParams.get("to") || null;
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // Build query conditions
  const conditions = [
    eq(trips.organizationId, org.id),
    eq(trips.status, "scheduled"),
    gte(trips.date, fromDate),
  ];

  if (toDate) {
    conditions.push(lte(trips.date, toDate));
  }

  // Get trips with tour info
  const tripsData = await db
    .select({
      id: trips.id,
      tourId: trips.tourId,
      tourName: tours.name,
      tourDescription: tours.description,
      tourType: tours.type,
      date: trips.date,
      startTime: trips.startTime,
      endTime: trips.endTime,
      tripMaxParticipants: trips.maxParticipants,
      tourMaxParticipants: tours.maxParticipants,
      tripPrice: trips.price,
      tourPrice: tours.price,
      currency: tours.currency,
      duration: tours.duration,
      minCertLevel: tours.minCertLevel,
      includesEquipment: tours.includesEquipment,
      includesMeals: tours.includesMeals,
      includesTransport: tours.includesTransport,
    })
    .from(trips)
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(and(...conditions, eq(tours.isActive, true)))
    .orderBy(asc(trips.date), asc(trips.startTime))
    .limit(ITEMS_PER_PAGE)
    .offset(offset);

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(and(...conditions, eq(tours.isActive, true)));

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Batch-fetch booking counts and images (eliminates N+1 queries)
  const tripIds = tripsData.map((t) => t.id);
  const tourIds = [...new Set(tripsData.map((t) => t.tourId))];

  const [bookingCounts, tourImages] = await Promise.all([
    // Single query for all booking counts
    tripIds.length > 0
      ? db
          .select({
            tripId: bookings.tripId,
            total: sql<number>`COALESCE(SUM(participants), 0)`,
          })
          .from(bookings)
          .where(
            and(
              inArray(bookings.tripId, tripIds),
              sql`${bookings.status} NOT IN ('cancelled', 'no_show')`
            )
          )
          .groupBy(bookings.tripId)
      : Promise.resolve([]),
    // Single query for all primary images
    tourIds.length > 0
      ? db
          .select({ entityId: images.entityId, url: images.url })
          .from(images)
          .where(
            and(
              eq(images.organizationId, org.id),
              eq(images.entityType, "tour"),
              inArray(images.entityId, tourIds),
              eq(images.isPrimary, true)
            )
          )
      : Promise.resolve([]),
  ]);

  const bookingMap = new Map(bookingCounts.map((b) => [b.tripId, Number(b.total)]));
  const imageMap = new Map(tourImages.map((i) => [i.entityId, i.url]));

  const tripCards: TripCard[] = tripsData.map((trip) => {
    const maxParticipants = Number(trip.tripMaxParticipants || trip.tourMaxParticipants);
    const bookedParticipants = bookingMap.get(trip.id) || 0;

    return {
      id: trip.id,
      tourId: trip.tourId,
      tourName: trip.tourName,
      tourDescription: trip.tourDescription,
      tourType: trip.tourType,
      date: trip.date,
      startTime: trip.startTime,
      endTime: trip.endTime,
      maxParticipants,
      availableSpots: Math.max(0, maxParticipants - bookedParticipants),
      price: trip.tripPrice || trip.tourPrice,
      currency: trip.currency || "USD",
      duration: trip.duration,
      minCertLevel: trip.minCertLevel,
      primaryImage: imageMap.get(trip.tourId) || null,
      includesEquipment: trip.includesEquipment || false,
      includesMeals: trip.includesMeals || false,
      includesTransport: trip.includesTransport || false,
    };
  });

  // Apply content translations for tour names/descriptions
  const locale = resolveLocale(request);
  let translatedTripCards = tripCards;
  if (locale !== "en" && tripCards.length > 0) {
    const tourIds = [...new Set(tripCards.map((t) => t.tourId))];
    const translations = await bulkGetContentTranslations(
      org.id,
      "tour",
      tourIds,
      locale
    );
    translatedTripCards = tripCards.map((t) => {
      const tr = translations.get(t.tourId);
      return tr
        ? { ...t, tourName: tr.name || t.tourName, tourDescription: tr.description || t.tourDescription }
        : t;
    });
  }

  return {
    trips: translatedTripCards,
    total,
    page,
    totalPages,
    fromDate,
    toDate,
    organizationName: org.name,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

const tourTypeKeys: Record<string, { key: string; icon: string }> = {
  single_dive: { key: "site.trips.type.singleDive", icon: "diving-mask" },
  multi_dive: { key: "site.trips.type.multiDive", icon: "waves" },
  course: { key: "site.trips.type.course", icon: "book" },
  snorkel: { key: "site.trips.type.snorkel", icon: "sun" },
  night_dive: { key: "site.trips.type.nightDive", icon: "moon" },
  other: { key: "site.trips.type.diveTrip", icon: "anchor" },
};


function formatTime(timeString: string | null): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatPrice(price: string, currency: string): string {
  const num = parseFloat(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function SiteTripsPage() {
  const { trips, total, page, totalPages, fromDate, toDate } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useT();

  const handleFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params: Record<string, string> = {};
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    if (from) params.from = from;
    if (to) params.to = to;
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-card-bg)" }}>
      {/* Hero Section */}
      <section
        className="py-16 px-4"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: "var(--primary-color)" }}
          >
            {t("site.trips.upcomingTitle")}
          </h1>
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto" style={{ color: "var(--text-color)" }}>
            {t("site.trips.upcomingDescription")}
          </p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="py-6 px-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1 opacity-75" style={{ color: "var(--text-color)" }}>{t("site.trips.fromDate")}</label>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  backgroundColor: "var(--color-card-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--text-color)",
                  // @ts-expect-error CSS custom property
                  "--tw-ring-color": "var(--primary-color)",
                }}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1 opacity-75" style={{ color: "var(--text-color)" }}>{t("site.trips.toDate")}</label>
              <input
                type="date"
                name="to"
                defaultValue={toDate || ""}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  backgroundColor: "var(--color-card-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--text-color)",
                  // @ts-expect-error CSS custom property
                  "--tw-ring-color": "var(--primary-color)",
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary-color)" }}
              >
                {t("site.trips.filter")}
              </button>
              {(searchParams.get("from") || searchParams.get("to")) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--text-color)",
                    backgroundColor: "var(--color-card-bg)"
                  }}
                >
                  {t("site.trips.clear")}
                </button>
              )}
            </div>
          </form>
          <p className="mt-3 text-sm opacity-60" style={{ color: "var(--text-color)" }}>
            {t("site.trips.showingXofY", { count: trips.length, total })}
          </p>
        </div>
      </section>

      {/* Trips Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {trips.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                <svg
                  className="w-10 h-10 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: "var(--text-color)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-color)" }}>{t("site.trips.noTripsFound")}</h2>
              <p className="opacity-75 mb-6" style={{ color: "var(--text-color)" }}>
                {searchParams.get("from") || searchParams.get("to")
                  ? t("site.trips.adjustDateFilters")
                  : t("site.trips.checkBackSoon")}
              </p>
              {(searchParams.get("from") || searchParams.get("to")) && (
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {t("site.trips.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: "var(--color-border)",
                      color: "var(--text-color)",
                      backgroundColor: "var(--color-card-bg)"
                    }}
                  >
                    {t("common.previous")}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className="w-10 h-10 rounded-lg font-medium transition-colors"
                        style={{
                          backgroundColor: p === page ? "var(--primary-color)" : "transparent",
                          color: p === page ? "white" : "var(--text-color)",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: "var(--color-border)",
                      color: "var(--text-color)",
                      backgroundColor: "var(--color-card-bg)"
                    }}
                  >
                    {t("common.next")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// TRIP CARD COMPONENT
// ============================================================================

function TripCard({ trip }: { trip: TripCard }) {
  const t = useT();
  const { formatDisplayDate: formatDate } = useFormat();
  const typeInfo = tourTypeKeys[trip.tourType] || tourTypeKeys.other;
  const isFull = trip.availableSpots === 0;

  return (
    <Link
      to={`/site/trips/${trip.id}`}
      className="group block rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md border"
      style={{
        backgroundColor: "var(--color-card-bg)",
        borderColor: "var(--color-border)"
      }}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: "var(--accent-color)" }}>
        {trip.primaryImage ? (
          <img
            src={trip.primaryImage}
            alt={stripHtml(trip.tourName)}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            <svg
              className="w-16 h-16 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
            </svg>
          </div>
        )}
        {/* Availability Badge */}
        <div
          className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: isFull
              ? "var(--danger-bg)"
              : trip.availableSpots <= 3
              ? "var(--warning-muted)"
              : "var(--success-muted)",
            color: isFull
              ? "var(--danger-text)"
              : trip.availableSpots <= 3
              ? "var(--warning)"
              : "var(--success)",
          }}
        >
          {isFull ? t("site.trips.soldOut") : t("site.trips.spotsLeft", { count: trip.availableSpots })}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Type & Date */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--primary-color)",
            }}
          >
            {t(typeInfo.key)}
          </span>
          <span className="text-sm opacity-60">{formatDate(trip.date)}</span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 line-clamp-1" style={{ color: "var(--text-color)" }}>{stripHtml(trip.tourName)}</h3>

        {/* Description */}
        {trip.tourDescription && (
          <p className="text-sm opacity-70 mb-3 line-clamp-2" style={{ color: "var(--text-color)" }}>{trip.tourDescription}</p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap gap-3 text-sm opacity-60 mb-4">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {trip.startTime ? formatTime(trip.startTime) : t("site.trips.timeTba")}
          </span>
          {trip.duration && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {formatDuration(trip.duration)}
            </span>
          )}
          {trip.minCertLevel && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
              {trip.minCertLevel}
            </span>
          )}
        </div>

        {/* Inclusions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {trip.includesEquipment && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--info-muted)", color: "var(--info)" }}>
              {t("site.trips.includesEquipment")}
            </span>
          )}
          {trip.includesMeals && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--success-muted)", color: "var(--success)" }}>
              {t("site.trips.includesMeals")}
            </span>
          )}
          {trip.includesTransport && (
            <span className="text-xs px-2 py-1 bg-info-muted text-info rounded-full">
              {t("site.trips.includesTransport")}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              {formatPrice(trip.price, trip.currency)}
            </p>
            <p className="text-xs opacity-50">{t("site.trips.perPerson")}</p>
          </div>
          <span
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: isFull ? "var(--surface-overlay)" : "var(--primary-color)" }}
          >
            {isFull ? t("site.trips.joinWaitlist") : t("site.trips.viewDetails")}
          </span>
        </div>
      </div>
    </Link>
  );
}
