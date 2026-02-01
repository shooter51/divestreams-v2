/**
 * Public Site Trip Detail Page
 *
 * Displays full trip information including:
 * - Image gallery
 * - Full description and itinerary
 * - Pricing and what's included
 * - Available spots
 * - Requirements/skill level
 * - Book Now button
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { trips, tours, bookings, images, boats, diveSites, tourDiveSites } from "../../../../lib/db/schema";
import { organization } from "../../../../lib/db/schema/auth";
import { useState } from "react";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.trip) return [{ title: "Trip Not Found" }];
  return [
    { title: `${data.trip.tourName} - ${data.organizationName}` },
    {
      name: "description",
      content: data.trip.tourDescription || `Book your spot on ${data.trip.tourName}`,
    },
  ];
};

// ============================================================================
// TYPES
// ============================================================================

interface TripDetail {
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
  bookedCount: number;
  price: string;
  currency: string;
  duration: number | null;
  minCertLevel: string | null;
  minAge: number | null;
  minParticipants: number;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
  inclusions: string[];
  exclusions: string[];
  requirements: string[];
  boatName: string | null;
  boatCapacity: number | null;
  weatherNotes: string | null;
  notes: string | null;
}

interface TripImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

interface DiveSiteInfo {
  id: string;
  name: string;
  description: string | null;
  maxDepth: number | null;
  minDepth: number | null;
  difficulty: string | null;
  highlights: string[];
  order: number;
}

// ============================================================================
// SUBDOMAIN HELPER
// ============================================================================

function getSubdomainFromHost(host: string): string | null {
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request, params }: LoaderFunctionArgs) {
  const tripId = params.tripId;

  if (!tripId) {
    throw new Response("Trip ID required", { status: 400 });
  }

  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  // Get organization
  const [org] = subdomain
    ? await db.select().from(organization).where(eq(organization.slug, subdomain)).limit(1)
    : await db.select().from(organization).where(eq(organization.customDomain, host.split(":")[0])).limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get trip with tour info
  const [tripData] = await db
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
      minParticipants: tours.minParticipants,
      tripPrice: trips.price,
      tourPrice: tours.price,
      currency: tours.currency,
      duration: tours.duration,
      minCertLevel: tours.minCertLevel,
      minAge: tours.minAge,
      includesEquipment: tours.includesEquipment,
      includesMeals: tours.includesMeals,
      includesTransport: tours.includesTransport,
      inclusions: tours.inclusions,
      exclusions: tours.exclusions,
      requirements: tours.requirements,
      boatId: trips.boatId,
      weatherNotes: trips.weatherNotes,
      notes: trips.notes,
      isPublic: trips.isPublic,
      status: trips.status,
    })
    .from(trips)
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(
      and(
        eq(trips.organizationId, org.id),
        eq(trips.id, tripId),
        eq(trips.isPublic, true),
        eq(trips.status, "scheduled"),
        eq(tours.isActive, true)
      )
    )
    .limit(1);

  if (!tripData) {
    throw new Response("Trip not found", { status: 404 });
  }

  // Check if trip is in the past
  const tripDate = new Date(tripData.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (tripDate < today) {
    throw new Response("This trip has already passed", { status: 404 });
  }

  // Get booking count
  const [bookingCount] = await db
    .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
    .from(bookings)
    .where(
      and(
        eq(bookings.tripId, tripId),
        sql`${bookings.status} NOT IN ('canceled', 'no_show')`
      )
    );

  // Get boat info if assigned
  let boatInfo: { name: string; capacity: number } | null = null;
  if (tripData.boatId) {
    const [boat] = await db
      .select({ name: boats.name, capacity: boats.capacity })
      .from(boats)
      .where(eq(boats.id, tripData.boatId))
      .limit(1);
    boatInfo = boat || null;
  }

  // Get tour images
  const tourImages = await db
    .select({
      id: images.id,
      url: images.url,
      thumbnailUrl: images.thumbnailUrl,
      alt: images.alt,
      sortOrder: images.sortOrder,
      isPrimary: images.isPrimary,
    })
    .from(images)
    .where(
      and(
        eq(images.organizationId, org.id),
        eq(images.entityType, "tour"),
        eq(images.entityId, tripData.tourId)
      )
    )
    .orderBy(sql`${images.isPrimary} DESC`, asc(images.sortOrder));

  // Get dive sites for this tour
  const sitesData = await db
    .select({
      id: diveSites.id,
      name: diveSites.name,
      description: diveSites.description,
      maxDepth: diveSites.maxDepth,
      minDepth: diveSites.minDepth,
      difficulty: diveSites.difficulty,
      highlights: diveSites.highlights,
      order: tourDiveSites.order,
    })
    .from(tourDiveSites)
    .innerJoin(diveSites, eq(tourDiveSites.diveSiteId, diveSites.id))
    .where(eq(tourDiveSites.tourId, tripData.tourId))
    .orderBy(asc(tourDiveSites.order));

  const maxParticipants = Number(tripData.tripMaxParticipants || tripData.tourMaxParticipants);
  const bookedParticipants = Number(bookingCount?.total || 0);

  const trip: TripDetail = {
    id: tripData.id,
    tourId: tripData.tourId,
    tourName: tripData.tourName,
    tourDescription: tripData.tourDescription,
    tourType: tripData.tourType,
    date: tripData.date,
    startTime: tripData.startTime,
    endTime: tripData.endTime,
    maxParticipants,
    availableSpots: Math.max(0, maxParticipants - bookedParticipants),
    bookedCount: bookedParticipants,
    price: tripData.tripPrice || tripData.tourPrice,
    currency: tripData.currency || "USD",
    duration: tripData.duration,
    minCertLevel: tripData.minCertLevel,
    minAge: tripData.minAge,
    minParticipants: tripData.minParticipants || 1,
    includesEquipment: tripData.includesEquipment || false,
    includesMeals: tripData.includesMeals || false,
    includesTransport: tripData.includesTransport || false,
    inclusions: (tripData.inclusions as string[]) || [],
    exclusions: (tripData.exclusions as string[]) || [],
    requirements: (tripData.requirements as string[]) || [],
    boatName: boatInfo?.name || null,
    boatCapacity: boatInfo?.capacity || null,
    weatherNotes: tripData.weatherNotes,
    notes: tripData.notes,
  };

  const tripImages: TripImage[] = tourImages.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl,
    alt: img.alt,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }));

  const diveSitesList: DiveSiteInfo[] = sitesData.map((site) => ({
    id: site.id,
    name: site.name,
    description: site.description,
    maxDepth: site.maxDepth,
    minDepth: site.minDepth,
    difficulty: site.difficulty,
    highlights: (site.highlights as string[]) || [],
    order: site.order || 0,
  }));

  return {
    trip,
    images: tripImages,
    diveSites: diveSitesList,
    organizationName: org.name,
    organizationSlug: subdomain || org.slug,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const tourTypes: Record<string, string> = {
  single_dive: "Single Dive",
  multi_dive: "Multi-Dive",
  course: "Course",
  snorkel: "Snorkel",
  night_dive: "Night Dive",
  other: "Dive Trip",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeString: string | null): string {
  if (!timeString) return "Time TBA";
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
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} hours`;
  return `${hours}h ${mins}min`;
}

function formatPrice(price: string, currency: string): string {
  const num = parseFloat(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SiteTripDetailPage() {
  const { trip, images, diveSites, organizationName, organizationSlug } = useLoaderData<typeof loader>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);

  const isFull = trip.availableSpots === 0;
  const primaryImage = images.length > 0 ? images[0] : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-card-bg)" }}>
      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          to="/site/trips"
          className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
          style={{ color: "var(--primary-color)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Trips
        </Link>
      </div>

      {/* Hero Section with Image */}
      <section className="relative">
        {/* Main Image */}
        <div
          className="relative h-[40vh] md:h-[50vh] overflow-hidden cursor-pointer"
          onClick={() => images.length > 0 && setShowGallery(true)}
        >
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt || trip.tourName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <svg className="w-24 h-24 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Image count badge */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(true);
              }}
              className="absolute bottom-4 right-4 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: "var(--color-card-bg)",
                color: "var(--text-color)",
                opacity: 0.9
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View {images.length} Photos
            </button>
          )}

          {/* Availability Badge */}
          <div
            className="absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-semibold"
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
            {isFull ? "Sold Out" : `${trip.availableSpots} spots available`}
          </div>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-3"
              style={{ backgroundColor: "var(--primary-color)", color: "white" }}
            >
              {tourTypes[trip.tourType] || trip.tourType}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
              {trip.tourName}
            </h1>
            <p className="text-lg text-white/90">{formatDate(trip.date)}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>About This Trip</h2>
              <p className="opacity-80 whitespace-pre-line" style={{ color: "var(--text-color)" }}>
                {trip.tourDescription || "Join us for an unforgettable diving experience!"}
              </p>
              {trip.notes && (
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "var(--accent-color)" }}>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--primary-color)" }}>
                    Additional Notes
                  </p>
                  <p className="text-sm opacity-80" style={{ color: "var(--text-color)" }}>{trip.notes}</p>
                </div>
              )}
            </div>

            {/* Trip Details */}
            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>Trip Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>Date</p>
                  <p className="font-medium" style={{ color: "var(--text-color)" }}>{formatDate(trip.date)}</p>
                </div>
                <div>
                  <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>Start Time</p>
                  <p className="font-medium" style={{ color: "var(--text-color)" }}>{formatTime(trip.startTime)}</p>
                </div>
                {trip.endTime && (
                  <div>
                    <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>End Time</p>
                    <p className="font-medium" style={{ color: "var(--text-color)" }}>{formatTime(trip.endTime)}</p>
                  </div>
                )}
                {trip.duration && (
                  <div>
                    <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>Duration</p>
                    <p className="font-medium" style={{ color: "var(--text-color)" }}>{formatDuration(trip.duration)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>Group Size</p>
                  <p className="font-medium" style={{ color: "var(--text-color)" }}>
                    {trip.minParticipants}-{trip.maxParticipants} divers
                  </p>
                </div>
                {trip.boatName && (
                  <div>
                    <p className="text-sm opacity-60 mb-1" style={{ color: "var(--text-color)" }}>Boat</p>
                    <p className="font-medium" style={{ color: "var(--text-color)" }}>{trip.boatName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dive Sites */}
            {diveSites.length > 0 && (
              <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
                <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>Dive Sites</h2>
                <div className="space-y-4">
                  {diveSites.map((site, index) => (
                    <div
                      key={site.id}
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: "var(--accent-color)" }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2" style={{ backgroundColor: "var(--primary-color)", color: "white" }}>
                            {index + 1}
                          </span>
                          <span className="font-semibold" style={{ color: "var(--text-color)" }}>{site.name}</span>
                        </div>
                        {site.difficulty && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--color-card-bg)", color: "var(--text-color)" }}>
                            {site.difficulty}
                          </span>
                        )}
                      </div>
                      {site.description && (
                        <p className="mt-2 text-sm opacity-80" style={{ color: "var(--text-color)" }}>{site.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {site.maxDepth && (
                          <span className="opacity-60" style={{ color: "var(--text-color)" }}>Max Depth: {site.maxDepth}m</span>
                        )}
                        {site.highlights.length > 0 && (
                          <span className="opacity-60" style={{ color: "var(--text-color)" }}>
                            Highlights: {site.highlights.slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What's Included */}
            <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>What's Included</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-green-700 mb-3">Included</h3>
                  <ul className="space-y-2">
                    {trip.includesEquipment && (
                      <li className="flex items-center gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Dive equipment rental
                      </li>
                    )}
                    {trip.includesMeals && (
                      <li className="flex items-center gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Meals & refreshments
                      </li>
                    )}
                    {trip.includesTransport && (
                      <li className="flex items-center gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Transportation
                      </li>
                    )}
                    {trip.inclusions.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-color)" }}>
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                    {!trip.includesEquipment && !trip.includesMeals && !trip.includesTransport && trip.inclusions.length === 0 && (
                      <li className="text-sm opacity-60" style={{ color: "var(--text-color)" }}>Basic trip package</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium opacity-60 mb-3" style={{ color: "var(--text-color)" }}>Not Included</h3>
                  <ul className="space-y-2">
                    {trip.exclusions.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm opacity-70" style={{ color: "var(--text-color)" }}>
                        <svg className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-border)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {item}
                      </li>
                    ))}
                    {trip.exclusions.length === 0 && (
                      <li className="text-sm opacity-60" style={{ color: "var(--text-color)" }}>None specified</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Requirements */}
            {(trip.minCertLevel || trip.minAge || trip.requirements.length > 0) && (
              <div className="rounded-xl p-6 shadow-sm border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
                <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--text-color)" }}>Requirements</h2>
                <div className="space-y-4">
                  {trip.minCertLevel && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--primary-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-color)" }}>Minimum Certification</p>
                        <p className="text-sm opacity-70" style={{ color: "var(--text-color)" }}>{trip.minCertLevel} or equivalent</p>
                      </div>
                    </div>
                  )}
                  {trip.minAge && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--primary-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="font-medium" style={{ color: "var(--text-color)" }}>Minimum Age</p>
                        <p className="text-sm opacity-70" style={{ color: "var(--text-color)" }}>{trip.minAge} years old</p>
                      </div>
                    </div>
                  )}
                  {trip.requirements.map((req, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm" style={{ color: "var(--text-color)" }}>{req}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weather Notes */}
            {trip.weatherNotes && (
              <div className="rounded-xl p-6 border" style={{ backgroundColor: "var(--accent-color)", borderColor: "var(--color-border)" }}>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 flex-shrink-0" style={{ color: "var(--primary-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--text-color)" }}>Weather & Conditions</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--text-color)" }}>{trip.weatherNotes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl p-6 shadow-lg border" style={{ backgroundColor: "var(--color-card-bg)", borderColor: "var(--color-border)" }}>
              {/* Price */}
              <div className="text-center mb-6">
                <p className="text-sm opacity-60" style={{ color: "var(--text-color)" }}>Price per person</p>
                <p className="text-4xl font-bold" style={{ color: "var(--primary-color)" }}>
                  {formatPrice(trip.price, trip.currency)}
                </p>
              </div>

              {/* Availability */}
              <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: "var(--accent-color)" }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-color)" }}>Availability</span>
                  <span className={`text-sm font-semibold ${isFull ? "text-red-600" : "text-green-600"}`}>
                    {isFull ? "Sold Out" : `${trip.availableSpots} spots left`}
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--color-border)" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${(trip.bookedCount / trip.maxParticipants) * 100}%`,
                      backgroundColor: isFull ? "#ef4444" : "var(--primary-color)",
                    }}
                  />
                </div>
                <p className="text-xs opacity-60 mt-2 text-center" style={{ color: "var(--text-color)" }}>
                  {trip.bookedCount} of {trip.maxParticipants} booked
                </p>
              </div>

              {/* Quick Info */}
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-60" style={{ color: "var(--text-color)" }}>Date</span>
                  <span className="font-medium" style={{ color: "var(--text-color)" }}>{formatDate(trip.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60" style={{ color: "var(--text-color)" }}>Time</span>
                  <span className="font-medium" style={{ color: "var(--text-color)" }}>{formatTime(trip.startTime)}</span>
                </div>
                {trip.duration && (
                  <div className="flex justify-between">
                    <span className="opacity-60" style={{ color: "var(--text-color)" }}>Duration</span>
                    <span className="font-medium" style={{ color: "var(--text-color)" }}>{formatDuration(trip.duration)}</span>
                  </div>
                )}
              </div>

              {/* Book Now Button */}
              <Link
                to={`/embed/${organizationSlug}/book?tripId=${trip.id}`}
                className={`block w-full py-4 rounded-lg text-center font-semibold text-lg transition-opacity ${
                  isFull
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "text-white hover:opacity-90"
                }`}
                style={isFull ? {} : { backgroundColor: "var(--primary-color)" }}
                onClick={(e) => {
                  if (isFull) e.preventDefault();
                }}
              >
                {isFull ? "Join Waitlist" : "Book Now"}
              </Link>

              {/* Inclusions Quick List */}
              {(trip.includesEquipment || trip.includesMeals || trip.includesTransport) && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <p className="text-xs font-medium opacity-60 mb-3" style={{ color: "var(--text-color)" }}>INCLUDED IN PRICE</p>
                  <div className="flex flex-wrap gap-2">
                    {trip.includesEquipment && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--info-muted)", color: "var(--info)" }}>Equipment</span>
                    )}
                    {trip.includesMeals && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--success-muted)", color: "var(--success)" }}>Meals</span>
                    )}
                    {trip.includesTransport && (
                      <span className="text-xs px-2 py-1 bg-info-muted text-info rounded-full">Transport</span>
                    )}
                  </div>
                </div>
              )}

              {/* Questions */}
              <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-sm opacity-60 mb-2" style={{ color: "var(--text-color)" }}>Have questions?</p>
                <Link
                  to="/site/contact"
                  className="text-sm font-medium hover:underline"
                  style={{ color: "var(--primary-color)" }}
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery Modal */}
      {showGallery && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setShowGallery(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Main Image */}
          <div className="max-w-5xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[selectedImageIndex].url}
              alt={images[selectedImageIndex].alt || trip.tourName}
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute left-4 text-white p-3 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-4 text-white p-3 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2" onClick={(e) => e.stopPropagation()}>
              {images.map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                    index === selectedImageIndex ? "border-white" : "border-transparent opacity-50 hover:opacity-75"
                  }`}
                >
                  <img
                    src={img.thumbnailUrl || img.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-6 right-6 text-white text-sm">
            {selectedImageIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
