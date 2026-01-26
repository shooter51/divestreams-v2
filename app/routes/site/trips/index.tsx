/**
 * Public Site Trips List Page
 *
 * Displays a grid of public trips with filtering and pagination.
 * Each trip card shows tour info, dates, pricing, and links to detail page.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, useRouteLoaderData } from "react-router";
import { eq, and, gte, lte, sql, asc } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { trips, tours, bookings, images, organization } from "../../../../lib/db/schema";
import type { SiteLoaderData } from "../_layout";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Trips" }];
  return [
    { title: `Dive Trips - ${data.organizationName}` },
    { name: "description", content: `Explore upcoming dive trips and adventures with ${data.organizationName}` },
  ];
};

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
  startTime: string;
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
    eq(trips.isPublic, true),
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

  // Get booking counts and images for each trip
  const tripCards: TripCard[] = await Promise.all(
    tripsData.map(async (trip) => {
      // Get booking count
      const bookingCount = await db
        .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.tripId, trip.id),
            sql`${bookings.status} NOT IN ('canceled', 'no_show')`
          )
        );

      // Get primary image for the tour
      const tourImages = await db
        .select({ url: images.url })
        .from(images)
        .where(
          and(
            eq(images.organizationId, org.id),
            eq(images.entityType, "tour"),
            eq(images.entityId, trip.tourId),
            eq(images.isPrimary, true)
          )
        )
        .limit(1);

      const maxParticipants = Number(trip.tripMaxParticipants || trip.tourMaxParticipants);
      const bookedParticipants = Number(bookingCount[0]?.total || 0);

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
        primaryImage: tourImages[0]?.url || null,
        includesEquipment: trip.includesEquipment || false,
        includesMeals: trip.includesMeals || false,
        includesTransport: trip.includesTransport || false,
      };
    })
  );

  return {
    trips: tripCards,
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

const tourTypes: Record<string, { label: string; icon: string }> = {
  single_dive: { label: "Single Dive", icon: "diving-mask" },
  multi_dive: { label: "Multi-Dive", icon: "waves" },
  course: { label: "Course", icon: "book" },
  snorkel: { label: "Snorkel", icon: "sun" },
  night_dive: { label: "Night Dive", icon: "moon" },
  other: { label: "Dive Trip", icon: "anchor" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeString: string): string {
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
  const layoutData = useRouteLoaderData("routes/site/_layout") as SiteLoaderData | undefined;

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
    <div className="min-h-screen">
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
            Upcoming Dive Trips
          </h1>
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto">
            Explore our scheduled dive adventures. Book your spot today and dive into an
            unforgettable experience.
          </p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="py-6 px-4 border-b" style={{ borderColor: "var(--accent-color)" }}>
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1 opacity-75">From Date</label>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  borderColor: "var(--accent-color)",
                  // @ts-expect-error CSS custom property
                  "--tw-ring-color": "var(--primary-color)",
                }}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1 opacity-75">To Date</label>
              <input
                type="date"
                name="to"
                defaultValue={toDate || ""}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{
                  borderColor: "var(--accent-color)",
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
                Filter
              </button>
              {(searchParams.get("from") || searchParams.get("to")) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-lg border font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: "var(--accent-color)" }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
          <p className="mt-3 text-sm opacity-60">
            Showing {trips.length} of {total} trips
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
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">No Trips Found</h2>
              <p className="opacity-75 mb-6">
                {searchParams.get("from") || searchParams.get("to")
                  ? "Try adjusting your date filters to see more trips."
                  : "Check back soon for upcoming dive adventures!"}
              </p>
              {(searchParams.get("from") || searchParams.get("to")) && (
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  Clear Filters
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
                    className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    style={{ borderColor: "var(--accent-color)" }}
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className="w-10 h-10 rounded-lg font-medium transition-colors"
                        style={{
                          backgroundColor: p === page ? "var(--primary-color)" : "transparent",
                          color: p === page ? "white" : "inherit",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    style={{ borderColor: "var(--accent-color)" }}
                  >
                    Next
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
  const typeInfo = tourTypes[trip.tourType] || tourTypes.other;
  const isFull = trip.availableSpots === 0;

  return (
    <Link
      to={`/site/trips/${trip.id}`}
      className="group block bg-white rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--accent-color)", borderWidth: "1px" }}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        {trip.primaryImage ? (
          <img
            src={trip.primaryImage}
            alt={trip.tourName}
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
          className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium ${
            isFull
              ? "bg-red-100 text-red-700"
              : trip.availableSpots <= 3
              ? "bg-yellow-100 text-yellow-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {isFull ? "Sold Out" : `${trip.availableSpots} spots left`}
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
            {typeInfo.label}
          </span>
          <span className="text-sm opacity-60">{formatDate(trip.date)}</span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 line-clamp-1">{trip.tourName}</h3>

        {/* Description */}
        {trip.tourDescription && (
          <p className="text-sm opacity-70 mb-3 line-clamp-2">{trip.tourDescription}</p>
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
            {formatTime(trip.startTime)}
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
            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
              Equipment
            </span>
          )}
          {trip.includesMeals && (
            <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">
              Meals
            </span>
          )}
          {trip.includesTransport && (
            <span className="text-xs px-2 py-1 bg-info-muted text-info rounded-full">
              Transport
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--accent-color)" }}>
          <div>
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              {formatPrice(trip.price, trip.currency)}
            </p>
            <p className="text-xs opacity-50">per person</p>
          </div>
          <span
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: isFull ? "#9ca3af" : "var(--primary-color)" }}
          >
            {isFull ? "Join Waitlist" : "View Details"}
          </span>
        </div>
      </div>
    </Link>
  );
}
