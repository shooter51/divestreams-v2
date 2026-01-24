/**
 * Tour Listing for Booking Widget
 *
 * Displays available tours with images for customers to browse.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { getOrganizationBySlug, getPublicTours, type PublicTour } from "../../../lib/db/queries.public";

export const meta: MetaFunction = () => [{ title: "Available Tours" }];

export async function loader({ params }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const tours = await getPublicTours(org.id);

  return { tours };
}

const tourTypeLabels: Record<string, string> = {
  single_dive: "Single Dive",
  multi_dive: "Multi-Dive",
  course: "Course",
  snorkel: "Snorkel",
  night_dive: "Night Dive",
  other: "Experience",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));
}

// Widget settings type (matches embed layout)
type WidgetSettings = {
  primaryColor: string;
  buttonText: string;
  showPrices: boolean;
  showAvailability: boolean;
  showDescription: boolean;
  layout: "grid" | "list";
  maxTripsShown: number;
};

function TourCard({
  tour,
  tenantSlug,
  widgetSettings
}: {
  tour: PublicTour;
  tenantSlug: string;
  widgetSettings: WidgetSettings;
}) {
  const inclusions = [];
  if (tour.includesEquipment) inclusions.push("Equipment");
  if (tour.includesMeals) inclusions.push("Meals");
  if (tour.includesTransport) inclusions.push("Transport");

  const isListLayout = widgetSettings.layout === "list";

  return (
    <Link
      to={`/embed/${tenantSlug}/tour/${tour.id}`}
      className={`block bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden ${
        isListLayout ? "flex" : ""
      }`}
    >
      {/* Image */}
      <div className={`bg-gray-100 relative ${isListLayout ? "w-48 flex-shrink-0" : "aspect-video"}`}>
        {tour.primaryImage ? (
          <img
            src={tour.thumbnailImage || tour.primaryImage}
            alt={tour.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="w-12 h-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Type badge */}
        <span className="absolute top-2 left-2 bg-white/90 text-xs font-medium px-2 py-1 rounded">
          {tourTypeLabels[tour.type] || tour.type}
        </span>
      </div>

      {/* Content */}
      <div className={`p-4 ${isListLayout ? "flex-1" : ""}`}>
        <h3 className="font-semibold text-lg mb-1">{tour.name}</h3>

        {widgetSettings.showDescription && tour.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {tour.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          {tour.duration > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(tour.duration)}
            </span>
          )}
          {widgetSettings.showAvailability && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Max {tour.maxParticipants}
            </span>
          )}
        </div>

        {/* Inclusions */}
        {inclusions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {inclusions.map((inc) => (
              <span
                key={inc}
                className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded"
              >
                {inc} included
              </span>
            ))}
          </div>
        )}

        {/* Requirements */}
        {(tour.minCertLevel || tour.minAge) && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
            {tour.minCertLevel && (
              <span>Certification: {tour.minCertLevel}+</span>
            )}
            {tour.minAge && <span>Age: {tour.minAge}+</span>}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-3 border-t">
          {widgetSettings.showPrices && (
            <span className="text-xl font-bold" style={{ color: "var(--primary-color)" }}>
              {formatPrice(tour.price, tour.currency)}
            </span>
          )}
          <span
            className={`text-sm font-medium px-4 py-2 rounded ${!widgetSettings.showPrices ? "ml-auto" : ""}`}
            style={{ backgroundColor: "var(--secondary-color)", color: "var(--primary-color)" }}
          >
            {widgetSettings.buttonText}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Default widget settings (fallback if not provided)
const defaultWidgetSettings: WidgetSettings = {
  primaryColor: "#2563eb",
  buttonText: "Book Now",
  showPrices: true,
  showAvailability: true,
  showDescription: true,
  layout: "grid",
  maxTripsShown: 6,
};

export default function EmbedToursPage() {
  const { tours } = useLoaderData<typeof loader>();
  const { organization, widgetSettings: contextSettings } = useOutletContext<{
    organization: { slug: string; name: string };
    branding: { primaryColor: string };
    widgetSettings?: WidgetSettings;
  }>();

  // Use widget settings from context or defaults
  const widgetSettings = contextSettings || defaultWidgetSettings;

  // Apply maxTripsShown limit
  const displayedTours = tours.slice(0, widgetSettings.maxTripsShown);

  if (tours.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          No Tours Available
        </h2>
        <p className="text-gray-500">
          Check back soon for upcoming experiences!
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Available Tours</h2>

      <div className={
        widgetSettings.layout === "list"
          ? "flex flex-col gap-4"
          : "grid gap-6 md:grid-cols-2"
      }>
        {displayedTours.map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            tenantSlug={organization.slug}
            widgetSettings={widgetSettings}
          />
        ))}
      </div>
    </div>
  );
}
